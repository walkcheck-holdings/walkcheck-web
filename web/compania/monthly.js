/* Reporte mensual para el cliente (Reportes → Generar reporte).
   Todos los trabajos del mes de un cliente (o de un edificio), con el diseño
   "REPORTE" del walkthrough #28: la compañía que hizo el trabajo arriba (logo o
   iniciales), resumen, lista de trabajos, hallazgos abiertos con su foto al
   lado y hallazgos resueltos (antes / después). WalkCheck solo abajo, chiquito.
   Usa los datos que ya carga el panel (jobs, buildings, reportWalks). */
(function () {
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  var PRIO = {
    alta: { es: 'ALTA', en: 'HIGH', c: '#C0392B' },
    media: { es: 'MEDIA', en: 'MEDIUM', c: '#C77C0E' },
    baja: { es: 'BAJA', en: 'LOW', c: '#1E9E4A' }
  };
  function prio(k) { return PRIO[k] || PRIO.media; }

  function initials(name) {
    var w = String(name || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    var main = w.filter(function (x) { return ['llc', 'inc', 'corp', 'co', 'ltd', 'llp', 'pllc', 'pa', 'lc'].indexOf(x.toLowerCase()) < 0; });
    var use = main.length ? main : w;
    if (!use.length) return 'W';
    if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
    return (use[0][0] + use[1][0]).toUpperCase();
  }
  function longDate(d) {
    return d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function shortDay(s) {
    var d = new Date(String(s).slice(0, 10) + 'T12:00:00');
    if (isNaN(d)) return String(s || '');
    return d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' });
  }

  /* ---------- who / what is in the report ---------- */
  function clientKey(s) { return String(s || '').trim().toLowerCase(); }
  function jobClient(j) { return String(j.clientName || '').trim(); }
  // Every client name the panel knows: from the jobs and from Clients.
  window.monthlyClientNames = function () {
    var seen = {}, out = [];
    function add(n) { n = String(n || '').trim(); if (n && !seen[clientKey(n)]) { seen[clientKey(n)] = 1; out.push(n); } }
    (window._rptClients || []).forEach(function (c) { add(c.name); });
    (typeof jobs !== 'undefined' ? jobs : []).forEach(function (j) { add(jobClient(j)); });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  };
  window.loadMonthlyClients = async function () {
    if (window._rptClients) return window._rptClients;
    try {
      var snap = await db.collection('companies').doc(cid()).collection('clients').limit(500).get();
      var l = [];
      snap.forEach(function (d) { l.push(Object.assign({ id: d.id }, d.data())); });
      window._rptClients = l;
    } catch (e) { window._rptClients = []; }
    return window._rptClients;
  };

  function jobDays(j) {
    var d = [];
    (Array.isArray(j.visits) ? j.visits : []).forEach(function (v) { if (v && v.scheduledDate) d.push(String(v.scheduledDate).slice(0, 10)); });
    if (j.scheduledDate) d.push(String(j.scheduledDate).slice(0, 10));
    else if (j.date) d.push(String(j.date).slice(0, 10));
    return d;
  }
  function inMonth(j, ym) { return jobDays(j).some(function (d) { return d.slice(0, 7) === ym; }); }
  function dayInMonth(j, ym) {
    var d = jobDays(j).filter(function (x) { return x.slice(0, 7) === ym; }).sort();
    return d[0] || jobDays(j)[0] || '';
  }
  function clientMatch(j, client) {
    if (!client) return true;
    if (clientKey(jobClient(j)) === clientKey(client.name)) return true;
    return !!(client.id && j.billClientId === client.id);
  }

  /* ---------- findings ---------- */
  function fromWalk(f, bName) {
    var res = findingIsResolved(f);
    return {
      title: [f.itemLabel || f.title || '', f.location || '', f.floor ? T('Piso ', 'Floor ') + f.floor : ''].filter(Boolean).join(' — ') || T('Hallazgo', 'Finding'),
      desc: f.description || '',
      priority: f.priority || (f.urgent ? 'alta' : 'media'),
      photos: photosOf(f),
      after: photosOf({ photoUrls: f.afterPhotoUrls || f.resolvedPhotoUrls || f.afterPhotos || [] }),
      resolved: res, carry: !!f.carry, origin: f.originMonth || '', building: bName
    };
  }
  function fromJob(f, j) {
    return {
      title: [f.area, f.title].filter(Boolean).join(' — ') || T('Hallazgo', 'Finding'),
      desc: f.desc || '', priority: f.priority || 'media',
      photos: (f.photos || []).filter(Boolean), after: (f.afterPhotos || []).filter(Boolean),
      resolved: findingIsResolved(f), carry: false, origin: '', building: cardAddr(j)
    };
  }

  /* ---------- the report ---------- */
  window.generateClientReport = async function () {
    var ym = ($('rptMonth') && $('rptMonth').value) || ymd(selectedDay).slice(0, 7);
    var out = $('rptOut');
    if (!out) return;
    out.innerHTML = '<p class="muted">' + esc(T('Armando el reporte…', 'Building the report…')) + '</p>';
    await loadReportWalks();
    await loadMonthlyClients();

    var cName = ($('rptClient') && $('rptClient').value) || '';
    var client = null;
    if (cName) {
      client = (window._rptClients || []).find(function (c) { return clientKey(c.name) === clientKey(cName); }) || { name: cName };
    }
    var bid = ($('rptBld') && $('rptBld').value) || '';
    var bAll = reportBuildings();
    var bld = bid ? bAll.find(function (x) { return String(x.id) === String(bid); }) : null;

    var all = (typeof jobs !== 'undefined' ? jobs : []).filter(function (j) {
      if (typeof jobArchived === 'function' && jobArchived(j)) return false;
      return clientMatch(j, client) && (!bld || matchSite(j, bld));
    });
    var monthJobs = all.filter(function (j) { return inMonth(j, ym); })
      .sort(function (a, b) { return dayInMonth(a, ym) < dayInMonth(b, ym) ? -1 : 1; });

    // Buildings in the report: the one picked, or every building of this client's jobs.
    var blds = bld ? [bld] : bAll.filter(function (b) { return all.some(function (j) { return matchSite(j, b); }); });
    if (!client && !bld) blds = bAll;

    var finds = [];
    blds.forEach(function (b) {
      findingsFor(b, ym).forEach(function (f) { finds.push(fromWalk(f, b.name || b.address || '')); });
    });
    monthJobs.forEach(function (j) {
      (Array.isArray(j.reportFindings) ? j.reportFindings : []).forEach(function (f) { finds.push(fromJob(f, j)); });
    });
    // Same finding from the app walkthrough and the office report: keep one (same first photo).
    var seenPh = {};
    finds = finds.filter(function (f) {
      if (!f.photos[0]) return true;
      var k = f.photos[0] + '|' + f.title;
      if (seenPh[k]) return false;
      seenPh[k] = 1; return true;
    });
    var open = finds.filter(function (f) { return !f.resolved; });
    var fixed = finds.filter(function (f) { return f.resolved; });
    var order = { alta: 0, media: 1, baja: 2 };
    open.sort(function (a, b) { return (order[a.priority] || 1) - (order[b.priority] || 1); });

    if (!monthJobs.length && !finds.length) {
      out.innerHTML = '<p class="muted">' + esc(uiT('noReportData')) + '</p>';
      return;
    }

    var done = monthJobs.filter(jobDone);
    var techNames = [];
    monthJobs.forEach(function (j) { var n = workerNameOf(j); if (n && techNames.indexOf(n) < 0) techNames.push(n); });
    var carryN = open.filter(function (f) { return f.carry; }).length;

    var co = companyName || '';
    var logo = (typeof companyLogoData !== 'undefined' && companyLogoData) || companyLogo || '';
    var color = (typeof companyBrandColor !== 'undefined' && /^#[0-9a-f]{6}$/i.test(companyBrandColor || '')) ? companyBrandColor : '#E8772E';
    var contact = [companyPhone, companyInvoiceEmail].filter(Boolean);
    var who = client ? client.name : T('Todos los clientes', 'All clients');
    var where = bld ? (bld.name || bld.address) : (blds.length === 1 ? (blds[0].name || blds[0].address) : blds.length + ' ' + T('edificios', 'buildings'));

    var rows = monthJobs.map(function (j) {
      var ok = jobDone(j);
      return '<tr><td>' + esc(shortDay(dayInMonth(j, ym))) + '</td><td>' + esc(cardAddr(j) + (j.unit ? ' · ' + T('Unidad ', 'Unit ') + j.unit : '')) + '</td>' +
        '<td>' + esc(j.kind || j.title || '') + '</td><td>' + esc(workerNameOf(j) || '—') + '</td>' +
        '<td><span class="mr-st" style="background:' + (ok ? '#1E9E4A' : '#C77C0E') + '">' + esc(ok ? T('HECHO', 'DONE') : T('PENDIENTE', 'PENDING')) + '</span></td></tr>';
    }).join('');

    function card(f, i, label) {
      var p = prio(f.priority);
      var ph = f.photos[0];
      var after = f.after[0];
      return '<div class="mr-card" style="border-left-color:' + (f.resolved ? '#1E9E4A' : p.c) + '"><div class="mr-txt">' +
        '<div class="mr-k">' + esc(label + ' ' + (i + 1)) + ' <span class="mr-pill" style="background:' + (f.resolved ? '#1E9E4A' : p.c) + '">' +
          esc(f.resolved ? T('RESUELTO', 'RESOLVED') : T(p.es, p.en)) + '</span></div>' +
        '<h4>' + esc(f.title) + '</h4>' +
        (f.building ? '<div class="mr-b">' + esc(f.building) + '</div>' : '') +
        (f.desc ? '<p>' + esc(f.desc) + '</p>' : '') +
        (f.carry && f.origin ? '<div class="mr-carry">' + esc(T('Pendiente desde ', 'Open since ') + monthLabel(f.origin)) + '</div>' : '') +
        '</div>' +
        (ph ? '<div class="mr-ph"><img src="' + esc(ph) + '" crossorigin="anonymous" alt=""><div class="mr-cap">' + esc(f.resolved ? T('Antes', 'Before') : T('Foto', 'Photo')) + '</div></div>' : '') +
        (f.resolved && after ? '<div class="mr-ph"><img src="' + esc(after) + '" crossorigin="anonymous" alt=""><div class="mr-cap">' + esc(T('Después', 'After')) + '</div></div>' : '') +
        '</div>';
    }

    var css = '<style>' +
      '#rptPaper.mr{background:#FAF6EC;border:3px double #16324F;outline:2px solid #16324F;outline-offset:-9px;padding:26px 26px 0;color:#1F2937;font:13px/1.45 "DejaVu Sans",Verdana,sans-serif;max-width:860px;margin:0 auto}' +
      '.mr-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.mr-brand{display:flex;gap:12px;align-items:center;min-width:0}' +
      '.mr-logo{width:58px;height:58px;object-fit:contain}.mr-ini{width:58px;height:58px;border-radius:12px;color:#fff;font:700 24px Verdana,sans-serif;display:flex;align-items:center;justify-content:center;flex:none}' +
      '.mr-co{font:700 26px/1.05 Georgia,"DejaVu Serif",serif;color:#16324F;text-transform:uppercase}.mr-sub{color:#1E9E4A;font-weight:700;font-size:10.5px;letter-spacing:.6px;margin-top:4px;text-transform:uppercase}' +
      '.mr-rt{text-align:right}.mr-big{font:700 32px/1 Georgia,"DejaVu Serif",serif;color:#16324F}.mr-g{color:#1E9E4A;font-weight:700;letter-spacing:.6px;margin-top:6px;text-transform:uppercase}.mr-d{font-size:12px;margin-top:3px}' +
      '.mr-rule{border-top:3px solid #16324F;border-bottom:1px solid #16324F;height:4px;margin:16px 0}' +
      '.mr-info{display:grid;grid-template-columns:1fr 1fr;gap:16px}.mr-lab{color:#1E9E4A;font-weight:700;font-size:10.5px;letter-spacing:.6px;margin-bottom:4px}.mr-info b{font-size:14px}' +
      '.mr-sum{background:#EEF3EC;border:1px solid #16324F;padding:12px 16px;margin:18px 0}.mr-sum h3{margin:0 0 6px;font-size:16px;color:#16324F}.mr-nums{display:flex;flex-wrap:wrap;gap:6px 16px;font-weight:700;font-size:11.5px;letter-spacing:.3px}' +
      '.mr-h{color:#16324F;font:700 15px Verdana,sans-serif;margin:20px 0 10px;letter-spacing:.3px}' +
      '.mr-tbl{width:100%;border-collapse:collapse;background:#fff;border:1px solid #16324F;font-size:12px}.mr-tbl th{background:#16324F;color:#fff;text-align:left;padding:7px 8px;font-size:10.5px;letter-spacing:.5px}' +
      '.mr-tbl td{padding:7px 8px;border-top:1px solid #E5E7EB;vertical-align:top}.mr-st{color:#fff;border-radius:999px;padding:2px 8px;font-size:9.5px;font-weight:700;white-space:nowrap}' +
      '.mr-card{display:flex;gap:14px;background:#fff;border:1px solid #16324F;border-left:8px solid;padding:14px 14px 12px 18px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid}' +
      '.mr-txt{flex:1;min-width:0}.mr-k{color:#1E9E4A;font-weight:700;font-size:10.5px;letter-spacing:.6px}.mr-pill{color:#fff;border-radius:999px;padding:2px 9px;margin-left:8px;font-size:9.5px}' +
      '.mr-card h4{font-size:15px;color:#16324F;margin:8px 0 4px}.mr-b{color:#6B7280;font-size:11.5px}.mr-card p{margin:6px 0 0}.mr-carry{color:#C77C0E;font-weight:700;font-size:11px;margin-top:6px}' +
      '.mr-ph{width:120px;flex:none;text-align:center}.mr-ph img{width:120px;height:158px;object-fit:cover;border:1px solid #16324F;display:block}.mr-cap{color:#6B7280;font-size:10.5px;margin-top:3px}' +
      '.mr-gen{text-align:center;color:#6B7280;font-size:11px;margin:22px 0 6px}.mr-foot{background:#16324F;color:#fff;text-align:center;font-weight:700;padding:13px;margin:0 -26px}' +
      '@media (max-width:640px){#rptPaper.mr{padding:16px 12px 0}.mr-rt{text-align:left}.mr-info{grid-template-columns:1fr}.mr-card{flex-wrap:wrap}.mr-ph,.mr-ph img{width:100%}.mr-ph img{height:auto;max-height:320px}.mr-foot{margin:0 -12px}.mr-tbl{font-size:11px}}' +
      '</style>';

    var fname = 'reporte-mensual-' + siteKey(client ? client.name : (bld ? bld.name : co)) + '-' + ym + '.pdf';
    lastReportPdf = { blob: null, url: '', name: fname, title: co + ' · ' + T('Reporte mensual', 'Monthly report') + ' · ' + who + ' · ' + monthLabel(ym) };

    out.innerHTML = '<div class="rpt-actions">' +
        '<button class="btn" onclick="downloadReportPdf()">' + esc(uiT('downloadPdf')) + '</button>' +
        '<button class="btn ghost" onclick="sendReportWa()">' + esc(uiT('sendWa')) + '</button>' +
        '<button class="btn ghost" onclick="sendReportMail()">' + esc(uiT('sendMail')) + '</button></div>' +
      '<div class="rpt-paper mr" id="rptPaper">' + css +
        '<div class="mr-top"><div class="mr-brand">' +
          (logo ? '<img class="mr-logo" src="' + esc(logo) + '" alt="">' : '<div class="mr-ini" style="background:' + esc(color) + '">' + esc(initials(co)) + '</div>') +
          '<div style="min-width:0"><div class="mr-co">' + esc(co) + '</div>' + (contact.length ? '<div class="mr-sub">' + esc(contact.join(' · ')) + '</div>' : '') + '</div></div>' +
          '<div class="mr-rt"><div class="mr-big">' + esc(T('REPORTE', 'REPORT')) + '</div><div class="mr-g">' + esc(T('MENSUAL · ', 'MONTHLY · ') + monthLabel(ym)) + '</div>' +
          '<div class="mr-d">' + esc(longDate(new Date())) + '</div></div></div>' +
        '<div class="mr-rule"></div>' +
        '<div class="mr-info"><div><div class="mr-lab">' + esc(T('CLIENTE', 'CLIENT')) + '</div><b>' + esc(who) + '</b>' +
            '<div>' + esc(T('Edificios: ', 'Buildings: ') + where) + '</div><div>' + esc(T('Compañía: ', 'Company: ') + co) + '</div></div>' +
          '<div><div class="mr-lab">' + esc(T('PERÍODO', 'PERIOD')) + '</div><b>' + esc(monthLabel(ym)) + '</b>' +
            '<div>' + esc(T('Técnicos: ', 'Technicians: ') + (techNames.join(', ') || '—')) + '</div></div></div>' +
        '<div class="mr-sum"><h3>' + esc(monthJobs.length + ' ' + (monthJobs.length === 1 ? T('trabajo en el mes', 'job this month') : T('trabajos en el mes', 'jobs this month'))) + '</h3>' +
          '<div class="mr-nums"><span style="color:#1E9E4A">' + done.length + ' ' + esc(done.length === 1 ? T('HECHO', 'DONE') : T('HECHOS', 'DONE')) + '</span>' +
            '<span style="color:#C77C0E">' + (monthJobs.length - done.length) + ' ' + esc(monthJobs.length - done.length === 1 ? T('PENDIENTE', 'PENDING') : T('PENDIENTES', 'PENDING')) + '</span>' +
            '<span style="color:#C0392B">' + open.length + ' ' + esc(open.length === 1 ? T('HALLAZGO ABIERTO', 'OPEN FINDING') : T('HALLAZGOS ABIERTOS', 'OPEN FINDINGS')) + (carryN ? ' (' + carryN + ' ' + esc(T('de meses anteriores', 'from earlier months')) + ')' : '') + '</span>' +
            '<span style="color:#1E9E4A">' + fixed.length + ' ' + esc(fixed.length === 1 ? T('RESUELTO', 'RESOLVED') : T('RESUELTOS', 'RESOLVED')) + '</span></div></div>' +
        (monthJobs.length ? '<div class="mr-h">' + esc(T('TRABAJOS DEL MES', 'JOBS THIS MONTH')) + '</div>' +
          '<table class="mr-tbl"><thead><tr><th>' + esc(T('FECHA', 'DATE')) + '</th><th>' + esc(T('DIRECCIÓN', 'ADDRESS')) + '</th><th>' + esc(T('TRABAJO', 'JOB')) + '</th><th>' + esc(T('TÉCNICO', 'TECH')) + '</th><th>' + esc(T('ESTADO', 'STATUS')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
        (open.length ? '<div class="mr-h">' + esc(T('HALLAZGOS QUE NECESITAN REPARACIÓN', 'FINDINGS THAT NEED REPAIR')) + '</div>' +
          open.map(function (f, i) { return card(f, i, T('HALLAZGO', 'FINDING')); }).join('') : '') +
        (fixed.length ? '<div class="mr-h">' + esc(T('RESUELTOS ESTE MES', 'RESOLVED THIS MONTH')) + '</div>' +
          fixed.map(function (f, i) { return card(f, i, T('RESUELTO', 'RESOLVED')); }).join('') : '') +
        '<div class="mr-gen">' + esc(T('Reporte generado con WalkCheck', 'Report made with WalkCheck')) + '</div>' +
        '<div class="mr-foot">' + esc([co].concat(contact.slice().reverse()).filter(Boolean).join('  ·  ')) + '</div>' +
      '</div>';

    try {
      await db.collection('inspection_reports').add({
        companyId: cid(), kind: 'monthly_client', clientName: client ? client.name : '',
        buildingId: bld ? bld.id : '', buildingName: bld ? (bld.name || '') : '',
        yearMonth: ym, jobs: monthJobs.length, done: done.length,
        findings: open.length, resolved: fixed.length,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {}
  };
})();
