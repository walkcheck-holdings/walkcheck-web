/* Company billing: invoices from completed jobs. Workers never load this file. */
(function () {
  function money(n) {
    return '$' + Number(n || 0).toFixed(2);
  }
  function paidSum(inv) {
    return (inv.payments || []).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
  }
  function invStatus(inv) {
    var paid = paidSum(inv);
    var tot = Number(inv.total || 0);
    if (String(inv.status).toLowerCase() === 'paid' || (tot > 0 && paid >= tot - 0.009)) return 'paid';
    var due = String(inv.dueDate || '');
    var today = ymd(new Date());
    if (due && due < today && paid < tot) return 'overdue';
    var issued = String(inv.issuedStatus || inv.status || 'not_sent').toLowerCase();
    if (issued === 'draft' || issued === 'not_sent') return 'draft';
    if (issued === 'sent') return 'sent';
    var st = String(inv.status || 'pending').toLowerCase();
    if (st === 'overdue') return 'overdue';
    return 'pending';
  }
  function statusLabel(st) {
    if (st === 'paid') return loginLang() === 'en' ? 'Paid' : 'Pagada';
    if (st === 'overdue') return loginLang() === 'en' ? 'Overdue' : 'Vencida';
    if (st === 'draft' || st === 'not_sent') return loginLang() === 'en' ? 'Draft' : 'Borrador';
    if (st === 'sent') return loginLang() === 'en' ? 'Sent' : 'Enviada';
    return loginLang() === 'en' ? 'Pending' : 'Pendiente';
  }
  function bldName(j) {
    var b = buildings.find(function (x) { return x.id === j.buildingId; });
    return (b && b.name) || j.buildingName || j.address || j.title || '—';
  }
  /* ---------- i18n + bill-to client + terms (invoice v2) ---------- */
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  // Client of a job = client of its building (who pays). Jobs without a
  // building keep their own client fields.
  function clientOf(j) {
    j = j || {};
    var b = buildings.find(function (x) { return x.id === j.buildingId; });
    if (b && (b.clientName || b.clientEmail)) {
      return { name: b.clientName || '', email: b.clientEmail || '', address: b.clientAddress || b.address || '', source: 'building', buildingId: b.id };
    }
    if (!b && (j.clientName || j.clientEmail)) {
      return { name: j.clientName || '', email: j.clientEmail || '', address: j.clientAddress || j.address || '', source: 'job' };
    }
    return { name: '', email: '', address: '', source: b ? 'building' : 'job', buildingId: b ? b.id : '' };
  }
  function clientOk(c) {
    return !!(c && String(c.name || '').trim() && /.+@.+\..+/.test(String(c.email || '').trim()));
  }
  var TERMS = { receipt: 0, net15: 15, net30: 30 };
  function termsKey(v) {
    v = String(v || '').toLowerCase();
    if (TERMS[v] != null) return v;
    if (v.indexOf('15') >= 0) return 'net15';
    if (v.indexOf('30') >= 0) return 'net30';
    return 'receipt';
  }
  function termsLabel(k) {
    k = termsKey(k);
    if (k === 'net15') return T('15 días', 'Net 15');
    if (k === 'net30') return T('30 días', 'Net 30');
    return T('Al recibir la factura', 'Due upon receipt');
  }
  function addDays(isoDay, n) {
    var d = new Date((isoDay || ymd(new Date())) + 'T12:00:00');
    d.setDate(d.getDate() + (n || 0));
    return ymd(d);
  }
  // Pagada / Pendiente / Vencida (drafts and sent invoices count as pending).
  function payStatus(inv) {
    var st = invStatus(inv);
    if (st === 'paid') return 'paid';
    if (st === 'overdue') return 'overdue';
    return 'pending';
  }
  function payStatusLabel(s) {
    if (s === 'paid') return T('Pagada', 'Paid');
    if (s === 'overdue') return T('Vencida', 'Overdue');
    return T('Pendiente', 'Pending');
  }
  function fmtDay(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function logoHtml(name, size) {
    size = size || 44;
    var data = companyLogoData || '';
    return data
      ? '<img src="' + esc(data) + '" alt="" style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;border-radius:8px">'
      : '<div class="rpt-logo" style="width:' + size + 'px;height:' + size + 'px">' + esc(String(name || 'W').charAt(0)) + '</div>';
  }
  function partiesHtml(inv, c) {
    var ok = clientOk(c);
    return '<div class="inv-parties" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0">' +
      '<div class="card" style="margin:0"><div class="muted" style="font-weight:800;font-size:12px;text-transform:uppercase">' + esc(T('De', 'From')) + '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-top:6px">' + logoHtml(inv.companyName || companyName) +
        '<b>' + esc(inv.companyName || companyName || '') + '</b></div></div>' +
      '<div class="card" style="margin:0;' + (ok ? '' : 'border:1.5px solid #F5B971;background:#FFFAF2') + '"><div class="muted" style="font-weight:800;font-size:12px;text-transform:uppercase">' + esc(T('Facturar a', 'Bill to')) + '</div>' +
        (ok
          ? '<div style="margin-top:6px"><b>' + esc(c.name) + '</b><div class="muted">' + esc(c.email) + '</div>' + (c.address ? '<div class="muted">' + esc(c.address) + '</div>' : '') + '</div>'
          : '<p style="margin:6px 0;color:#9A5B00;font-weight:700">' + esc(T('Falta el cliente de este edificio.', 'This building has no client yet.')) + '</p>') +
        (inv.jobId ? '<button type="button" class="btn ghost" style="margin-top:6px;width:auto" onclick="openClientEditor(\'' + inv.jobId + '\')">' +
          esc(ok ? T('Editar cliente', 'Edit client') : T('Registrar cliente', 'Add client')) + '</button>' : '') +
      '</div></div>';
  }
  window.invoiceClientOf = clientOf;

  // Register / edit who pays for the building (or the job, if it has none).
  window.openClientEditor = function (jobId, afterSave) {
    if (!canSeeMoney()) return;
    var j = jobs.find(function (x) { return x.id === jobId; }) || {};
    var c = clientOf(j);
    var b = buildings.find(function (x) { return x.id === j.buildingId; });
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:460px;max-width:96vw">' +
      '<h3>' + esc(T('Cliente que paga', 'Client who pays')) + '</h3>' +
      '<p class="muted">' + esc(b ? T('Edificio: ', 'Building: ') + (b.name || '') : T('Este trabajo no tiene edificio: el cliente se guarda en el trabajo.', 'This job has no building: the client is saved on the job.')) + '</p>' +
      '<p class="muted">' + esc(T('El dueño o la administradora del edificio. Recibe las facturas y el reporte mensual.', 'The building owner or management company. Receives invoices and the monthly report.')) + '</p>' +
      '<label class="muted">' + esc(T('Nombre', 'Name')) + '</label><input id="clName" type="text" value="' + esc(c.name) + '">' +
      '<label class="muted">' + esc(T('Correo', 'Email')) + '</label><input id="clEmail" type="email" value="' + esc(c.email) + '">' +
      '<label class="muted">' + esc(T('Dirección (opcional)', 'Address (optional)')) + '</label><input id="clAddr" type="text" value="' + esc(c.address) + '">' +
      '<div class="err" id="clErr"></div>' +
      '<button class="btn" onclick="saveClient(\'' + jobId + '\')">' + esc(T('Guardar cliente', 'Save client')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
    $('modal')._afterClient = afterSave || null;
  };
  window.saveClient = async function (jobId) {
    var err = $('clErr');
    var c = { name: ($('clName').value || '').trim(), email: ($('clEmail').value || '').trim().toLowerCase(), address: ($('clAddr').value || '').trim() };
    if (!clientOk(c)) { err.textContent = T('Pon el nombre y un correo válido.', 'Enter the name and a valid email.'); return; }
    var j = jobs.find(function (x) { return x.id === jobId; }) || {};
    var b = buildings.find(function (x) { return x.id === j.buildingId; });
    var data = { clientName: c.name, clientEmail: c.email, clientAddress: c.address };
    try {
      if (b) {
        try {
          await db.collection('buildings').doc(b.id).update(data);
        } catch (_) {
          await db.collection('companies').doc(cid()).collection('buildings').doc(b.id).set(data, { merge: true });
        }
        Object.assign(b, data);
      } else {
        await db.collection('jobs').doc(jobId).set(data, { merge: true });
        Object.assign(j, data);
      }
    } catch (e) { err.textContent = e.message || e; return; }
    var next = $('modal')._afterClient;
    $('modal').classList.add('hidden');
    if (typeof next === 'function') next();
  };

  /* ---------- formal PDF (same file for download and email) ---------- */
  function buildInvoicePdf(inv) {
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) throw new Error(T('No se pudo cargar el generador de PDF. Recarga la página.', 'PDF generator did not load. Reload the page.'));
    var doc = new JsPDF({ unit: 'pt', format: 'letter' });
    var W = doc.internal.pageSize.getWidth(), M = 48, y = 48;
    var c = { name: inv.client || '', email: inv.clientEmail || '', address: inv.clientAddress || '' };
    var green = [22, 101, 52], gray = [107, 114, 128], dark = [17, 24, 39];
    // Header: company logo + name (never WalkCheck's logo)
    if (companyLogoData) {
      try { doc.addImage(companyLogoData, companyLogoData.indexOf('image/png') > 0 ? 'PNG' : 'JPEG', M, y - 6, 56, 56, undefined, 'FAST'); } catch (_) {}
    } else {
      doc.setFillColor(green[0], green[1], green[2]); doc.roundedRect(M, y - 6, 56, 56, 8, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
      doc.text(String(inv.companyName || 'W').charAt(0).toUpperCase(), M + 28, y + 31, { align: 'center' });
    }
    doc.setTextColor(dark[0], dark[1], dark[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(String(inv.companyName || ''), M + 70, y + 14);
    doc.setFontSize(24); doc.setTextColor(green[0], green[1], green[2]);
    doc.text(T('FACTURA', 'INVOICE'), W - M, y + 14, { align: 'right' });
    doc.setFontSize(10); doc.setTextColor(gray[0], gray[1], gray[2]); doc.setFont('helvetica', 'normal');
    var meta = [
      [T('Número', 'Number'), '#' + (inv.number || '')],
      [T('Emitida', 'Issued'), fmtDay(inv.issueDate)],
      [T('Vence', 'Due'), fmtDay(inv.dueDate)],
      [T('Estado', 'Status'), payStatusLabel(payStatus(inv))]
    ];
    var my = y + 32;
    meta.forEach(function (m) {
      doc.setTextColor(gray[0], gray[1], gray[2]); doc.text(m[0] + ':', W - M - 110, my);
      doc.setTextColor(dark[0], dark[1], dark[2]); doc.text(String(m[1]), W - M, my, { align: 'right' });
      my += 14;
    });
    y = Math.max(y + 90, my + 10);
    // Bill to
    doc.setDrawColor(229, 231, 235); doc.line(M, y, W - M, y); y += 20;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(T('FACTURAR A', 'BILL TO'), M, y);
    doc.text(T('TRABAJO', 'JOB'), W / 2 + 10, y);
    y += 14; doc.setFontSize(11); doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(c.name || '—', M, y);
    doc.text((inv.kind || '') + (inv.jobNumber ? '  #' + inv.jobNumber : ''), W / 2 + 10, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(gray[0], gray[1], gray[2]);
    var by = y + 14, jy = y + 14;
    if (c.email) { doc.text(c.email, M, by); by += 13; }
    if (c.address) { doc.splitTextToSize(c.address, W / 2 - M - 10).forEach(function (l) { doc.text(l, M, by); by += 13; }); }
    doc.splitTextToSize(String(inv.building || inv.address || ''), W / 2 - M - 10).forEach(function (l) { doc.text(l, W / 2 + 10, jy); jy += 13; });
    y = Math.max(by, jy) + 16;
    // Lines table
    var cols = [M, M + 150, W - M - 170, W - M - 95, W - M];
    doc.setFillColor(243, 244, 246); doc.rect(M, y - 12, W - 2 * M, 22, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(T('TIPO DE TRABAJO', 'JOB TYPE'), cols[0] + 6, y + 2);
    doc.text(T('DESCRIPCIÓN', 'DESCRIPTION'), cols[1], y + 2);
    doc.text(T('CANT.', 'QTY'), cols[2] + 20, y + 2, { align: 'right' });
    doc.text(T('PRECIO', 'PRICE'), cols[3] + 30, y + 2, { align: 'right' });
    doc.text('SUBTOTAL', cols[4] - 6, y + 2, { align: 'right' });
    y += 24; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    (inv.lines || []).forEach(function (l) {
      var nameL = doc.splitTextToSize(String(l.name || inv.kind || ''), cols[1] - cols[0] - 12);
      var descL = doc.splitTextToSize(String(l.desc || ''), cols[2] - cols[1] - 30);
      var h = Math.max(nameL.length, descL.length, 1) * 13;
      if (y + h > 700) { doc.addPage(); y = 60; }
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(nameL, cols[0] + 6, y);
      doc.setTextColor(gray[0], gray[1], gray[2]); doc.text(descL, cols[1], y);
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(String(l.qty || 1), cols[2] + 20, y, { align: 'right' });
      doc.text(money(l.unitPrice != null ? l.unitPrice : l.amount), cols[3] + 30, y, { align: 'right' });
      doc.text(money(l.amount), cols[4] - 6, y, { align: 'right' });
      y += h + 8; doc.setDrawColor(229, 231, 235); doc.line(M, y - 6, W - M, y - 6);
    });
    // Totals
    y += 8;
    var tx = W - M - 170;
    var pct = Math.round(Number(inv.taxRate || 0) * 10000) / 100;
    [[T('Subtotal', 'Subtotal'), money(inv.subtotal)], [T('Impuesto', 'Tax') + ' (' + pct + '%)', money(inv.tax)]].forEach(function (r) {
      doc.setTextColor(gray[0], gray[1], gray[2]); doc.text(r[0], tx, y);
      doc.setTextColor(dark[0], dark[1], dark[2]); doc.text(r[1], W - M - 6, y, { align: 'right' }); y += 16;
    });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(T('Total', 'Total'), tx, y + 4); doc.text(money(inv.total), W - M - 6, y + 4, { align: 'right' });
    y += 34;
    // Terms
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text(T('Términos de pago: ', 'Payment terms: ') + termsLabel(inv.paymentTerms) + ' · ' + T('Vence el ', 'Due ') + fmtDay(inv.dueDate), M, y);
    doc.setFontSize(8);
    doc.text(String(inv.companyName || ''), M, 760);
    return doc;
  }
  function pdfName(inv) {
    return T('Factura-', 'Invoice-') + (inv.number || 'borrador') + '.pdf';
  }
  window.invoicePdfBlob = function (inv) { return buildInvoicePdf(inv).output('blob'); };

  window.priceOfKind = function (kind) {
    var slug = slugify(kind);
    var p = typePrices[slug] || typePrices[String(kind || '').toLowerCase()];
    return p && p.amount != null ? Number(p.amount) : 0;
  };
  window.loadTypePrices = async function () {
    typePrices = {};
    if (!canSeeMoney() || !cid()) return;
    try {
      var snap = await db.collection('companies').doc(cid()).collection('typePrices').limit(80).get();
      snap.forEach(function (d) { typePrices[d.id] = d.data() || {}; });
    } catch (_) {}
  };
  window.saveTypePrice = async function (kind, amount) {
    if (!canSeeMoney()) return;
    var slug = slugify(kind);
    if (!slug) return;
    amount = Number(amount);
    if (!(amount >= 0)) return;
    await db.collection('companies').doc(cid()).collection('typePrices').doc(slug).set({
      slug: slug, kind: kind, amount: amount, companyId: cid(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    typePrices[slug] = { slug: slug, kind: kind, amount: amount };
  };

  window.openBilling = async function () {
    if (!canSeeMoney()) { alert('El dinero de cada compañía es privado.'); return; }
    closeMore();
    document.body.classList.add('view-billing');
    document.body.classList.remove('view-hours', 'view-roles', 'view-worker', 'view-companies', 'view-reports', 'view-archived', 'sites-open');
    if (typeof markNav === 'function') markNav('money');
    var pane = $('billingPane');
    if (!pane) return;
    pane.innerHTML = '<p class="muted">Cargando…</p>';
    var invoices = [];
    try {
      var snap = await db.collection('companies').doc(cid()).collection('invoices').limit(120).get();
      snap.forEach(function (d) { invoices.push(Object.assign({ id: d.id }, d.data())); });
    } catch (e) {
      pane.innerHTML = '<div class="card"><h3>' + esc(uiT('money')) + '</h3><p class="err">' + esc(e.message || e) + '</p></div>';
      return;
    }
    invoices.sort(function (a, b) { return String(b.number || '').localeCompare(String(a.number || '')); });
    var paid = 0, pend = 0, over = 0;
    invoices.forEach(function (inv) {
      var st = invStatus(inv);
      if (st === 'paid') paid += Number(inv.total || 0);
      else if (st === 'overdue') over += Number(inv.total || 0);
      else pend += Number(inv.total || 0);
    });
    var types = allTypes(true);
    var priceRows = types.map(function (t) {
      var amt = priceOfKind(t.name);
      return '<div class="price-row"><span style="min-width:180px;font-weight:700">' + esc(t.name) + '</span>' +
        '<input type="number" min="0" step="0.01" value="' + (amt || '') + '" data-kind="' + esc(t.name) + '">' +
        '</div>';
    }).join('');
    var list = invoices.map(function (inv) {
      var ps = payStatus(inv);
      return '<div class="inv-row">' +
        '<div><b>#' + esc(inv.number) + '</b> · ' + money(inv.total) +
        '<div class="muted">' + esc(inv.client || T('Sin cliente', 'No client')) + ' · ' + esc(inv.building || '') + ' · ' + esc(fmtDay(inv.issueDate)) + '</div></div>' +
        '<span class="st-pill ' + (ps === 'paid' ? 'on' : 'off') + '">' + esc(payStatusLabel(ps)) + '</span>' +
        '<button type="button" class="btn ghost" onclick="openInvoice(\'' + inv.id + '\')">' + esc(T('Abrir', 'Open')) + '</button>' +
        '</div>';
    }).join('') || '<p class="muted">' + esc(T('Todavía no hay facturas. Completa un trabajo y pulsa Nueva factura.', 'No invoices yet. Complete a job and press New invoice.')) + '</p>';
    pane.innerHTML =
      '<div class="inv-kpis">' +
        '<div class="inv-kpi"><span>' + esc(T('Pagada', 'Paid')) + '</span><b>' + money(paid) + '</b></div>' +
        '<div class="inv-kpi"><span>' + esc(T('Pendiente', 'Pending')) + '</span><b>' + money(pend) + '</b></div>' +
        '<div class="inv-kpi"><span>' + esc(T('Vencida', 'Overdue')) + '</span><b>' + money(over) + '</b></div>' +
      '</div>' +
      '<div class="card"><h3 style="margin:0 0 8px">' + esc(T('Logo de la compañía', 'Company logo')) + '</h3>' +
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' + logoHtml(companyName, 56) +
        '<div style="flex:1;min-width:180px"><p class="muted" style="margin:0 0 6px">' + esc(T('Sale en tus facturas y en el PDF. Usa un PNG o JPG cuadrado.', 'Shown on your invoices and PDF. Use a square PNG or JPG.')) + '</p>' +
        '<input id="logoFile" type="file" accept="image/png,image/jpeg" onchange="saveCompanyLogo(this)"></div></div>' +
        '<div class="err" id="logoErr"></div></div>' +
      // Card payments: each company connects its own Stripe (money goes to it).
      '<div class="card" id="payCard"><h3 style="margin:0 0 8px">💳 ' + esc(T('Cobrar con tarjeta', 'Get paid by card')) + '</h3>' +
        '<p class="muted" style="margin:0 0 8px">' + esc(T('Conecta tu cuenta de Stripe y cada factura que envíes llevará el botón "Pagar en línea". El dinero va directo a tu cuenta y la factura se marca Pagada sola.', 'Connect your Stripe account and every invoice you send gets a "Pay online" button. The money goes straight to you and the invoice is marked Paid by itself.')) + '</p>' +
        '<div id="payState" class="muted">' + esc(T('Revisando…', 'Checking…')) + '</div></div>' +
      '<div class="card"><h3 style="margin:0 0 8px">' + esc(uiT('money')) + '</h3>' +
      '<p class="muted">' + esc(T('Precios por tipo de trabajo (solo dueño). El técnico no los ve.', 'Prices per job type (owner only). Technicians never see them.')) + '</p>' +
      '<label class="muted">' + esc(T('Impuesto %', 'Tax %')) + '</label>' +
      '<input id="taxPct" type="number" min="0" step="0.1" value="' + (Number(companyTaxRate || 0) * 100) + '">' +
      priceRows +
      '<button class="btn" style="margin-top:10px" onclick="saveBillingSettings()">' + esc(T('Guardar precios', 'Save prices')) + '</button></div>' +
      list +
      '<button class="btn ghost" onclick="document.body.classList.remove(\'view-billing\');renderSchedule()">' + esc(T('Volver al horario', 'Back to schedule')) + '</button>';
    refreshPayState();
  };

  /* ---------- Card payments (Stripe Connect, functions-stripe) ---------- */
  var FN = 'https://us-central1-walkcheck-a4f1e.cloudfunctions.net/';
  window.companyCanTakeCards = false;
  async function connectCall(action) {
    var tok = await auth.currentUser.getIdToken();
    var r = await fetch(FN + 'connectOnboard' + (action ? '?action=' + action : ''), {
      method: action ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + tok }
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  async function refreshPayState() {
    var box = $('payState');
    if (!box) return;
    try {
      var s = await connectCall('status');
      window.companyCanTakeCards = !!s.chargesEnabled;
      if (s.chargesEnabled) {
        box.innerHTML = '<span class="st-pill on">' + esc(T('Activo', 'Active')) + '</span> ' +
          esc(T('Tus facturas ya llevan "Pagar en línea".', 'Your invoices now include "Pay online".'));
      } else {
        box.innerHTML = (s.connected ? '<p>' + esc(T('Falta terminar los datos en Stripe (banco, identidad).', 'Finish your details in Stripe (bank, identity).')) + '</p>' : '') +
          (canManageRoles() ? '<button class="btn" style="width:auto" onclick="startConnect()">' + esc(s.connected ? T('Terminar en Stripe', 'Finish in Stripe') : T('Conectar mi Stripe', 'Connect my Stripe')) + '</button>'
            : '<p class="muted">' + esc(T('Solo el dueño puede conectarlo.', 'Only the owner can connect it.')) + '</p>');
      }
    } catch (e) {
      box.textContent = T('No se pudo revisar el cobro con tarjeta: ', 'Could not check card payments: ') + (e.message || e);
    }
  }
  window.startConnect = async function () {
    var box = $('payState');
    if (box) box.textContent = T('Abriendo Stripe…', 'Opening Stripe…');
    try { var j = await connectCall(''); location.href = j.url; }
    catch (e) { if (box) box.textContent = T('No se pudo abrir Stripe: ', 'Could not open Stripe: ') + (e.message || e); }
  };
  // Back from Stripe onboarding → open Billing to show the new state.
  if (/[?&]connect=(done|refresh)/.test(location.search)) {
    setTimeout(function () { try { openBilling(); } catch (_) {} }, 2500);
  }
  function randToken() {
    var a = new Uint8Array(18); crypto.getRandomValues(a);
    return Array.from(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function payLink(id, token) {
    return 'https://walkcheck.app/pagar/?c=' + encodeURIComponent(cid()) + '&i=' + encodeURIComponent(id) + '&t=' + token + '&lang=' + loginLang();
  }

  // Logo: resized to max 256px and stored on the company doc (small data URL),
  // so invoices and PDFs can use it without storage/CORS issues.
  window.saveCompanyLogo = function (input) {
    var f = input && input.files && input.files[0];
    var err = $('logoErr');
    if (!f) return;
    var img = new Image();
    var reader = new FileReader();
    reader.onload = function () { img.src = reader.result; };
    img.onload = async function () {
      var max = 256, s = Math.min(1, max / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var data = cv.toDataURL('image/png');
      try {
        await db.collection('companies').doc(cid()).set({ logoData: data }, { merge: true });
        companyLogoData = data;
        openBilling();
      } catch (e) { if (err) err.textContent = e.message || e; }
    };
    img.onerror = function () { if (err) err.textContent = T('No se pudo leer la imagen.', 'Could not read the image.'); };
    reader.readAsDataURL(f);
  };

  window.saveBillingSettings = async function () {
    if (!canSeeMoney()) return;
    var pct = Number(($('taxPct') && $('taxPct').value) || 0);
    companyTaxRate = (isNaN(pct) ? 0 : pct) / 100;
    try {
      await db.collection('companies').doc(cid()).set({ taxRate: companyTaxRate }, { merge: true });
      var inputs = document.querySelectorAll('#billingPane input[data-kind]');
      for (var i = 0; i < inputs.length; i++) {
        await saveTypePrice(inputs[i].getAttribute('data-kind'), inputs[i].value || 0);
      }
      openBilling();
    } catch (e) { alert(e.message || e); }
  };

  window.draftInvoiceFromJob = function (j) {
    var src = (typeof jobLines === 'function' ? jobLines(j) : []) || [];
    var lines = src.map(function (l) {
      return {
        name: l.name || '',
        desc: l.description || l.desc || '',
        qty: Number(l.qty || 1),
        unitPrice: Number(l.unitPrice != null ? l.unitPrice : l.amount || 0),
        amount: Number(l.total != null ? l.total : Number(l.qty || 1) * Number(l.unitPrice || l.amount || 0))
      };
    });
    if (!lines.length) {
      // Start with the job's own type (if it is one of the company's types),
      // priced from Billing; otherwise blank so the office picks it.
      var known = allTypes(true).some(function (t) { return t.name === j.kind; });
      var kind = known ? j.kind : '';
      var p0 = kind ? priceOfKind(kind) : 0;
      lines = [{ name: kind, desc: j.description || j.instructions || '', qty: 1, unitPrice: p0, amount: p0 }];
    }
    // Materials the tech or the office logged on the job go in on their own
    // line each, so nobody types them again (skipped if already on a line).
    (typeof jobExpenses === 'function' ? jobExpenses(j) : []).forEach(function (e) {
      var tot = Number(e.total || 0);
      if (!(tot > 0)) return;
      var desc = [e.items, e.vendor].filter(Boolean).join(' · ');
      if (lines.some(function (l) { return l.desc === desc && Number(l.amount) === tot; })) return;
      lines.push({ name: T('Materiales', 'Materials'), desc: desc, qty: 1, unitPrice: tot, amount: tot });
    });
    var sub = lines.reduce(function (s, l) { return s + Number(l.amount || 0); }, 0);
    var chargeTax = !(typeof isPm === 'function' && isPm());
    var taxRate = chargeTax ? Number(companyTaxRate || 0) : 0;
    var tax = +(sub * taxRate).toFixed(2);
    return {
      jobId: j.id,
      jobNumber: j.jobNumber || '',
      kind: j.kind || j.title || '',
      companyName: companyName || j.companyName || '',
      building: bldName(j),
      address: j.address || bldName(j),
      client: j.clientName || j.contactName || '',
      clientEmail: j.contactEmail || '',
      description: j.instructions || j.description || '',
      issueDate: ymd(new Date()),
      dueDate: ymd(new Date()),
      paymentTerms: 'Due upon receipt',
      salesperson: (profile && (profile.displayName || profile.email)) || '',
      issuedStatus: 'draft',
      chargeTax: chargeTax,
      lines: lines,
      subtotal: sub,
      taxRate: taxRate,
      tax: tax,
      total: +(sub + tax).toFixed(2),
      status: 'draft',
      sends: [],
      payments: [],
      notesLog: [],
      quoteAttachments: j.quoteAttachments || []
    };
  };

  window.openInvoiceEditor = function (jobId, existing) {
    if (!canSeeMoney()) return;
    var j = jobs.find(function (x) { return x.id === jobId; }) || {};
    if (jobArchived(j) && !existing) { alert(loginLang() === 'en' ? 'Archived jobs are not invoiced.' : 'Un trabajo archivado no se factura.'); return; }
    var draft = existing || draftInvoiceFromJob(j);
    var c = clientOf(j);
    if (!clientOk(c) && existing && clientOk({ name: existing.client, email: existing.clientEmail })) {
      c = { name: existing.client, email: existing.clientEmail, address: existing.clientAddress || '' };
    }
    var ok = clientOk(c);
    draft.paymentTerms = termsKey(draft.paymentTerms);
    $('modal').classList.remove('hidden');
    // How this trade usually charges (pie², hora, visita…), shown next to Qty.
    var unitEs = ((window.tradePack && typeof companyType !== 'undefined') ? (tradePack(companyType).unit || '') : '');
    var UNIT_EN = { 'visita': 'visit', 'hora': 'hour', 'pie²': 'sq ft', 'pie lineal': 'linear ft', 'yarda³': 'cu yd', 'trabajo': 'job' };
    var unit = unitEs ? T(unitEs, UNIT_EN[unitEs] || unitEs) : '';
    var qtyLbl = T('Cant.', 'Qty') + (unit ? ' (' + unit + ')' : '');
    var head = '<div class="line-row inv-line-head" style="grid-template-columns:1fr 2fr 70px 90px;font-size:12px;font-weight:800;color:#6B7280">' +
      '<span>' + esc(T('Tipo de trabajo', 'Job type')) + '</span><span>' + esc(T('Descripción', 'Description')) + '</span>' +
      '<span>' + esc(qtyLbl) + '</span><span>' + esc(T('Precio', 'Price')) + '</span></div>';
    // Each line = ONE job type picked from the company's types; picking it
    // fills that type's price (set in Billing). More types = "+ Agregar línea".
    var typeNames = allTypes(true).map(function (t) { return t.name; });
    // For work done on site that was not planned (price typed by hand).
    var extraName = T('Trabajo extra (no programado)', 'Extra work (not scheduled)');
    function typeSelect(i, cur) {
      var names = typeNames.slice();
      if (cur && names.indexOf(cur) < 0) names.unshift(cur);
      return '<select data-lname="' + i + '" onchange="pickInvoiceType(' + i + ', this.value)">' +
        '<option value="">' + esc(T('Elige el tipo…', 'Pick the type…')) + '</option>' +
        names.map(function (n) { return '<option value="' + esc(n) + '"' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
        (names.indexOf(extraName) < 0 ? '<option value="' + esc(extraName) + '"' + (cur === extraName ? ' selected' : '') + '>' + esc(extraName) + '</option>' : '') +
        '</select>';
    }
    var lineHtml = (draft.lines || []).map(function (l, i) {
      return '<div class="line-row inv-line" style="grid-template-columns:1fr 2fr 70px 90px">' +
        typeSelect(i, l.name || '') +
        '<textarea data-ldesc="' + i + '" rows="3">' + esc(l.desc || '') + '</textarea>' +
        '<input data-lqty="' + i + '" type="number" min="0" step="any" value="' + Number(l.qty || 1) + '" placeholder="' + esc(qtyLbl) + '" title="' + esc(T('Cantidad', 'Quantity')) + '">' +
        '<input data-lamt="' + i + '" type="number" min="0" step="0.01" value="' + Number(l.unitPrice != null ? l.unitPrice : l.amount || 0) + '" placeholder="' + esc(T('Precio', 'Price')) + '" title="' + esc(T('Precio', 'Price')) + '">' +
        '</div>';
    }).join('');
    var termsOpts = ['receipt', 'net15', 'net30'].map(function (k) {
      return '<option value="' + k + '"' + (draft.paymentTerms === k ? ' selected' : '') + '>' + esc(termsLabel(k)) + '</option>';
    }).join('');
    $('modal').innerHTML = '<div class="box" style="width:620px;max-width:96vw">' +
      '<h3>' + (existing && existing.number ? esc(T('Factura #', 'Invoice #') + existing.number) : esc(uiT('newInvoice'))) + '</h3>' +
      '<p class="muted">' + esc(T('Trabajo #', 'Job #') + (draft.jobNumber || '') + ' · ' + (draft.kind || '') + ' · ' + (draft.building || '')) + '</p>' +
      partiesHtml(draft, c) +
      head + lineHtml +
      '<p class="muted" style="margin:4px 0">' + (unit ? esc(T('La cantidad va en ' + unitEs + '. ', 'Quantity is in ' + unit + '. ')) : '') + esc(T('El precio se puede cambiar en cada línea. Si se hizo algo que no estaba programado, agrega una línea con “Trabajo extra” y escribe qué se hizo y su precio.', 'You can change the price on each line. For work that was not scheduled, add a line with “Extra work” and type what was done and its price.')) + '</p>' +
      '<button type="button" class="btn ghost" onclick="addInvoiceLine()">' + esc(T('+ Agregar línea', '+ Add line')) + '</button>' +
      '<label class="muted">' + esc(T('Términos de pago', 'Payment terms')) + '</label><select id="invTerms">' + termsOpts + '</select>' +
      '<label class="muted">' + esc(T('Fecha de emisión', 'Issue date')) + '</label><input id="invIssue" type="date" value="' + esc(draft.issueDate || ymd(new Date())) + '">' +
      '<label><input type="checkbox" id="invTax"' + (draft.chargeTax ? ' checked' : '') + '> ' +
        esc(T('Cobrar impuesto (' + Math.round(Number(companyTaxRate || 0) * 10000) / 100 + '% — se cambia en Facturación)', 'Charge tax (' + Math.round(Number(companyTaxRate || 0) * 10000) / 100 + '% — set in Billing)')) + '</label>' +
      '<p class="muted">' + esc(T('Se guarda como Pendiente. Para enviarla al cliente hacen falta fotos de antes y después del trabajo.', 'Saved as Pending. Sending it to the client needs before and after work photos.')) + '</p>' +
      '<div class="err" id="invErr"></div>' +
      (ok
        ? '<button class="btn" onclick="saveInvoiceFromEditor(\'' + esc(jobId) + '\',' + (existing && existing.id ? '\'' + existing.id + '\'' : 'null') + ')">' + esc(T('Guardar factura', 'Save invoice')) + '</button>'
        : '<button class="btn" style="background:#F59E0B" onclick="openClientEditor(\'' + esc(jobId) + '\', function(){ openInvoiceEditor(\'' + esc(jobId) + '\', $(\'modal\')._draftKeep) })">' + esc(T('Registrar cliente para poder facturar', 'Add client to invoice')) + '</button>') +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
    $('modal')._draft = draft;
    $('modal')._draftKeep = existing || null;
  };
  // Picking a type fills its price from Billing (only if the price is empty/0).
  window.pickInvoiceType = function (i, name) {
    var amt = document.querySelector('#modal [data-lamt="' + i + '"]');
    var p = priceOfKind(name);
    if (amt && p > 0 && !(Number(amt.value) > 0)) amt.value = p;
  };
  window.addInvoiceLine = function () {
    var d = $('modal')._draft; if (!d) return;
    d.lines = readEditorLines(d);
    d.lines.push({ name: '', desc: '', qty: 1, unitPrice: 0, amount: 0 });
    d.paymentTerms = ($('invTerms') && $('invTerms').value) || d.paymentTerms;
    d.issueDate = ($('invIssue') && $('invIssue').value) || d.issueDate;
    openInvoiceEditor(d.jobId, d);
  };
  function readEditorLines(draft) {
    var names = document.querySelectorAll('#modal [data-lname]');
    var descs = document.querySelectorAll('#modal [data-ldesc]');
    var qtys = document.querySelectorAll('#modal [data-lqty]');
    var amts = document.querySelectorAll('#modal [data-lamt]');
    var lines = [];
    var n = names.length || descs.length;
    for (var i = 0; i < n; i++) {
      var qty = Number((qtys[i] && qtys[i].value) || 1);
      var unit = Number((amts[i] && amts[i].value) || 0);
      lines.push({
        name: (names[i] && names[i].value.trim()) || '',
        desc: (descs[i] && descs[i].value.trim()) || '',
        qty: qty, unitPrice: unit, amount: +(qty * unit).toFixed(2)
      });
    }
    return lines.length ? lines : draft.lines;
  }
  window.saveInvoiceFromEditor = async function (jobId, invId) {
    if (!canSeeMoney()) return;
    var err = $('invErr');
    var j = jobs.find(function (x) { return x.id === jobId; }) || {};
    if (jobArchived(j)) { if (err) err.textContent = 'Un trabajo archivado no se factura.'; return; }
    var draft = $('modal')._draft || draftInvoiceFromJob(j);
    // Bill-to is required: no client, no invoice.
    var c = clientOf(j);
    if (!clientOk(c) && clientOk({ name: draft.client, email: draft.clientEmail })) {
      c = { name: draft.client, email: draft.clientEmail, address: draft.clientAddress || '' };
    }
    if (!clientOk(c)) { if (err) err.textContent = T('Primero registra el cliente que paga.', 'Add the paying client first.'); return; }
    draft.client = c.name; draft.clientEmail = c.email; draft.clientAddress = c.address || '';
    draft.lines = readEditorLines(draft);
    draft.paymentTerms = termsKey(($('invTerms') && $('invTerms').value) || 'receipt');
    draft.issueDate = ($('invIssue') && $('invIssue').value) || draft.issueDate || ymd(new Date());
    draft.dueDate = addDays(draft.issueDate, TERMS[draft.paymentTerms] || 0);
    draft.companyName = companyName || draft.companyName || '';
    draft.chargeTax = !!($('invTax') && $('invTax').checked);
    draft.subtotal = draft.lines.reduce(function (s, l) { return s + Number(l.amount || 0); }, 0);
    draft.taxRate = draft.chargeTax ? Number(companyTaxRate || 0) : 0;
    draft.tax = +(draft.subtotal * draft.taxRate).toFixed(2);
    draft.total = +(draft.subtotal + draft.tax).toFixed(2);
    if (!invId) {
      draft.issuedStatus = 'draft';
      draft.status = 'draft';
    }
    draft.companyId = cid();
    draft.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
      var coRef = db.collection('companies').doc(cid());
      var col = coRef.collection('invoices');
      if (invId) {
        await col.doc(invId).set(draft, { merge: true });
        $('modal').classList.add('hidden');
        openInvoice(invId);
        return;
      }
      var newId = '';
      await db.runTransaction(async function (tx) {
        var co = await tx.get(coRef);
        var n = ((co.exists && co.data().invoiceSeq) || 0) + 1;
        var now = new Date();
        var num = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(n).padStart(4, '0');
        var ref = col.doc();
        newId = ref.id;
        draft.number = num;
        draft.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        draft.createdBy = auth.currentUser && auth.currentUser.uid;
        tx.set(coRef, { invoiceSeq: n }, { merge: true });
        tx.set(ref, draft);
      });
      await db.collection('jobs').doc(jobId).set({ invoiceId: newId, invoiced: true }, { merge: true });
      $('modal').classList.add('hidden');
      openInvoice(newId);
    } catch (e) { if (err) err.textContent = e.message || e; }
  };

  function jobPhotos(j) {
    var before = typeof jobBeforePhotos === 'function' ? jobBeforePhotos(j) : [];
    var after = typeof jobAfterPhotos === 'function' ? jobAfterPhotos(j) : [];
    return before.concat(after);
  }
  function canSendInvoice(j) {
    return typeof jobHasWorkPhotos === 'function' ? jobHasWorkPhotos(j) : (jobPhotos(j).length > 0);
  }
  window.openInvoice = async function (id) {
    if (!canSeeMoney()) return;
    var inv = null;
    try {
      var d = await db.collection('companies').doc(cid()).collection('invoices').doc(id).get();
      if (d.exists) inv = Object.assign({ id: d.id }, d.data());
    } catch (e) { alert(e.message || e); return; }
    if (!inv) return;
    var st = invStatus(inv);
    var paid = paidSum(inv);
    var dueAmt = Math.max(0, Number(inv.total || 0) - paid);
    var rows = (inv.lines || []).map(function (l) {
      return '<tr><td><b>' + esc(l.name || l.desc || '') + '</b><div class="muted" style="white-space:pre-wrap">' + esc(l.desc || '') +
        '</div></td><td>' + esc(l.qty || 1) + '</td><td>' + money(l.unitPrice != null ? l.unitPrice : l.amount) + '</td><td>' + money(l.amount) + '</td></tr>';
    }).join('');
    var sends = (inv.sends || []).map(function (s) {
      return '<div class="muted">' + esc(s.channel) + ' · ' + esc(s.to || '') + ' · ' + esc(s.at || '') + '</div>';
    }).join('') || '<p class="muted">Not sent yet</p>';
    var pays = (inv.payments || []).map(function (p) {
      return '<div class="muted">' + money(p.amount) + ' · ' + esc(p.date || '') + ' · ' + esc(p.method || '') + '</div>';
    }).join('') || '<p class="muted">' + esc(loginLang() === 'en' ? 'No payments' : 'Sin pagos') + '</p>';
    var notes = (inv.notesLog || []).map(function (n) {
      return '<div class="note-item"><div class="muted">' + esc(n.authorName || '') + '</div>' + esc(n.text || '') + '</div>';
    }).join('');
    if ($('viewJobs')) $('viewJobs').classList.add('hidden');
    document.body.classList.add('view-billing');
    document.body.classList.remove('view-hours', 'view-roles', 'view-worker', 'view-companies', 'view-reports', 'view-archived', 'sites-open', 'view-jobs', 'view-job', 'view-home', 'view-search');
    var jobOfInv = jobs.find(function (x) { return x.id === inv.jobId; }) || {};
    var c = { name: inv.client || '', email: inv.clientEmail || '', address: inv.clientAddress || '' };
    if (!clientOk(c)) c = clientOf(jobOfInv);
    var hasClient = clientOk(c);
    var photosOk = canSendInvoice(jobOfInv, inv);
    var ps = payStatus(inv);
    var sendBlock = !hasClient
      ? '<p class="muted" style="color:#9A5B00">' + esc(T('Para enviarla falta el cliente que paga.', 'To send it, add the paying client.')) + '</p>'
      : !photosOk
        ? '<p class="muted">' + esc(T('Para enviarla, sube fotos de ANTES y DESPUÉS del trabajo.', 'To send it, upload BEFORE and AFTER job photos.')) + '</p>'
        : '<button class="btn" onclick="openEmailInvoice(\'' + id + '\')">' + esc(T('Enviar al cliente', 'Send to client')) + '</button>';
    sends = (inv.sends || []).map(function (s) {
      return '<div class="muted">' + esc(s.channel === 'email' ? T('Correo', 'Email') : s.channel) + ' · ' + esc(s.to || '') + ' · ' + esc(String(s.at || '').slice(0, 16).replace('T', ' ')) + '</div>';
    }).join('') || '<p class="muted">' + esc(T('Todavía no se ha enviado.', 'Not sent yet.')) + '</p>';
    $('billingPane').innerHTML =
      '<div class="inv-actions">' +
        '<button class="btn ghost" onclick="openBilling()">← ' + esc(uiT('money')) + '</button>' +
        (inv.jobId ? '<button class="btn ghost" onclick="openJobDetail(\'' + inv.jobId + '\')">' + esc(T('Trabajo #', 'Job #') + (inv.jobNumber || '')) + '</button>' : '') +
        '<button class="btn" onclick="downloadInvoicePdf()">' + esc(T('Descargar PDF', 'Download PDF')) + '</button>' +
        sendBlock +
      '</div>' +
      '<div class="inv-paper" id="invPaper">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
          '<div style="display:flex;gap:10px;align-items:center">' + logoHtml(inv.companyName || companyName, 52) +
          '<h2 style="margin:0">' + esc(inv.companyName || companyName) + '</h2></div>' +
          '<div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#166534">' + esc(T('FACTURA', 'INVOICE')) + ' #' + esc(inv.number) + '</div>' +
          '<span class="st-pill ' + (ps === 'paid' ? 'on' : 'off') + '">' + esc(payStatusLabel(ps)) + '</span></div>' +
        '</div>' +
        partiesHtml(inv, c) +
        '<p>' + esc(T('Emitida', 'Issued')) + ': <b>' + esc(fmtDay(inv.issueDate)) + '</b> · ' + esc(T('Vence', 'Due')) + ': <b>' + esc(fmtDay(inv.dueDate || inv.issueDate)) + '</b></p>' +
        '<p class="muted">' + esc(T('Trabajo #', 'Job #') + (inv.jobNumber || '') + ' · ' + (inv.kind || '') + ' · ' + (inv.building || '')) + '</p>' +
        '<table><thead><tr><th>' + esc(T('Tipo de trabajo / descripción', 'Job type / description')) + '</th><th>' + esc(T('Cant.', 'Qty')) + '</th><th>' + esc(T('Precio', 'Price')) + '</th><th>Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p style="text-align:right">' + esc(T('Subtotal', 'Subtotal')) + ' ' + money(inv.subtotal) + '<br>' +
          esc(T('Impuesto', 'Tax')) + ' (' + (Math.round(Number(inv.taxRate || 0) * 10000) / 100) + '%) ' + money(inv.tax) + '<br><b style="font-size:18px">Total ' + money(inv.total) + '</b></p>' +
        '<p class="muted">' + esc(T('Términos de pago', 'Payment terms')) + ': ' + esc(termsLabel(inv.paymentTerms)) + ' · ' + esc(T('Saldo', 'Balance due')) + ': ' + money(dueAmt) + '</p>' +
      '</div>' +
      '<div class="job-sec"><h3>' + esc(T('Pagos', 'Payments')) + '</h3>' + pays +
      (inv.payToken && st !== 'paid'
        ? '<p class="muted">💳 ' + esc(T('Enlace para pagar con tarjeta', 'Card payment link')) + ': <a href="' + esc(payLink(id, inv.payToken)) + '" target="_blank" rel="noopener">' + esc(T('abrir', 'open')) + '</a> · ' +
          '<a href="#" onclick="navigator.clipboard.writeText(\'' + esc(payLink(id, inv.payToken)) + '\');this.textContent=\'' + esc(T('copiado', 'copied')) + '\';return false">' + esc(T('copiar', 'copy')) + '</a></p>'
        : '') +
      (st !== 'paid' ? '<label class="muted">' + esc(T('Monto', 'Amount')) + '</label><input id="payAmt" type="number" min="0" step="0.01">' +
        '<label class="muted">' + esc(T('Fecha', 'Date')) + '</label><input id="payDate" type="date" value="' + ymd(new Date()) + '">' +
        '<label class="muted">' + esc(T('Método', 'Method')) + '</label><input id="payMethod" type="text">' +
        '<button class="btn" onclick="saveInvoicePayment(\'' + id + '\')">' + esc(T('Registrar pago', 'Record payment')) + '</button>' : '') +
      '</div>' +
      '<div class="job-sec"><h3>' + esc(T('Envíos', 'Sends')) + '</h3>' + sends + '</div>' +
      '<div class="job-sec"><h3>' + esc(T('Notas', 'Notes')) + '</h3>' + notes +
      '<textarea id="invNote" rows="2"></textarea><button class="btn ghost" onclick="addInvoiceNote(\'' + id + '\')">' + esc(T('Agregar nota', 'Add note')) + '</button></div>';
    $('billingPane')._inv = Object.assign({}, inv, { id: inv.id || id, client: c.name, clientEmail: c.email, clientAddress: c.address || inv.clientAddress || '' });
  };
  // One click: the formal PDF (same file that "Enviar al cliente" attaches).
  window.downloadInvoicePdf = function () {
    var inv = $('billingPane')._inv || {};
    try { buildInvoicePdf(inv).save(pdfName(inv)); }
    catch (e) { alert(e.message || e); }
  };
  function invoiceMailCopy(inv) {
    var co = inv.companyName || companyName || '';
    var addr = inv.address || inv.building || '';
    var tot = money(inv.total);
    var terms = inv.paymentTerms || 'upon receipt';
    var en = loginLang() === 'en';
    terms = termsLabel(inv.paymentTerms);
    return {
      subject: (en ? 'Invoice #' : 'Factura #') + (inv.number || '') + ' — ' + co + (addr ? ' — ' + addr : ''),
      body: (en
        ? ('Hello ' + (inv.client || '') + ',\nThank you for your business. Attached is invoice #' + (inv.number || '') + ' for ' + tot + '. Payment terms: ' + terms + ' (due ' + fmtDay(inv.dueDate) + ').\n\n' + co)
        : ('Hola ' + (inv.client || '') + ',\nGracias por su confianza. Adjuntamos la factura #' + (inv.number || '') + ' por ' + tot + '. Términos de pago: ' + terms + ' (vence el ' + fmtDay(inv.dueDate) + ').\n\n' + co))
    };
  }
  window.openEmailInvoice = function (id) {
    var inv = $('billingPane')._inv || {};
    var j = jobs.find(function (x) { return x.id === inv.jobId; }) || {};
    var copy = invoiceMailCopy(inv);
    if (!canSendInvoice(j, inv)) {
      alert(loginLang() === 'en' ? 'The invoice stays in Draft until work photos are uploaded.' : 'La factura se queda en borrador hasta subir las fotos del trabajo.');
      return;
    }
    if (!clientOk({ name: inv.client, email: inv.clientEmail })) {
      alert(T('Primero registra el cliente que paga.', 'Add the paying client first.'));
      return;
    }
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:500px;max-width:96vw"><h3>' + esc(T('Enviar factura #', 'Send invoice #') + (inv.number || '')) + '</h3>' +
      '<label class="muted">' + esc(T('Para (cliente que paga)', 'To (paying client)')) + '</label><input id="emTo" type="email" value="' + esc(inv.clientEmail || '') + '" readonly>' +
      '<label class="muted">' + esc(T('Asunto', 'Subject')) + '</label><input id="emSub" type="text" value="' + esc(copy.subject) + '">' +
      '<label class="muted">' + esc(T('Mensaje', 'Message')) + '</label><textarea id="emBody" rows="6">' + esc(copy.body) + '</textarea>' +
      '<p class="muted">📎 ' + esc(pdfName(inv)) + ' — ' + esc(T('el mismo PDF que se descarga.', 'the same PDF you download.')) + '</p>' +
      '<div class="err" id="emErr"></div>' +
      '<button class="btn" id="emSend" onclick="sendInvoiceMail(\'' + id + '\')">' + esc(T('Enviar', 'Send')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
  };
  // Builds the PDF, stores it (reports/{companyId}/invoices/...), and queues
  // the email to the paying client in the `mail` collection with the PDF
  // attached (plus a link, in case the mail client strips attachments).
  window.sendInvoiceMail = async function (id) {
    var inv = $('billingPane')._inv || {};
    var j = jobs.find(function (x) { return x.id === inv.jobId; }) || {};
    var err = $('emErr');
    if (!canSendInvoice(j, inv)) {
      alert(T('Para enviarla, sube fotos de ANTES y DESPUÉS del trabajo.', 'To send it, upload BEFORE and AFTER job photos.'));
      return;
    }
    var to = inv.clientEmail || '';
    if (!clientOk({ name: inv.client, email: to })) { if (err) err.textContent = T('Falta el cliente que paga.', 'The paying client is missing.'); return; }
    var sub = ($('emSub') && $('emSub').value) || invoiceMailCopy(inv).subject;
    var body = ($('emBody') && $('emBody').value) || invoiceMailCopy(inv).body;
    var btn = $('emSend'); if (btn) { btn.disabled = true; btn.textContent = T('Enviando…', 'Sending…'); }
    try {
      var blob = buildInvoicePdf(inv).output('blob');
      var ref = storage.ref('reports/' + cid() + '/invoices/' + (inv.number || id) + '_' + Date.now() + '.pdf');
      await ref.put(blob, { contentType: 'application/pdf' });
      var url = await ref.getDownloadURL();
      // "Pagar en línea" when the company has connected its Stripe.
      var payUrl = '';
      try { var ps0 = await connectCall('status'); window.companyCanTakeCards = !!ps0.chargesEnabled; } catch (_) {}
      if (window.companyCanTakeCards) {
        var tok = inv.payToken || randToken();
        if (!inv.payToken) {
          await db.collection('companies').doc(cid()).collection('invoices').doc(id || inv.id).set({ payToken: tok, lang: loginLang() }, { merge: true });
          inv.payToken = tok;
        }
        payUrl = payLink(id || inv.id, tok);
      }
      var payBtn = payUrl
        ? '<p style="margin:18px 0"><a href="' + payUrl + '" style="background:#16A34A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">' +
          esc(T('Pagar en línea', 'Pay online')) + ' · ' + money(inv.total) + '</a></p>'
        : '';
      var html = '<p>' + esc(body).replace(/\n/g, '<br>') + '</p>' + payBtn + '<p><a href="' + url + '">' + esc(T('Descargar la factura en PDF', 'Download the invoice PDF')) + '</a></p>';
      if (payUrl) body = body + '\n\n' + T('Pagar en línea con tarjeta: ', 'Pay online by card: ') + payUrl;
      await db.collection('mail').add({
        to: [to],
        companyId: cid(),
        invoiceId: id || inv.id,
        message: {
          subject: sub,
          text: body + '\n\n' + url,
          html: html,
          attachments: [{ filename: pdfName(inv), path: url, contentType: 'application/pdf' }]
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      var sends = (inv.sends || []).slice();
      sends.push({ channel: 'email', to: to, at: new Date().toISOString(), pdfUrl: url });
      await db.collection('companies').doc(cid()).collection('invoices').doc(id || inv.id).set({
        sends: sends, issuedStatus: 'sent', pdfUrl: url,
        status: invStatus(Object.assign({}, inv, { issuedStatus: 'sent', sends: sends })) === 'paid' ? 'paid' : 'sent'
      }, { merge: true });
    } catch (e) {
      if (err) err.textContent = T('No se pudo enviar: ', 'Could not send: ') + (e.message || e);
      if (btn) { btn.disabled = false; btn.textContent = T('Enviar', 'Send'); }
      return;
    }
    $('modal').classList.add('hidden');
    openInvoice(id || inv.id);
  };
  window.sendInvoiceSms = async function (id) {
    var inv = $('billingPane')._inv || {};
    var j = jobs.find(function (x) { return x.id === inv.jobId; }) || {};
    if (!canSendInvoice(j, inv)) {
      alert(loginLang() === 'en' ? 'The invoice stays in Draft until work photos are uploaded.' : 'La factura se queda en borrador hasta subir las fotos del trabajo.');
      return;
    }
    var phone = (j.contactPhone || '').replace(/[^\d+]/g, '');
    var sends = (inv.sends || []).slice();
    sends.push({ channel: 'sms', to: phone, at: new Date().toISOString() });
    try {
      await db.collection('companies').doc(cid()).collection('invoices').doc(id).set({
        sends: sends, issuedStatus: 'sent', status: 'sent'
      }, { merge: true });
    } catch (e) { alert(e.message || e); return; }
    var msg = encodeURIComponent(invoiceMailCopy(inv).subject + ' ' + money(inv.total));
    if (phone) location.href = 'sms:' + phone + '?body=' + msg;
    openInvoice(id);
  };
  window.saveInvoicePayment = async function (id) {
    if (!canSeeMoney()) return;
    var inv = $('billingPane')._inv || {};
    var amt = Number($('payAmt') && $('payAmt').value);
    if (!(amt > 0)) return;
    var payments = (inv.payments || []).slice();
    payments.push({ amount: amt, date: $('payDate').value || ymd(new Date()), method: ($('payMethod').value || '').trim() });
    var paid = payments.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
    var patch = { payments: payments };
    if (paid >= Number(inv.total || 0) - 0.009) patch.status = 'paid';
    try {
      await db.collection('companies').doc(cid()).collection('invoices').doc(id).set(patch, { merge: true });
      openInvoice(id);
    } catch (e) { alert(e.message || e); }
  };
  window.addInvoiceNote = async function (id) {
    var text = ($('invNote') && $('invNote').value || '').trim();
    if (!text) return;
    var inv = $('billingPane')._inv || {};
    var log = (inv.notesLog || []).slice();
    log.push({ text: text, authorName: (profile && (profile.displayName || profile.email)) || '', at: new Date().toISOString() });
    try {
      await db.collection('companies').doc(cid()).collection('invoices').doc(id).set({ notesLog: log }, { merge: true });
      openInvoice(id);
    } catch (e) { alert(e.message || e); }
  };
  window.openPayments = function () { return openBilling(); };
  window.setInvoiceStatus = async function (id, status) {
    if (!canSeeMoney()) return;
    try {
      await db.collection('companies').doc(cid()).collection('invoices').doc(id).set({
        status: status, statusAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      openInvoice(id);
    } catch (e) { alert(e.message || e); }
  };
  window.openMoney = function () { return openBilling(); };

  window.openArchived = function () {
    closeMore();
    document.body.classList.add('view-archived');
    document.body.classList.remove('view-hours', 'view-roles', 'view-worker', 'view-companies', 'view-reports', 'view-billing', 'sites-open');
    if (typeof markNav === 'function') markNav('jobs');
    var pane = $('archivedPane');
    if (!pane) return;
    var list = jobs.filter(jobArchived).sort(function (a, b) { return jobTime(b) - jobTime(a); });
    pane.innerHTML = '<div class="card"><h3>Archivados</h3><p class="muted">No se facturan y no se borran. El historial queda por si el cliente reclama.</p>' +
      (list.map(function (j) {
        return '<div class="inv-row"><div><b>' + esc(j.kind || 'Job') + '</b><div class="muted">' +
          esc(j.archiveReason || '') + (j.archiveNote ? ' · ' + esc(j.archiveNote) : '') + '</div></div>' +
          '<button class="btn ghost" onclick="unarchiveJob(\'' + j.id + '\')">Desarchivar</button></div>';
      }).join('') || '<p class="muted">Nada archivado.</p>') +
      '<button class="btn ghost" onclick="document.body.classList.remove(\'view-archived\');renderSchedule()">Volver</button></div>';
  };
  window.askArchiveJob = function (id) {
    if (!canAssign()) return;
    var j = jobs.find(function (x) { return x.id === id; });
    if (!j) return;
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box"><h3>Archivar trabajo</h3>' +
      '<p class="muted">Sale de las listas activas. No se factura y no se borra.</p>' +
      '<select id="arReason">' +
        '<option value="canceló el cliente">Canceló el cliente</option>' +
        '<option value="no se pudo entrar">No se pudo entrar</option>' +
        '<option value="se reprogramó">Se reprogramó</option>' +
        '<option value="duplicado">Duplicado</option>' +
        '<option value="otro">Otro</option>' +
      '</select>' +
      '<input id="arNote" type="text" placeholder="Nota (opcional)">' +
      '<button class="btn" onclick="archiveJob(\'' + id + '\')">Archivar</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">Cerrar</button></div>';
  };
  window.archiveJob = async function (id) {
    if (!canAssign()) return;
    var reason = ($('arReason') && $('arReason').value) || 'otro';
    var note = ($('arNote') && $('arNote').value.trim()) || '';
    try {
      await db.collection('jobs').doc(id).set({
        archived: true,
        archiveReason: reason,
        archiveNote: note,
        archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
        archivedBy: auth.currentUser && auth.currentUser.uid
      }, { merge: true });
      $('modal').classList.add('hidden');
      if (typeof closeJobView === 'function') closeJobView();
      if (typeof openJobs === 'function') openJobs();
    } catch (e) { alert(e.message || e); }
  };
  window.unarchiveJob = async function (id) {
    if (!canAssign()) return;
    try {
      await db.collection('jobs').doc(id).set({
        archived: false,
        unarchivedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      openArchived();
    } catch (e) { alert(e.message || e); }
  };
})();
