/* Company dashboard on Inicio: money in vs money out for one month.
   Entradas = payments recorded on invoices. Gastos = expenses logged on jobs
   plus the material cost (report.expensesTotal) from each Job Report.
   Owner / office only (canSeeMoney). Workers never load this file. */
(function () {
  var month = null; // 'YYYY-MM'
  var invCache = null;

  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function thisMonth() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function shiftMonth(m, k) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + k;
    var d = new Date(y, mo, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function monthLabel(m) {
    var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1);
    var s = d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dayLabel(ymdStr) {
    var p = String(ymdStr || '').slice(0, 10).split('-');
    if (p.length < 3) return '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { day: 'numeric', month: 'short' });
  }

  async function loadInvoices(force) {
    if (invCache && !force) return invCache;
    var snap = await db.collection('companies').doc(cid()).collection('invoices').limit(1000).get();
    invCache = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    return invCache;
  }

  function localYmd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function tsDay(t) {
    if (!t) return '';
    var d = typeof t.toDate === 'function' ? t.toDate() : new Date(t);
    return isNaN(d) ? '' : localYmd(d);
  }
  // Day of a Job Report expense: the day the report was completed (that is when the
  // material was bought), else the job's visit day, else when the report was last saved.
  function reportDay(j) {
    var r = j.report || {};
    return tsDay(r.completedAt) || String(j.scheduledDate || j.date || '').slice(0, 10) || tsDay(r.updatedAt);
  }

  // Expense row → its receipt photo, with the job's address, date and amount.
  function receiptWindow(x) {
    var en = loginLang() === 'en';
    var photos = (x.photos || []).filter(function (u) { return /^https?:/.test(String(u)); });
    var where = [x.address, x.unit ? (en ? 'Unit ' : 'Unidad ') + x.unit : ''].filter(Boolean).join(' · ');
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box rcpt-box">' +
      '<h3>🧾 ' + esc(T('Recibo', 'Receipt')) + (x.vendor ? ' · ' + esc(x.vendor) : '') + '</h3>' +
      '<div class="rcpt-meta">' +
        (where ? '<div><span class="muted">' + esc(T('Dirección', 'Address')) + '</span><b>' + esc(where) + '</b></div>' : '') +
        '<div><span class="muted">' + esc(T('Trabajo', 'Job')) + '</span><b>' + esc(x.job || '') + '</b></div>' +
        '<div><span class="muted">' + esc(T('Fecha', 'Date')) + '</span><b>' + esc(dayLabel(x.date)) + '</b></div>' +
        '<div><span class="muted">' + esc(T('Importe', 'Amount')) + '</span><b class="rcpt-amt">-' + esc(money(x.amount)) + '</b></div>' +
        (x.items ? '<div class="rcpt-wide"><span class="muted">' + esc(T('Qué se compró', 'Items')) + '</span><b>' + esc(x.items) + '</b></div>' : '') +
      '</div>' +
      (photos.length
        ? '<div class="rcpt-photos">' + photos.map(function (u) {
            return '<a href="' + esc(u) + '" target="_blank" rel="noopener" title="' + esc(T('Abrir en grande', 'Open full size')) + '"><img src="' + esc(u) + '" alt="' + esc(T('Foto del recibo', 'Receipt photo')) + '"></a>';
          }).join('') + '</div><p class="muted rcpt-tip">' + esc(T('Toca la foto para verla en grande o guardarla.', 'Tap the photo to see it full size or save it.')) + '</p>'
        : '<div class="rcpt-none">' + esc(T('Este gasto no tiene foto del recibo.', 'This expense has no receipt photo.')) + '</div>') +
      '<div class="rcpt-btns">' +
        (x.jobId && typeof openJobView === 'function' ? '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\');openJobView(\'' + esc(x.jobId) + '\')">' + esc(T('Ver el trabajo', 'See the job')) + '</button>' : '') +
        '<button class="btn" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cerrar', 'Close')) + '</button>' +
      '</div></div>';
  }

  function movesFor(m, invoices) {
    var moves = [];
    invoices.forEach(function (inv) {
      (inv.payments || []).forEach(function (p) {
        if (String(p.date || '').slice(0, 7) !== m) return;
        moves.push({
          date: String(p.date).slice(0, 10), kind: 'in', amount: Number(p.amount || 0),
          label: T('Pago', 'Payment') + ' · ' + (inv.client || (T('Factura #', 'Invoice #') + (inv.number || ''))),
          who: inv.client || '', ref: inv.number || '',
          open: function () { if (typeof openInvoice === 'function') openInvoice(inv.id); }
        });
      });
    });
    (typeof jobs !== 'undefined' ? jobs : []).forEach(function (j) {
      // Archived jobs (e.g. a duplicate) do not count as expenses.
      if (typeof jobArchived === 'function' && jobArchived(j)) return;
      var jobName = j.number ? T('Trabajo #', 'Job #') + j.number : (j.title || T('Trabajo', 'Job'));
      var jobFull = (j.number || j.jobNumber ? '#' + (j.number || j.jobNumber) + ' · ' : '') + (j.title || j.kind || '');
      (Array.isArray(j.expenses) ? j.expenses : []).forEach(function (e) {
        if (String(e.date || '').slice(0, 7) !== m) return;
        var x = {
          date: String(e.date).slice(0, 10), amount: Number(e.total || 0), vendor: e.vendor || '', items: e.items || '',
          photos: [e.receiptPhoto].concat(e.receiptPhotos || []).filter(Boolean),
          address: j.address || '', unit: j.unit || '', job: jobFull, jobId: j.id
        };
        moves.push({
          date: x.date, kind: 'out', amount: x.amount,
          label: (e.vendor || e.items || T('Gasto', 'Expense')) + ' · ' + jobName,
          vendor: e.vendor || e.items || '', job: jobFull, address: [j.address, j.unit ? T('Unidad ', 'Unit ') + j.unit : ''].filter(Boolean).join(', '),
          hasReceipt: x.photos.length > 0,
          open: function () { receiptWindow(x); }
        });
      });
      // Material cost the worker typed in the Job Report (app or worker web),
      // e.g. a Home Depot receipt. It lives in report.expensesTotal, not in expenses[].
      var r = j.report;
      var cost = r ? Number(r.expensesTotal) : 0;
      if (cost > 0) {
        var day = reportDay(j);
        if (day.slice(0, 7) === m) {
          var rx = {
            date: day, amount: cost, vendor: (r.supplier && String(r.supplier).trim()) || '', items: '',
            photos: (Array.isArray(r.receiptPhotos) ? r.receiptPhotos : []).concat(r.receiptPhoto ? [r.receiptPhoto] : [])
              .filter(function (u, i, a) { return u && a.indexOf(u) === i; }),
            address: j.address || '', unit: j.unit || '', job: jobFull, jobId: j.id
          };
          moves.push({
            date: day, kind: 'out', amount: cost,
            label: ((r.supplier && String(r.supplier).trim()) || T('Materiales', 'Materials')) + ' · ' + jobName,
            vendor: (r.supplier && String(r.supplier).trim()) || T('Materiales', 'Materials'), job: jobFull,
            address: [j.address, j.unit ? T('Unidad ', 'Unit ') + j.unit : ''].filter(Boolean).join(', '),
            hasReceipt: rx.photos.length > 0,
            open: function () { receiptWindow(rx); }
          });
        }
      }
    });
    moves.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return moves;
  }

  // Donut: green arc = entradas, red arc = gastos, net balance in the middle.
  function donut(inSum, outSum) {
    var r = 70, c = 2 * Math.PI * r, tot = inSum + outSum;
    var inLen = tot > 0 ? c * inSum / tot : 0;
    var ring = tot > 0
      ? '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#DC2626" stroke-width="22"/>' +
        '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#16A34A" stroke-width="22" stroke-dasharray="' + inLen.toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 90 90)"/>'
      : '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#E5E7EB" stroke-width="22"/>';
    var net = inSum - outSum;
    return '<svg viewBox="0 0 180 180" class="dash-donut" role="img" aria-label="' + esc(T('Entradas y gastos', 'Money in and out')) + '">' + ring +
      '<text x="90" y="78" text-anchor="middle" class="dash-dl">' + esc(T('Saldo neto', 'Net balance')) + '</text>' +
      '<text x="90" y="102" text-anchor="middle" class="dash-dv" fill="' + (net < 0 ? '#DC2626' : '#14532D') + '">' + esc((net < 0 ? '-' : '') + money(Math.abs(net))) + '</text>' +
      '</svg>';
  }


  /* ---------- Profit & loss PDF (month or whole year) ---------- */
  function movesForPeriod(period, invoices) {
    if (period.length === 7) return movesFor(period, invoices);
    var all = [];
    for (var k = 1; k <= 12; k++) all = all.concat(movesFor(period + '-' + pad(k), invoices));
    all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return all;
  }
  function periodLabel(period) {
    return period.length === 7 ? monthLabel(period) : T('Año ', 'Year ') + period;
  }
  window.openPnl = function () {
    var cur = month || thisMonth(), y = cur.slice(0, 4), now = thisMonth();
    var opts = [];
    for (var i = 0; i < 18; i++) {
      var m = shiftMonth(now, -i);
      opts.push('<option value="' + m + '"' + (m === cur ? ' selected' : '') + '>' + esc(monthLabel(m)) + '</option>');
    }
    var years = [];
    for (var yy = +now.slice(0, 4); yy >= +now.slice(0, 4) - 2; yy--) years.push('<option value="' + yy + '">' + esc(T('Año ', 'Year ') + yy + ' ' + T('completo', '(full)')) + '</option>');
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:440px;max-width:94vw">' +
      '<h3>📊 ' + esc(T('Ganancias y pérdidas', 'Profit and loss')) + '</h3>' +
      '<p class="muted">' + esc(T('Escoge el período. Se descarga un PDF con los ingresos, los gastos y la ganancia, con el logo y los datos de tu compañía.', 'Pick the period. A PDF downloads with money in, expenses and profit, with your company logo and details.')) + '</p>' +
      '<label class="muted" for="pnlPer">' + esc(T('Período', 'Period')) + '</label>' +
      '<select id="pnlPer"><optgroup label="' + esc(T('Un mes', 'One month')) + '">' + opts.join('') + '</optgroup>' +
        '<optgroup label="' + esc(T('Todo el año', 'Whole year')) + '">' + years.join('') + '</optgroup></select>' +
      '<div class="err" id="pnlErr"></div>' +
      '<button class="btn" id="pnlGo" onclick="downloadPnl()">⬇ ' + esc(T('Descargar PDF', 'Download PDF')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
  };
  window.downloadPnl = async function () {
    var period = $('pnlPer').value, err = $('pnlErr'), go = $('pnlGo');
    err.textContent = '';
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) { err.textContent = T('No se pudo cargar el generador de PDF. Recarga la página.', 'PDF generator did not load. Reload the page.'); return; }
    go.disabled = true;
    try {
      var invoices = await loadInvoices(true);
      var moves = movesForPeriod(period, invoices);
      var doc = buildPnlPdf(JsPDF, period, moves);
      var name = T('Ganancias-y-perdidas-', 'Profit-and-loss-') + period + '.pdf';
      doc.save(name);
      $('modal').classList.add('hidden');
    } catch (e) {
      err.textContent = T('No se pudo hacer el PDF: ', 'Could not make the PDF: ') + (e.message || e);
      go.disabled = false;
    }
  };
  function buildPnlPdf(JsPDF, period, moves) {
    var doc = new JsPDF({ unit: 'pt', format: 'letter' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, y = 44;
    var navy = [15, 42, 68], gray = [107, 114, 128], dark = [17, 24, 39], green = [22, 163, 74], red = [220, 38, 38], zebra = [243, 246, 249];
    function color(a) { doc.setTextColor(a[0], a[1], a[2]); }
    function font(st, sz) { doc.setFont('helvetica', st); doc.setFontSize(sz); }
    function clean(t) { return String(t || '').replace(/[^\x20-\x7E\xA0-\xFF—–·]/g, '').trim(); }
    var coName = String(companyName || '');
    var coMail = (typeof companyInvoiceEmail !== 'undefined' && companyInvoiceEmail) || (auth.currentUser && auth.currentUser.email) || '';
    var coPhone = (typeof companyPhone !== 'undefined' && companyPhone) || '';
    var ins = moves.filter(function (m) { return m.kind === 'in'; });
    var outs = moves.filter(function (m) { return m.kind === 'out'; });
    var inSum = ins.reduce(function (s, m) { return s + m.amount; }, 0);
    var outSum = outs.reduce(function (s, m) { return s + m.amount; }, 0);
    var net = inSum - outSum;
    var margin = inSum > 0 ? Math.round(net * 1000 / inSum) / 10 : 0;

    // Header: the company's own brand.
    var hasLogo = false;
    if (typeof companyLogoData !== 'undefined' && companyLogoData) {
      try { doc.addImage(companyLogoData, companyLogoData.indexOf('image/png') > 0 ? 'PNG' : 'JPEG', M, y, 56, 56, undefined, 'FAST'); hasLogo = true; } catch (_) {}
    }
    if (!hasLogo) {
      doc.setFillColor(navy[0], navy[1], navy[2]); doc.roundedRect(M, y, 56, 56, 10, 10, 'F');
      color([255, 255, 255]); font('bold', 26); doc.text((coName.charAt(0) || 'W').toUpperCase(), M + 28, y + 38, { align: 'center' });
    }
    color(navy); font('bold', 20); doc.text(clean(coName).toUpperCase().slice(0, 34), M + 70, y + 24);
    font('normal', 10); color(gray); doc.text(clean([coPhone, coMail].filter(Boolean).join('  ·  ')), M + 70, y + 42);
    color(navy); font('bold', 18); doc.text(clean(T('GANANCIAS Y PÉRDIDAS', 'PROFIT AND LOSS')), W - M, y + 22, { align: 'right' });
    font('normal', 11); color(dark); doc.text(clean(periodLabel(period)), W - M, y + 40, { align: 'right' });
    font('normal', 9); color(gray);
    doc.text(clean(T('Hecho el ', 'Made on ') + new Date().toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { day: 'numeric', month: 'long', year: 'numeric' })), W - M, y + 54, { align: 'right' });
    y += 76;
    doc.setDrawColor(navy[0], navy[1], navy[2]); doc.setLineWidth(2); doc.line(M, y, W - M, y); doc.setLineWidth(0.8);
    y += 18;

    // Summary boxes.
    var bw = (W - 2 * M - 24) / 3;
    function box(x, label, val, col, fill) {
      if (fill) { doc.setFillColor(navy[0], navy[1], navy[2]); doc.roundedRect(x, y, bw, 62, 8, 8, 'F'); }
      else { doc.setDrawColor(209, 213, 219); doc.roundedRect(x, y, bw, 62, 8, 8, 'S'); }
      font('bold', 9); color(fill ? [255, 255, 255] : gray); doc.text(clean(label), x + 14, y + 20);
      font('bold', 19); color(fill ? [255, 255, 255] : col); doc.text(money(val), x + 14, y + 46);
    }
    box(M, T('INGRESOS', 'MONEY IN'), inSum, green);
    box(M + bw + 12, T('GASTOS', 'EXPENSES'), outSum, red);
    box(M + 2 * (bw + 12), T('GANANCIA NETA', 'NET PROFIT'), net, navy, true);
    y += 78;
    font('normal', 10); color(gray);
    doc.text(clean(T('Margen: ', 'Margin: ') + margin + '%   ·   ' + ins.length + ' ' + T('pagos', 'payments') + '   ·   ' + outs.length + ' ' + T('gastos', 'expenses')), M, y);
    y += 20;

    function ensure(h, head) { if (y + h > H - 70) { doc.addPage(); y = 56; if (head) head(); } }
    function table(title, cols, rows, total, col) {
      ensure(70);
      font('bold', 13); color(navy); doc.text(clean(title), M, y); y += 12;
      var head = function () {
        doc.setFillColor(navy[0], navy[1], navy[2]); doc.rect(M, y, W - 2 * M, 24, 'F');
        font('bold', 9); color([255, 255, 255]);
        cols.forEach(function (c) { doc.text(clean(c.t), c.right ? c.x : c.x, y + 16, c.right ? { align: 'right' } : undefined); });
        y += 24;
      };
      head();
      if (!rows.length) { font('normal', 10); color(gray); doc.text(clean(T('Nada en este período.', 'Nothing in this period.')), M + 10, y + 18); y += 30; }
      rows.forEach(function (r, i) {
        font('normal', 9.5);
        var wrapped = cols.map(function (c, k) { return c.w ? doc.splitTextToSize(clean(r[k]), c.w) : [clean(r[k])]; });
        var h = Math.max.apply(null, wrapped.map(function (w) { return w.length; })) * 12 + 10;
        ensure(h, head);
        if (i % 2 === 1) { doc.setFillColor(zebra[0], zebra[1], zebra[2]); doc.rect(M, y, W - 2 * M, h, 'F'); }
        cols.forEach(function (c, k) {
          if (c.right) { font('bold', 9.5); color(col); doc.text(wrapped[k][0], c.x, y + 15, { align: 'right' }); }
          else { font('normal', 9.5); color(dark); doc.text(wrapped[k], c.x, y + 15); }
        });
        y += h;
      });
      ensure(28);
      doc.setDrawColor(209, 213, 219); doc.line(M, y, W - M, y);
      font('bold', 11); color(dark); doc.text(clean(T('Total', 'Total')), M + 10, y + 18);
      color(col); doc.text(money(total), W - M - 10, y + 18, { align: 'right' });
      y += 48;
    }
    var R = W - M - 10;
    // A whole year also gets one line per month.
    if (period.length === 4) {
      var mrows = [];
      for (var k = 1; k <= 12; k++) {
        var mm = period + '-' + pad(k);
        var a = moves.filter(function (m) { return m.kind === 'in' && m.date.slice(0, 7) === mm; }).reduce(function (s, m) { return s + m.amount; }, 0);
        var b = moves.filter(function (m) { return m.kind === 'out' && m.date.slice(0, 7) === mm; }).reduce(function (s, m) { return s + m.amount; }, 0);
        if (a || b) mrows.push([monthLabel(mm), money(a), money(b), money(a - b)]);
      }
      ensure(70);
      font('bold', 13); color(navy); doc.text(clean(T('Por mes', 'By month')), M, y); y += 12;
      doc.setFillColor(navy[0], navy[1], navy[2]); doc.rect(M, y, W - 2 * M, 24, 'F');
      font('bold', 9); color([255, 255, 255]);
      doc.text(clean(T('Mes', 'Month')), M + 10, y + 16);
      doc.text(clean(T('Ingresos', 'Money in')), W - M - 230, y + 16, { align: 'right' });
      doc.text(clean(T('Gastos', 'Expenses')), W - M - 120, y + 16, { align: 'right' });
      doc.text(clean(T('Neto', 'Net')), R, y + 16, { align: 'right' });
      y += 24;
      mrows.forEach(function (r, i) {
        ensure(22);
        if (i % 2 === 1) { doc.setFillColor(zebra[0], zebra[1], zebra[2]); doc.rect(M, y, W - 2 * M, 22, 'F'); }
        font('normal', 9.5); color(dark); doc.text(clean(r[0]), M + 10, y + 15);
        color(green); doc.text(r[1], W - M - 230, y + 15, { align: 'right' });
        color(red); doc.text(r[2], W - M - 120, y + 15, { align: 'right' });
        font('bold', 9.5); color(navy); doc.text(r[3], R, y + 15, { align: 'right' });
        y += 22;
      });
      y += 16;
    }
    table(T('Ingresos (pagos recibidos)', 'Money in (payments received)'),
      [{ t: T('Fecha', 'Date'), x: M + 10, w: 60 }, { t: T('Cliente', 'Client'), x: M + 80, w: 230 }, { t: T('Factura', 'Invoice'), x: M + 320, w: 100 }, { t: T('Importe', 'Amount'), x: R, right: true }],
      ins.map(function (m) { return [dayLabel(m.date), m.who || m.label, m.ref ? '#' + m.ref : '', '+' + money(m.amount)]; }), inSum, green);
    table(T('Gastos', 'Expenses'),
      [{ t: T('Fecha', 'Date'), x: M + 10, w: 60 }, { t: T('Proveedor', 'Vendor'), x: M + 80, w: 120 }, { t: T('Trabajo / dirección', 'Job / address'), x: M + 210, w: 210 }, { t: T('Importe', 'Amount'), x: R, right: true }],
      outs.map(function (m) { return [dayLabel(m.date), m.vendor || T('Gasto', 'Expense'), [m.job, m.address].filter(Boolean).join(' — '), '-' + money(m.amount)]; }), outSum, red);

    // Result line.
    ensure(60);
    doc.setFillColor(navy[0], navy[1], navy[2]); doc.roundedRect(M, y, W - 2 * M, 44, 8, 8, 'F');
    font('bold', 12); color([255, 255, 255]);
    doc.text(clean(T('GANANCIA NETA DEL PERÍODO', 'NET PROFIT FOR THE PERIOD')), M + 16, y + 27);
    font('bold', 17); doc.text(money(net), W - M - 16, y + 28, { align: 'right' });
    y += 60;
    font('normal', 8.5); color(gray);
    doc.text(doc.splitTextToSize(clean(T('Ingresos = pagos anotados en las facturas. Gastos = gastos anotados en los trabajos y costo de materiales de los Job Reports. Los trabajos archivados no cuentan.',
      'Money in = payments recorded on invoices. Expenses = expenses logged on jobs and material cost from Job Reports. Archived jobs do not count.')), W - 2 * M), M, y);

    var pages = doc.internal.getNumberOfPages();
    for (var pg = 1; pg <= pages; pg++) {
      doc.setPage(pg);
      doc.setDrawColor(229, 231, 235); doc.line(M, H - 44, W - M, H - 44);
      font('bold', 9); color(navy); doc.text(clean(coName).toUpperCase(), M, H - 28);
      font('normal', 8.5); color(gray);
      doc.text(clean(T('Hecho con WalkCheck', 'Made with WalkCheck') + '  ·  ' + pg + '/' + pages), W - M, H - 28, { align: 'right' });
    }
    return doc;
  }

  window.renderHomeDash = async function (force) {
    var box = $('homeDash');
    if (!box) return;
    if (typeof canSeeMoney !== 'function' || !canSeeMoney()) { box.innerHTML = ''; return; }
    month = month || thisMonth();
    if (!box.innerHTML) box.innerHTML = '<div class="dash-card muted">' + esc(T('Cargando…', 'Loading…')) + '</div>';
    var invoices;
    try { invoices = await loadInvoices(force); }
    catch (e) { box.innerHTML = '<div class="dash-card err">' + esc(e.message || e) + '</div>'; return; }
    box = $('homeDash'); if (!box) return;
    var moves = movesFor(month, invoices);
    var inSum = moves.filter(function (m) { return m.kind === 'in'; }).reduce(function (s, m) { return s + m.amount; }, 0);
    var outSum = moves.filter(function (m) { return m.kind === 'out'; }).reduce(function (s, m) { return s + m.amount; }, 0);
    var tot = inSum + outSum;
    var pct = function (v) { return tot > 0 ? Math.round(v * 100 / tot) : 0; };
    window._dashMoves = moves;
    var rows = moves.slice(0, 6).map(function (m, i) {
      return '<button type="button" class="dash-row" onclick="_dashMoves[' + i + '].open()">' +
        '<span class="dash-d">' + esc(dayLabel(m.date)) + '</span>' +
        '<span class="dash-c">' + (m.hasReceipt ? '<span class="dash-rc" title="' + esc(T('Tiene recibo', 'Has receipt')) + '">🧾</span> ' : '') + esc(m.label) + '</span>' +
        '<span class="dash-a ' + m.kind + '">' + (m.kind === 'in' ? '+' : '-') + esc(money(m.amount)) + '</span></button>';
    }).join('') || '<p class="muted" style="padding:12px 0">' + esc(T('Sin movimientos este mes.', 'No activity this month.')) + '</p>';
    var isNow = month === thisMonth();
    box.innerHTML =
      '<div class="dash-card">' +
        '<div class="dash-head"><div><h3>Dashboard</h3><div class="muted">' + esc(T('Resumen del mes', 'Month summary')) + ' · ' + esc(monthLabel(month)) + '</div></div>' +
          '<div class="dash-nav"><button type="button" class="btn ghost dash-pdf" onclick="openPnl()">⬇ ' + esc(T('Ganancias y pérdidas (PDF)', 'Profit & loss (PDF)')) + '</button>' +
          '<button type="button" class="btn ghost" aria-label="' + esc(T('Mes anterior', 'Previous month')) + '" onclick="dashMonth(-1)">‹</button>' +
          '<button type="button" class="btn ghost" aria-label="' + esc(T('Mes siguiente', 'Next month')) + '" onclick="dashMonth(1)"' + (isNow ? ' disabled' : '') + '>›</button></div></div>' +
        '<div class="dash-grid">' +
          '<div class="dash-left">' + donut(inSum, outSum) +
            '<div class="dash-legend"><span><i style="background:#DC2626"></i>' + esc(T('Gastos', 'Expenses')) + '</span><span><i style="background:#16A34A"></i>' + esc(T('Entradas', 'Money in')) + '</span></div>' +
            '<div class="dash-tiles">' +
              '<div class="dash-tile"><div class="muted"><i style="background:#DC2626"></i>' + esc(T('Gastos', 'Expenses')) + '</div><b>' + esc(money(outSum)) + '</b><div class="muted">' + pct(outSum) + '% ' + esc(T('del total', 'of total')) + '</div></div>' +
              '<div class="dash-tile"><div class="muted"><i style="background:#16A34A"></i>' + esc(T('Entradas', 'Money in')) + '</div><b>' + esc(money(inSum)) + '</b><div class="muted">' + pct(inSum) + '% ' + esc(T('del total', 'of total')) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="dash-right"><div class="dash-th"><h4>' + esc(T('Últimos movimientos', 'Latest activity')) + '</h4>' +
            (typeof openPayments === 'function' ? '<a href="#" onclick="openPayments();return false">' + esc(T('Ver todo', 'See all')) + ' ›</a>' : '') + '</div>' +
            '<div class="dash-row dash-hdr"><span class="dash-d">' + esc(T('Fecha', 'Date')) + '</span><span class="dash-c">' + esc(T('Concepto', 'Item')) + '</span><span class="dash-a">' + esc(T('Importe', 'Amount')) + '</span></div>' +
            rows + '</div>' +
        '</div>' +
        '<p class="muted dash-foot">' + esc(T('Entradas = pagos registrados en facturas. Gastos = gastos anotados en los trabajos y costo de materiales de los Job Reports.', 'Money in = payments recorded on invoices. Expenses = expenses logged on jobs and material cost from Job Reports.')) + '</p>' +
      '</div>';
  };
  window.dashMonth = function (k) {
    month = shiftMonth(month || thisMonth(), k);
    if (month > thisMonth()) month = thisMonth();
    renderHomeDash();
  };
})();
