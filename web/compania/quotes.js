/* Quotes (cotizaciones): create, send to the client to approve or decline
   online (walkcheck.app/cotizacion/), and convert an approved quote into a
   job with the same lines. Stored in companies/{cid}/quotes. Owner/admin
   only (firestore.rules). Workers never load this file. */
(function () {
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function today() { return ymd(new Date()); }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function token() { var a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function ref() { return db.collection('companies').doc(cid()).collection('quotes'); }
  var ST = {
    draft: ['Borrador', 'Draft', 'off'],
    sent: ['Enviada', 'Sent', 'off'],
    approved: ['Aprobada', 'Approved', 'on'],
    declined: ['Rechazada', 'Declined', 'off'],
    converted: ['Convertida en trabajo', 'Turned into a job', 'on']
  };
  function stLabel(s) { var x = ST[s] || ST.draft; return T(x[0], x[1]); }
  function stPill(s) { var x = ST[s] || ST.draft; return '<span class="st-pill ' + x[2] + '">' + esc(stLabel(s)) + '</span>'; }
  function totals(lines, chargeTax) {
    var sub = lines.reduce(function (s, l) { return s + Number(l.qty || 0) * Number(l.unitPrice || 0); }, 0);
    var rate = chargeTax ? Number(companyTaxRate || 0) : 0;
    var tax = +(sub * rate).toFixed(2);
    return { subtotal: +sub.toFixed(2), taxRate: rate, tax: tax, total: +(sub + tax).toFixed(2) };
  }
  function link(id, q) {
    return 'https://walkcheck.app/cotizacion/?c=' + encodeURIComponent(cid()) + '&q=' + encodeURIComponent(id) + '&t=' + q.viewToken + '&lang=' + (q.lang || loginLang());
  }
  function tabs(active) {
    return '<div class="view-tabs" style="margin:0 0 12px;flex-wrap:wrap">' +
      '<button type="button" class="' + (active === 'inv' ? 'on' : '') + '" onclick="openBilling()">' + esc(T('Facturas', 'Invoices')) + '</button>' +
      '<button type="button" class="' + (active === 'quo' ? 'on' : '') + '" onclick="openQuotes()">' + esc(T('Cotizaciones', 'Quotes')) + '</button></div>';
  }
  window.billingTabsHtml = tabs;

  /* ---------- List ---------- */
  window.openQuotes = async function () {
    if (!canSeeMoney()) return;
    if (typeof closeMore === 'function') closeMore();
    document.body.classList.add('view-billing');
    document.body.classList.remove('view-hours', 'view-roles', 'view-worker', 'view-companies', 'view-reports', 'view-archived', 'sites-open');
    if (typeof markNav === 'function') markNav('money');
    var pane = $('billingPane');
    if (!pane) return;
    pane._inv = null;
    pane.innerHTML = tabs('quo') + '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>';
    var list = [];
    try {
      var s = await ref().limit(150).get();
      s.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
    } catch (e) { pane.innerHTML = tabs('quo') + '<p class="err">' + esc(e.message || e) + '</p>'; return; }
    list.sort(function (a, b) { return String(b.number || '').localeCompare(String(a.number || ''), undefined, { numeric: true }); });
    var count = function (s) { return list.filter(function (q) { return q.status === s; }).length; };
    pane.innerHTML = tabs('quo') +
      '<div class="inv-kpis">' +
        '<div class="inv-kpi"><span>' + esc(T('Enviadas', 'Sent')) + '</span><b>' + count('sent') + '</b></div>' +
        '<div class="inv-kpi"><span>' + esc(T('Aprobadas', 'Approved')) + '</span><b>' + (count('approved') + count('converted')) + '</b></div>' +
        '<div class="inv-kpi"><span>' + esc(T('Rechazadas', 'Declined')) + '</span><b>' + count('declined') + '</b></div>' +
      '</div>' +
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<h3 style="margin:0">' + esc(T('Cotizaciones', 'Quotes')) + '</h3>' +
        '<button class="btn" style="width:auto" onclick="openQuoteEditor()">' + esc(T('+ Nueva cotización', '+ New quote')) + '</button></div>' +
        '<p class="muted">' + esc(T('Envía el precio antes de hacer el trabajo. El cliente lo aprueba en línea y lo conviertes en trabajo con un toque.', 'Send the price before doing the work. The client approves online and you turn it into a job in one tap.')) + '</p>' +
        (list.map(function (q) {
          return '<div class="inv-row"><div><b>#' + esc(q.number || '') + '</b> · ' + money(q.total) +
            '<div class="muted">' + esc(q.client || T('Sin cliente', 'No client')) + ' · ' + esc(q.title || '') + '</div></div>' +
            stPill(q.status) +
            '<button type="button" class="btn ghost" onclick="openQuote(\'' + q.id + '\')">' + esc(T('Abrir', 'Open')) + '</button></div>';
        }).join('') || '<p class="muted">' + esc(T('Todavía no hay cotizaciones.', 'No quotes yet.')) + '</p>') +
      '</div>';
  };

  /* ---------- Editor ---------- */
  var draft = null;
  function lineRow(l, i) {
    var names = (allTypes(true) || []).map(function (t) { return t.name; });
    if (l.name && names.indexOf(l.name) < 0) names.unshift(l.name);
    var extra = T('Trabajo extra', 'Extra work');
    if (names.indexOf(extra) < 0) names.push(extra);
    return '<div class="line-row inv-line" style="grid-template-columns:1fr 2fr 70px 90px 34px">' +
      '<select data-qn="' + i + '" onchange="qtPickType(' + i + ', this.value)"><option value="">' + esc(T('Tipo de trabajo…', 'Job type…')) + '</option>' +
        names.map(function (n) { return '<option' + (n === l.name ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<textarea data-qd="' + i + '" rows="2" placeholder="' + esc(T('Qué se va a hacer', 'What will be done')) + '">' + esc(l.desc || '') + '</textarea>' +
      '<input data-qq="' + i + '" type="number" min="0" step="any" value="' + Number(l.qty || 1) + '" placeholder="' + esc(T('Cant.', 'Qty')) + '">' +
      '<input data-qp="' + i + '" type="number" min="0" step="0.01" value="' + (l.unitPrice != null ? Number(l.unitPrice) : '') + '" placeholder="' + esc(T('Precio', 'Price')) + '">' +
      '<button type="button" class="btn ghost" style="padding:4px;min-height:0;margin:0" title="' + esc(T('Quitar', 'Remove')) + '" onclick="qtRemoveLine(' + i + ')">✕</button>' +
      '</div>';
  }
  function readForm() {
    var d = draft;
    d.client = ($('qClient').value || '').trim();
    d.clientEmail = ($('qEmail').value || '').trim();
    d.clientPhone = ($('qPhone').value || '').trim();
    d.clientAddress = ($('qAddr').value || '').trim();
    d.title = ($('qTitle').value || '').trim();
    d.notes = ($('qNotes').value || '').trim();
    d.validUntil = $('qValid').value || addDays(today(), 30);
    d.chargeTax = !!$('qTax').checked;
    d.lines = [].map.call(document.querySelectorAll('#modal [data-qn]'), function (el) {
      var i = el.getAttribute('data-qn');
      var qty = Number(document.querySelector('#modal [data-qq="' + i + '"]').value || 0);
      var price = Number(document.querySelector('#modal [data-qp="' + i + '"]').value || 0);
      return { name: el.value, desc: (document.querySelector('#modal [data-qd="' + i + '"]').value || '').trim(), qty: qty, unitPrice: price, amount: +(qty * price).toFixed(2) };
    }).filter(function (l) { return l.name || l.desc || l.unitPrice; });
    return d;
  }
  function renderEditor() {
    var d = draft;
    var bopts = '<option value="">' + esc(T('— Cliente nuevo —', '— New client —')) + '</option>' +
      (buildings || []).map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === d.buildingId ? ' selected' : '') + '>' + esc(b.name || b.id) + '</option>'; }).join('');
    var t = totals(d.lines.length ? d.lines : [{}], d.chargeTax);
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:680px;max-width:96vw">' +
      '<h3>' + esc(d.id ? T('Cotización #', 'Quote #') + (d.number || '') : T('Nueva cotización', 'New quote')) + '</h3>' +
      '<label class="muted">' + esc(T('Edificio / cliente guardado', 'Building / saved client')) + '</label><select id="qBld" onchange="qtPickBuilding(this.value)">' + bopts + '</select>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<div><label class="muted">' + esc(T('Cliente *', 'Client *')) + '</label><input id="qClient" value="' + esc(d.client || '') + '"></div>' +
        '<div><label class="muted">' + esc(T('Correo del cliente *', 'Client email *')) + '</label><input id="qEmail" type="email" value="' + esc(d.clientEmail || '') + '"></div>' +
        '<div><label class="muted">' + esc(T('Teléfono', 'Phone')) + '</label><input id="qPhone" value="' + esc(d.clientPhone || '') + '"></div>' +
        '<div><label class="muted">' + esc(T('Dirección del trabajo', 'Job address')) + '</label><input id="qAddr" value="' + esc(d.clientAddress || '') + '"></div>' +
      '</div>' +
      '<label class="muted">' + esc(T('Título (qué es)', 'Title (what it is)')) + '</label><input id="qTitle" value="' + esc(d.title || '') + '" placeholder="' + esc(T('Ej: Cambio de 3 ventanas del lobby', 'E.g. Replace 3 lobby windows')) + '">' +
      '<div class="line-row inv-line-head" style="grid-template-columns:1fr 2fr 70px 90px 34px;font-size:12px;font-weight:800;color:#6B7280;margin-top:10px">' +
        '<span>' + esc(T('Tipo', 'Type')) + '</span><span>' + esc(T('Descripción', 'Description')) + '</span><span>' + esc(T('Cant.', 'Qty')) + '</span><span>' + esc(T('Precio', 'Price')) + '</span><span></span></div>' +
      d.lines.map(lineRow).join('') +
      '<button type="button" class="btn ghost" onclick="qtAddLine()">' + esc(T('+ Agregar línea', '+ Add line')) + '</button>' +
      '<label><input type="checkbox" id="qTax"' + (d.chargeTax ? ' checked' : '') + '> ' + esc(T('Cobrar impuesto', 'Charge tax') + ' (' + Math.round(Number(companyTaxRate || 0) * 10000) / 100 + '%)') + '</label>' +
      '<label class="muted">' + esc(T('Válida hasta', 'Valid until')) + '</label><input id="qValid" type="date" value="' + esc(d.validUntil || addDays(today(), 30)) + '">' +
      '<label class="muted">' + esc(T('Notas para el cliente (opcional)', 'Notes for the client (optional)')) + '</label><textarea id="qNotes" rows="2">' + esc(d.notes || '') + '</textarea>' +
      '<p style="text-align:right"><b>Total ' + money(t.total) + '</b> <span class="muted">(' + esc(T('se recalcula al guardar', 'recalculated on save')) + ')</span></p>' +
      '<div class="err" id="qErr"></div>' +
      '<button class="btn" onclick="saveQuote()">' + esc(T('Guardar cotización', 'Save quote')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
  }
  window.qtPickType = function (i, name) {
    var p = document.querySelector('#modal [data-qp="' + i + '"]');
    var price = typeof priceOfKind === 'function' ? priceOfKind(name) : 0;
    if (p && price > 0 && !(Number(p.value) > 0)) p.value = price;
  };
  window.qtAddLine = function () { readForm(); draft.lines.push({ name: '', desc: '', qty: 1, unitPrice: '' }); renderEditor(); };
  window.qtRemoveLine = function (i) { readForm(); draft.lines.splice(i, 1); if (!draft.lines.length) draft.lines.push({ name: '', desc: '', qty: 1 }); renderEditor(); };
  window.qtPickBuilding = function (id) {
    readForm();
    var b = (buildings || []).find(function (x) { return x.id === id; });
    draft.buildingId = id || '';
    if (b) {
      draft.client = b.clientName || b.name || draft.client;
      draft.clientEmail = b.clientEmail || draft.clientEmail;
      draft.clientAddress = b.clientAddress || b.address || b.name || draft.clientAddress;
    }
    renderEditor();
  };
  window.openQuoteEditor = async function (id) {
    if (!canSeeMoney()) return;
    if (id) {
      var d = await ref().doc(id).get();
      draft = Object.assign({ id: id }, d.data() || {});
      if (!Array.isArray(draft.lines) || !draft.lines.length) draft.lines = [{ name: '', desc: '', qty: 1 }];
    } else {
      draft = { lines: [{ name: '', desc: '', qty: 1, unitPrice: '' }], validUntil: addDays(today(), 30), chargeTax: Number(companyTaxRate || 0) > 0 };
    }
    renderEditor();
  };
  window.saveQuote = async function () {
    var d = readForm();
    var err = $('qErr');
    if (!d.client || !/^\S+@\S+\.\S+$/.test(d.clientEmail)) { err.textContent = T('Pon el nombre y el correo del cliente.', 'Add the client name and email.'); return; }
    if (!d.lines.length || !d.lines.some(function (l) { return l.unitPrice > 0; })) { err.textContent = T('Agrega al menos una línea con precio.', 'Add at least one priced line.'); return; }
    // The client must see what each price is for.
    if (d.lines.some(function (l) { return !l.name && !l.desc; })) { err.textContent = T('Cada línea necesita el tipo de trabajo o qué se va a hacer.', 'Each line needs a job type or what will be done.'); return; }
    var t = totals(d.lines, d.chargeTax);
    var data = {
      client: d.client, clientEmail: d.clientEmail, clientPhone: d.clientPhone, clientAddress: d.clientAddress,
      buildingId: d.buildingId || '', title: d.title || (d.lines[0] && d.lines[0].name) || '',
      lines: d.lines, chargeTax: d.chargeTax, subtotal: t.subtotal, taxRate: t.taxRate, tax: t.tax, total: t.total,
      notes: d.notes, validUntil: d.validUntil, companyName: companyName || '', lang: loginLang(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      var id = d.id;
      if (id) {
        await ref().doc(id).set(data, { merge: true });
      } else {
        var coRef = db.collection('companies').doc(cid());
        var qRef = ref().doc();
        await db.runTransaction(async function (tx) {
          var co = await tx.get(coRef);
          var n = ((co.exists && co.data().quoteSeq) || 0) + 1;
          tx.set(coRef, { quoteSeq: n }, { merge: true });
          tx.set(qRef, Object.assign({}, data, {
            number: 'C-' + (1000 + n), status: 'draft', viewToken: token(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: auth.currentUser && auth.currentUser.uid
          }));
        });
        id = qRef.id;
      }
      $('modal').classList.add('hidden');
      openQuote(id);
    } catch (e) { err.textContent = e.message || e; }
  };

  /* ---------- View ---------- */
  window.openQuote = async function (id) {
    if (!canSeeMoney()) return;
    var pane = $('billingPane');
    var d = await ref().doc(id).get();
    if (!d.exists) return openQuotes();
    var q = Object.assign({ id: id }, d.data());
    pane._inv = null;
    pane._quote = q;
    var rows = (q.lines || []).map(function (l) {
      return '<tr><td><b>' + esc(l.name || '') + '</b><div class="muted">' + esc(l.desc || '') + '</div></td><td>' + Number(l.qty || 0) + '</td><td>' + money(l.unitPrice) + '</td><td>' + money(l.amount) + '</td></tr>';
    }).join('');
    var answer = q.status === 'approved' || q.status === 'converted'
      ? '<div class="card" style="background:#F0FDF4"><b>✅ ' + esc(T('Aprobada por', 'Approved by')) + ' ' + esc(q.approvedName || '') + '</b><div class="muted">' + esc(String(q.approvedAtIso || '').slice(0, 16).replace('T', ' ')) + '</div></div>'
      : q.status === 'declined'
        ? '<div class="card" style="background:#FEF2F2"><b>✖ ' + esc(T('Rechazada', 'Declined')) + '</b><div class="muted">' + esc(q.declineReason || '') + '</div></div>'
        : '';
    pane.innerHTML = tabs('quo') +
      '<div class="inv-actions">' +
        '<button class="btn ghost" onclick="openQuotes()">← ' + esc(T('Cotizaciones', 'Quotes')) + '</button>' +
        (q.status !== 'converted' ? '<button class="btn ghost" onclick="openQuoteEditor(\'' + id + '\')">' + esc(T('Editar', 'Edit')) + '</button>' : '') +
        (['draft', 'sent', 'declined'].indexOf(q.status) >= 0 ? '<button class="btn" onclick="sendQuote(\'' + id + '\')">' + esc(q.status === 'draft' ? T('Enviar al cliente', 'Send to client') : T('Volver a enviar', 'Send again')) + '</button>' : '') +
        (q.status === 'approved' ? '<button class="btn" onclick="convertQuote(\'' + id + '\')">' + esc(T('Convertir en trabajo', 'Turn into a job')) + '</button>' : '') +
        (q.jobId ? '<button class="btn ghost" onclick="openJobDetail(\'' + esc(q.jobId) + '\')">' + esc(T('Ver el trabajo', 'Open the job')) + '</button>' : '') +
      '</div>' +
      answer +
      '<div class="inv-paper">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h2 style="margin:0">' + esc(q.companyName || companyName || '') + '</h2>' +
        '<div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#166534">' + esc(T('COTIZACIÓN', 'QUOTE')) + ' #' + esc(q.number || '') + '</div>' + stPill(q.status) + '</div></div>' +
        '<p><b>' + esc(T('Para', 'To')) + ':</b> ' + esc(q.client || '') + ' · ' + esc(q.clientEmail || '') + (q.clientPhone ? ' · ' + esc(q.clientPhone) : '') + '<br>' + esc(q.clientAddress || '') + '</p>' +
        (q.title ? '<p><b>' + esc(q.title) + '</b></p>' : '') +
        '<table><thead><tr><th>' + esc(T('Trabajo', 'Work')) + '</th><th>' + esc(T('Cant.', 'Qty')) + '</th><th>' + esc(T('Precio', 'Price')) + '</th><th>Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p style="text-align:right">Subtotal ' + money(q.subtotal) + '<br>' + esc(T('Impuesto', 'Tax')) + ' ' + money(q.tax) + '<br><b style="font-size:18px">Total ' + money(q.total) + '</b></p>' +
        '<p class="muted">' + esc(T('Válida hasta', 'Valid until')) + ': ' + esc(q.validUntil || '') + '</p>' +
        (q.notes ? '<p style="white-space:pre-wrap">' + esc(q.notes) + '</p>' : '') +
      '</div>' +
      (q.viewToken && q.status !== 'draft' ? '<p class="muted">🔗 ' + esc(T('Enlace para el cliente', 'Client link')) + ': <a href="' + esc(link(id, q)) + '" target="_blank" rel="noopener">' + esc(T('abrir', 'open')) + '</a></p>' : '') +
      '<div id="qDelivery"></div>';
    if (q.sends && q.sends.length) showDelivery(id);
  };

  // Shows whether the last email for this quote was delivered (set by sendMail).
  async function showDelivery(id) {
    var box = $('qDelivery');
    try {
      var s = await db.collection('mail').where('companyId', '==', cid()).where('quoteId', '==', id).get();
      var last = s.docs.map(function (d) { return d.data(); }).sort(function (a, b) {
        return ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0);
      })[0];
      if (!last || !box) return;
      var dl = last.delivery || {};
      box.innerHTML = dl.state === 'SUCCESS'
        ? '<p class="muted">📧 ' + esc(T('Correo entregado a', 'Email delivered to')) + ' ' + esc((last.to || []).join(', ')) + '</p>'
        : dl.state === 'ERROR'
          ? '<div class="card" style="background:#FEF2F2"><b>⚠️ ' + esc(T('El correo no salió', 'The email was not sent')) + '</b><div class="muted">' + esc(dl.error || '') + '</div></div>'
          : '<p class="muted">📧 ' + esc(T('Enviando correo…', 'Sending email…')) + '</p>';
    } catch (e) { /* no read access yet: show nothing */ }
  }

  /* ---------- Send ---------- */
  window.sendQuote = async function (id) {
    var q = ($('billingPane')._quote) || {};
    if (!q.clientEmail) { alert(T('Falta el correo del cliente.', 'The client email is missing.')); return; }
    var en = (q.lang || loginLang()) === 'en';
    var url = link(id, q);
    var co = q.companyName || companyName || '';
    var subject = (en ? 'Quote #' : 'Cotización #') + (q.number || '') + ' — ' + co;
    var text = en
      ? ('Hello ' + (q.client || '') + ',\n\nHere is our quote #' + q.number + ' for ' + money(q.total) + (q.title ? ' (' + q.title + ')' : '') + '. You can review it and approve it online:\n' + url + '\n\nValid until ' + q.validUntil + '.\n\n' + co)
      : ('Hola ' + (q.client || '') + ',\n\nLe enviamos la cotización #' + q.number + ' por ' + money(q.total) + (q.title ? ' (' + q.title + ')' : '') + '. Puede revisarla y aprobarla en línea:\n' + url + '\n\nVálida hasta el ' + q.validUntil + '.\n\n' + co);
    var html = '<p>' + esc(text.split('\n' + url)[0]).replace(/\n/g, '<br>') + '</p>' +
      '<p style="margin:18px 0"><a href="' + url + '" style="background:#16A34A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">' +
      (en ? 'View and approve' : 'Ver y aprobar la cotización') + ' · ' + money(q.total) + '</a></p>' +
      '<p>' + (en ? 'Valid until ' : 'Válida hasta el ') + esc(q.validUntil || '') + '.<br>' + esc(co) + '</p>';
    try {
      await db.collection('mail').add({
        to: [q.clientEmail], companyId: cid(), quoteId: id,
        message: { subject: subject, text: text, html: html },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      var sends = (q.sends || []).slice();
      sends.push({ to: q.clientEmail, at: new Date().toISOString() });
      await ref().doc(id).set({ status: 'sent', sends: sends, sentAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      openQuote(id);
    } catch (e) { alert(e.message || e); }
  };

  /* ---------- Convert to job ---------- */
  window.convertQuote = async function (id) {
    var q = ($('billingPane')._quote) || {};
    if (q.status !== 'approved') return;
    var lines = (q.lines || []).map(function (l) { return { name: l.name || '', description: l.desc || '', qty: Number(l.qty || 1), unitPrice: Number(l.unitPrice || 0), total: Number(l.amount || 0) }; });
    var day = today();
    var start = new Date(day + 'T09:00:00'), end = new Date(day + 'T11:00:00');
    var title = q.clientAddress || q.title || q.client || 'Job';
    var job = {
      companyId: cid(), companyName: companyName || '', buildingId: q.buildingId || '',
      title: title, address: q.clientAddress || '', clientName: q.client || '', contactName: q.client || '',
      contactPhone: q.clientPhone || '', contactEmail: q.clientEmail || '',
      kind: (lines[0] && lines[0].name) || q.title || 'Trabajo', description: q.title || '',
      instructions: [q.title, q.notes].filter(Boolean).join('\n'),
      lines: lines, quoteLines: lines, quoteId: id, quoteNumber: q.number || '', quoteAttachments: [],
      visits: [{ id: 'v1', scheduledDate: day, startClock: '09:00', endClock: '11:00', hour: 9, minute: 0, endHour: 11, endMinute: 0, assignedUid: '', status: 'open', checklists: ['inspection', 'jobReport'], title: title }],
      expenses: [], notesLog: [], status: 'open', scheduledDate: day, startClock: '09:00', endClock: '11:00',
      hour: 9, minute: 0, endHour: 11, endMinute: 0,
      appointment_start: firebase.firestore.Timestamp.fromDate(start), appointment_end: firebase.firestore.Timestamp.fromDate(end),
      assignedUid: '', workerId: '', assignedName: '', unassigned: true,
      companyType: typeof companyType !== 'undefined' ? companyType : '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: auth.currentUser && auth.currentUser.uid
    };
    try {
      var coRef = db.collection('companies').doc(cid());
      var jobRef = db.collection('jobs').doc();
      await db.runTransaction(async function (tx) {
        var co = await tx.get(coRef);
        var n = ((co.exists && co.data().jobSeq) || 0) + 1;
        tx.set(coRef, { jobSeq: n }, { merge: true });
        tx.set(jobRef, Object.assign({}, job, { jobNumber: String(n) }));
      });
      await ref().doc(id).set({ status: 'converted', jobId: jobRef.id, convertedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      alert(T('Listo: se creó el trabajo sin técnico. Asígnalo con "Asignar trabajo".', 'Done: the job was created with no tech. Assign it with "Assign job".'));
      openQuote(id);
    } catch (e) { alert(e.message || e); }
  };
})();
