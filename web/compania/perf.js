/* Reporte de rendimiento del mes (solo dueño / admin; nunca va al cliente).
   Junta en un PDF: dinero (cobrado, gastos, ganancia y lo que me deben),
   trabajos, rendimiento por técnico y por cliente, comparado con el mes
   anterior. Con la marca de la compañía (logo o iniciales). */
(function () {
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function money(n) {
    n = Number(n || 0);
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function prevMonth(ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
    if (m < 1) { m = 12; y--; }
    return y + '-' + pad(m);
  }
  function todayYmd() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function initials(name) {
    var w = String(name || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    var main = w.filter(function (x) { return ['llc', 'inc', 'corp', 'co', 'ltd', 'llp', 'pllc', 'pa', 'lc'].indexOf(x.toLowerCase()) < 0; });
    var use = main.length ? main : w;
    if (!use.length) return 'W';
    if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
    return (use[0][0] + use[1][0]).toUpperCase();
  }
  // ▲ 12% / ▼ 5% against last month (green when it is good for the business).
  function delta(now, before, lowerIsBetter) {
    if (!before) return now ? '<span class="pf-up">' + esc(T('nuevo', 'new')) + '</span>' : '';
    var pct = Math.round(((now - before) / Math.abs(before)) * 100);
    if (!pct) return '<span class="pf-eq">= ' + esc(T('igual', 'same')) + '</span>';
    var good = lowerIsBetter ? pct < 0 : pct > 0;
    return '<span class="' + (good ? 'pf-up' : 'pf-down') + '">' + (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%</span>';
  }

  function jobDays(j) {
    var d = [];
    (Array.isArray(j.visits) ? j.visits : []).forEach(function (v) { if (v && v.scheduledDate) d.push(String(v.scheduledDate).slice(0, 10)); });
    if (j.scheduledDate) d.push(String(j.scheduledDate).slice(0, 10));
    return d;
  }
  function jobsOf(ym) {
    return (typeof jobs !== 'undefined' ? jobs : []).filter(function (j) {
      if (typeof jobArchived === 'function' && jobArchived(j)) return false;
      return jobDays(j).some(function (d) { return d.slice(0, 7) === ym; });
    });
  }
  function paidOf(inv) { return (inv.payments || []).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0); }
  function hoursOf(j) {
    try { var st = jobTime(j), en = jobEnd(j, st); return Math.max(0, en - st) / 3600000; } catch (e) { return 0; }
  }
  function totals(moves) {
    var inn = 0, out = 0;
    moves.forEach(function (m) { if (m.kind === 'in') inn += m.amount; else out += m.amount; });
    return { inn: inn, out: out, net: inn - out };
  }
  function jobStats(list) {
    var today = todayYmd(), done = 0, late = 0, back = 0;
    list.forEach(function (j) {
      if (jobDone(j)) done++;
      else if ((jobDays(j).sort()[0] || '9') < today) late++;
      if (j.needsReturn === true) back++;
    });
    return { all: list.length, done: done, late: late, back: back };
  }

  window.generatePerfReport = async function () {
    var ym = ($('rptMonth') && $('rptMonth').value) || ymd(selectedDay).slice(0, 7);
    var out = $('rptOut');
    if (!out) return;
    if (typeof canSeeMoney !== 'function' || !canSeeMoney()) return;
    out.innerHTML = '<p class="muted">' + esc(T('Armando el reporte…', 'Building the report…')) + '</p>';
    var pm = prevMonth(ym), now, before;
    try {
      now = await perfMoney(ym);
      before = await perfMoney(pm);
    } catch (e) {
      out.innerHTML = '<p class="muted">' + esc(T('No se pudieron leer las facturas: ', 'Could not read the invoices: ') + (e.message || e)) + '</p>';
      return;
    }
    var mNow = totals(now.moves), mBefore = totals(before.moves);
    var invoices = now.invoices || [];
    var billed = invoices.filter(function (i) { return String(i.issueDate || '').slice(0, 7) === ym; })
      .reduce(function (s, i) { return s + Number(i.total || 0); }, 0);
    var billedBefore = invoices.filter(function (i) { return String(i.issueDate || '').slice(0, 7) === pm; })
      .reduce(function (s, i) { return s + Number(i.total || 0); }, 0);

    // Who owes me (every unpaid invoice, oldest due first).
    var today = todayYmd();
    var owed = invoices.map(function (i) {
      var bal = Number(i.total || 0) - paidOf(i);
      var st = String(i.status || '').toLowerCase();
      var draft = ['draft', 'not_sent'].indexOf(String(i.issuedStatus || st)) >= 0;
      return { inv: i, bal: bal, draft: draft, days: i.dueDate && i.dueDate < today ? Math.round((new Date(today) - new Date(String(i.dueDate).slice(0, 10))) / 86400000) : 0 };
    }).filter(function (x) { return x.bal > 0.009 && !x.draft && String(x.inv.status || '').toLowerCase() !== 'paid'; })
      .sort(function (a, b) { return b.days - a.days || b.bal - a.bal; });
    var owedTotal = owed.reduce(function (s, x) { return s + x.bal; }, 0);
    var overdueTotal = owed.filter(function (x) { return x.days > 0; }).reduce(function (s, x) { return s + x.bal; }, 0);

    var jNow = jobsOf(ym), jBefore = jobsOf(pm);
    var sNow = jobStats(jNow), sBefore = jobStats(jBefore);

    // By technician.
    var byTech = {};
    jNow.forEach(function (j) {
      var n = workerNameOf(j) || T('Sin asignar', 'Unassigned');
      var t = byTech[n] || (byTech[n] = { name: n, all: 0, done: 0, late: 0, back: 0, hours: 0 });
      t.all++;
      if (jobDone(j)) t.done++;
      else if ((jobDays(j).sort()[0] || '9') < today) t.late++;
      if (j.needsReturn === true) t.back++;
      t.hours += hoursOf(j);
    });
    var techRows = Object.keys(byTech).map(function (k) { return byTech[k]; })
      .sort(function (a, b) { return b.done - a.done; });

    // By client.
    var byCli = {};
    function cli(n) { n = String(n || '').trim() || T('Sin cliente', 'No client'); return byCli[n] || (byCli[n] = { name: n, jobs: 0, billed: 0, paid: 0, owes: 0 }); }
    jNow.forEach(function (j) { cli(j.clientName).jobs++; });
    invoices.forEach(function (i) {
      if (String(i.issueDate || '').slice(0, 7) === ym) cli(i.client).billed += Number(i.total || 0);
    });
    now.moves.forEach(function (m) { if (m.kind === 'in') cli(m.who).paid += m.amount; });
    owed.forEach(function (x) { cli(x.inv.client).owes += x.bal; });
    var cliRows = Object.keys(byCli).map(function (k) { return byCli[k]; })
      .sort(function (a, b) { return (b.billed + b.paid) - (a.billed + a.paid) || b.jobs - a.jobs; }).slice(0, 12);
    // Clients that had jobs last month and none this month.
    var nowNames = {};
    jNow.forEach(function (j) { nowNames[String(j.clientName || '').trim().toLowerCase()] = 1; });
    var lost = [];
    jBefore.forEach(function (j) {
      var n = String(j.clientName || '').trim();
      if (n && !nowNames[n.toLowerCase()] && lost.indexOf(n) < 0) lost.push(n);
    });

    var co = companyName || '';
    var logo = (typeof companyLogoData !== 'undefined' && companyLogoData) || companyLogo || '';
    var color = (typeof companyBrandColor !== 'undefined' && /^#[0-9a-f]{6}$/i.test(companyBrandColor || '')) ? companyBrandColor : '#E8772E';
    var contact = [companyPhone, companyInvoiceEmail].filter(Boolean);
    var margin = mNow.inn > 0 ? Math.round((mNow.net / mNow.inn) * 100) : 0;

    function kpi(label, val, d, color2) {
      return '<div class="pf-kpi"><span>' + esc(label) + '</span><b style="color:' + (color2 || '#16324F') + '">' + esc(val) + '</b><i>' + (d || '') + '</i></div>';
    }
    var css = '<style>' +
      '#rptPaper.pf{background:#FAF6EC;border:3px double #16324F;outline:2px solid #16324F;outline-offset:-9px;padding:26px 26px 0;color:#1F2937;font:13px/1.45 "DejaVu Sans",Verdana,sans-serif;max-width:860px;margin:0 auto}' +
      '.pf-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.pf-brand{display:flex;gap:12px;align-items:center;min-width:0}' +
      '.pf-logo{width:58px;height:58px;object-fit:contain}.pf-ini{width:58px;height:58px;border-radius:12px;color:#fff;font:700 24px Verdana,sans-serif;display:flex;align-items:center;justify-content:center;flex:none}' +
      '.pf-co{font:700 26px/1.05 Georgia,"DejaVu Serif",serif;color:#16324F;text-transform:uppercase}.pf-sub{color:#1E9E4A;font-weight:700;font-size:10.5px;letter-spacing:.6px;margin-top:4px;text-transform:uppercase}' +
      '.pf-rt{text-align:right}.pf-big{font:700 28px/1 Georgia,"DejaVu Serif",serif;color:#16324F}.pf-g{color:#1E9E4A;font-weight:700;letter-spacing:.6px;margin-top:6px;text-transform:uppercase}.pf-d{font-size:12px;margin-top:3px}' +
      '.pf-rule{border-top:3px solid #16324F;border-bottom:1px solid #16324F;height:4px;margin:16px 0}' +
      '.pf-h{color:#16324F;font:700 15px Verdana,sans-serif;margin:22px 0 10px;letter-spacing:.3px}' +
      '.pf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.pf-kpi{background:#fff;border:1px solid #16324F;padding:10px 12px}' +
      '.pf-kpi span{display:block;color:#6B7280;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}.pf-kpi b{display:block;font-size:19px;margin:3px 0}.pf-kpi i{font-style:normal;font-size:11px}' +
      '.pf-up{color:#1E9E4A;font-weight:700}.pf-down{color:#C0392B;font-weight:700}.pf-eq{color:#6B7280}' +
      '.pf-tbl{width:100%;border-collapse:collapse;background:#fff;border:1px solid #16324F;font-size:12px}.pf-tbl th{background:#16324F;color:#fff;text-align:left;padding:7px 8px;font-size:10.5px;letter-spacing:.5px}' +
      '.pf-tbl td{padding:7px 8px;border-top:1px solid #E5E7EB;vertical-align:top}.pf-tbl td.r,.pf-tbl th.r{text-align:right}' +
      '.pf-note{background:#EEF3EC;border:1px solid #16324F;padding:10px 14px;margin-top:10px;font-size:12px}' +
      '.pf-warn{color:#C0392B;font-weight:700}' +
      '.pf-gen{text-align:center;color:#6B7280;font-size:11px;margin:22px 0 6px}.pf-foot{background:#16324F;color:#fff;text-align:center;font-weight:700;padding:13px;margin:0 -26px}' +
      '@media (max-width:640px){#rptPaper.pf{padding:16px 12px 0}.pf-rt{text-align:left}.pf-kpis{grid-template-columns:1fr 1fr}.pf-foot{margin:0 -12px}.pf-tbl{font-size:11px}}' +
      '</style>';

    var owedRows = owed.slice(0, 12).map(function (x) {
      return '<tr><td>' + esc(x.inv.client || '—') + '</td><td>#' + esc(x.inv.number || '') + '</td><td class="r">' + esc(money(x.bal)) + '</td>' +
        '<td class="r">' + (x.days > 0 ? '<span class="pf-warn">' + x.days + ' ' + esc(T('días', 'days')) + '</span>' : esc(T('a tiempo', 'on time'))) + '</td></tr>';
    }).join('');
    var techHtml = techRows.map(function (t) {
      return '<tr><td>' + esc(t.name) + '</td><td class="r">' + t.all + '</td><td class="r">' + t.done + '</td><td class="r">' +
        (t.late ? '<span class="pf-warn">' + t.late + '</span>' : '0') + '</td><td class="r">' + t.back + '</td><td class="r">' + t.hours.toFixed(1) + '</td></tr>';
    }).join('');
    var cliHtml = cliRows.map(function (c) {
      return '<tr><td>' + esc(c.name) + '</td><td class="r">' + c.jobs + '</td><td class="r">' + esc(money(c.billed)) + '</td><td class="r">' + esc(money(c.paid)) + '</td><td class="r">' +
        (c.owes > 0.009 ? '<span class="pf-warn">' + esc(money(c.owes)) + '</span>' : '$0.00') + '</td></tr>';
    }).join('');

    var fname = 'rendimiento-' + siteKey(co || 'compania') + '-' + ym + '.pdf';
    lastReportPdf = { blob: null, url: '', name: fname, title: co + ' · ' + T('Rendimiento', 'Performance') + ' · ' + monthLabel(ym) };

    out.innerHTML = '<div class="rpt-actions"><button class="btn" onclick="downloadReportPdf()">' + esc(uiT('downloadPdf')) + '</button></div>' +
      '<div class="rpt-paper pf" id="rptPaper">' + css +
      '<div class="pf-top"><div class="pf-brand">' +
        (logo ? '<img class="pf-logo" src="' + esc(logo) + '" alt="">' : '<div class="pf-ini" style="background:' + esc(color) + '">' + esc(initials(co)) + '</div>') +
        '<div style="min-width:0"><div class="pf-co">' + esc(co) + '</div>' + (contact.length ? '<div class="pf-sub">' + esc(contact.join(' · ')) + '</div>' : '') + '</div></div>' +
        '<div class="pf-rt"><div class="pf-big">' + esc(T('RENDIMIENTO', 'PERFORMANCE')) + '</div><div class="pf-g">' + esc(monthLabel(ym)) + '</div>' +
        '<div class="pf-d">' + esc(T('Comparado con ', 'Compared with ') + monthLabel(pm) + ' · ' + T('solo para el dueño', 'owner only')) + '</div></div></div>' +
      '<div class="pf-rule"></div>' +

      '<div class="pf-h">' + esc(T('1. DINERO', '1. MONEY')) + '</div>' +
      '<div class="pf-kpis">' +
        kpi(T('Cobrado', 'Collected'), money(mNow.inn), delta(mNow.inn, mBefore.inn)) +
        kpi(T('Gastos', 'Expenses'), money(mNow.out), delta(mNow.out, mBefore.out, true)) +
        kpi(T('Ganancia', 'Profit'), money(mNow.net), delta(mNow.net, mBefore.net), mNow.net < 0 ? '#C0392B' : '#1E9E4A') +
        kpi(T('Facturado', 'Invoiced'), money(billed), delta(billed, billedBefore)) +
      '</div>' +
      '<div class="pf-note">' + esc(T('Margen: ', 'Margin: ') + margin + '% · ' + T('Te deben: ', 'Owed to you: ') + money(owedTotal)) +
        (overdueTotal > 0 ? ' · <span class="pf-warn">' + esc(T('Vencido: ', 'Overdue: ') + money(overdueTotal)) + '</span>' : '') + '</div>' +
      (owed.length ? '<div class="pf-h">' + esc(T('2. LO QUE TE DEBEN', '2. WHAT YOU ARE OWED')) + '</div>' +
        '<table class="pf-tbl"><thead><tr><th>' + esc(T('CLIENTE', 'CLIENT')) + '</th><th>' + esc(T('FACTURA', 'INVOICE')) + '</th><th class="r">' + esc(T('DEBE', 'OWES')) + '</th><th class="r">' + esc(T('VENCIDA', 'OVERDUE')) + '</th></tr></thead><tbody>' + owedRows + '</tbody></table>' : '') +

      '<div class="pf-h">' + esc(T('3. TRABAJOS', '3. JOBS')) + '</div>' +
      '<div class="pf-kpis">' +
        kpi(T('En el mes', 'This month'), String(sNow.all), delta(sNow.all, sBefore.all)) +
        kpi(T('Hechos', 'Done'), String(sNow.done), delta(sNow.done, sBefore.done), '#1E9E4A') +
        kpi(T('Atrasados', 'Late'), String(sNow.late), delta(sNow.late, sBefore.late, true), sNow.late ? '#C0392B' : '#16324F') +
        kpi(T('Volver a ir', 'Return visits'), String(sNow.back), delta(sNow.back, sBefore.back, true)) +
      '</div>' +

      (techRows.length ? '<div class="pf-h">' + esc(T('4. TÉCNICOS', '4. TECHNICIANS')) + '</div>' +
        '<table class="pf-tbl"><thead><tr><th>' + esc(T('TÉCNICO', 'TECH')) + '</th><th class="r">' + esc(T('TRABAJOS', 'JOBS')) + '</th><th class="r">' + esc(T('HECHOS', 'DONE')) + '</th><th class="r">' + esc(T('ATRASADOS', 'LATE')) + '</th><th class="r">' + esc(T('VOLVER', 'RETURN')) + '</th><th class="r">' + esc(T('HORAS', 'HOURS')) + '</th></tr></thead><tbody>' + techHtml + '</tbody></table>' +
        '<div class="pf-note">' + esc(T('Horas = horario de los trabajos asignados (inicio a fin).', 'Hours = scheduled time of the assigned jobs (start to end).')) + '</div>' : '') +

      (cliRows.length ? '<div class="pf-h">' + esc(T('5. CLIENTES', '5. CLIENTS')) + '</div>' +
        '<table class="pf-tbl"><thead><tr><th>' + esc(T('CLIENTE', 'CLIENT')) + '</th><th class="r">' + esc(T('TRABAJOS', 'JOBS')) + '</th><th class="r">' + esc(T('FACTURADO', 'INVOICED')) + '</th><th class="r">' + esc(T('COBRADO', 'COLLECTED')) + '</th><th class="r">' + esc(T('DEBE', 'OWES')) + '</th></tr></thead><tbody>' + cliHtml + '</tbody></table>' : '') +
      (lost.length ? '<div class="pf-note">' + esc(T('Tuvieron trabajos el mes pasado y este mes no: ', 'Had jobs last month and none this month: ') + lost.join(', ')) + '</div>' : '') +

      '<div class="pf-gen">' + esc(T('Reporte generado con WalkCheck', 'Report made with WalkCheck')) + '</div>' +
      '<div class="pf-foot">' + esc([co].concat(contact.slice().reverse()).filter(Boolean).join('  ·  ')) + '</div>' +
      '</div>';
  };
})();
