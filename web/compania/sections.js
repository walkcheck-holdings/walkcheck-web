/* Office lists that are not the schedule: clients, requests, payments.
   Workers never load this file. Counts come from Firestore, never from a sample. */
(function () {
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function money(n) { return (window.invoiceMoney ? invoiceMoney(n) : ('$' + Number(n || 0).toFixed(2))); }
  function col(name) { return db.collection('companies').doc(cid()).collection(name); }
  function show(which) {
    if (typeof closeMore === 'function') closeMore();
    if (typeof closeCreate === 'function') closeCreate();
    document.body.classList.remove('view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived', 'view-home', 'view-search', 'view-jobs', 'view-job', 'view-payments', 'view-clients', 'view-requests', 'view-quotes', 'sites-open');
    document.body.classList.add(which);
    if (typeof markNav === 'function') markNav();
  }
  function pane() { return $('officePane'); }
  function empty(msg) { return '<p class="muted">' + esc(msg) + '</p>'; }

  /* ---------- Clients ---------- */
  window.clientUi = window.clientUi || { q: '' };
  async function loadClients() {
    var list = [];
    var snap = await col('clients').limit(500).get();
    snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
    list.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    return list;
  }
  window.openClients = async function (q) {
    if (typeof canSeeClients === 'function' && !canSeeClients()) return;
    show('view-clients');
    var box = pane();
    if (!box) return;
    if (q != null) window.clientUi.q = q;
    var query = String(window.clientUi.q || '').toLowerCase();
    box.innerHTML = '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>';
    var list = [];
    try { list = await loadClients(); }
    catch (e) { box.innerHTML = '<p class="err">' + esc(e.message || e) + '</p>'; return; }
    var shown = list.filter(function (c) {
      if (!query) return true;
      var blob = [c.name, c.phone, c.email, (c.buildingIds || []).join(' ')].join(' ').toLowerCase();
      return blob.indexOf(query) >= 0;
    });
    var rows = shown.map(function (c) {
      var bnames = (c.buildingIds || []).map(function (id) {
        var b = (buildings || []).find(function (x) { return x.id === id; });
        return b ? b.name : '';
      }).filter(Boolean).join(', ');
      return '<tr onclick="openClient(\'' + c.id + '\')"><td><b>' + esc(c.name || '—') + '</b></td><td>' + esc(c.phone || '—') + '</td><td>' + esc(c.email || '—') + '</td><td>' + esc(bnames || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="muted">' + esc(list.length ? T('Nada en esta búsqueda.', 'Nothing matches.') : T('Sin clientes', 'No clients')) + '</td></tr>';
    box.innerHTML =
      '<div class="jobs-toolbar"><h2>' + esc(T('Clientes', 'Clients')) + '</h2>' +
        '<button class="btn" onclick="openClientEditorNew()">' + esc(T('+ Cliente', '+ Client')) + '</button></div>' +
      '<div class="jobs-toolbar"><input id="clientSearch" type="search" placeholder="' + esc(T('Buscar cliente…', 'Search clients…')) + '" value="' + esc(window.clientUi.q || '') + '" oninput="openClients(this.value)"></div>' +
      '<table class="jobs-table"><thead><tr><th>' + esc(T('Nombre', 'Name')) + '</th><th>' + esc(T('Teléfono', 'Phone')) + '</th><th>' + esc(T('Correo', 'Email')) + '</th><th>' + esc(T('Edificios', 'Buildings')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
  };
  window.openClientEditorNew = function (existing) {
    if (typeof canSeeClients === 'function' && !canSeeClients()) return;
    var c = existing || { name: '', phone: '', email: '', buildingIds: [] };
    var opts = (buildings || []).map(function (b) {
      var on = (c.buildingIds || []).indexOf(b.id) >= 0;
      return '<label style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" data-cbid="' + esc(b.id) + '"' + (on ? ' checked' : '') + '> ' + esc(b.name || b.id) + '</label>';
    }).join('') || '<p class="muted">' + esc(T('Todavía no hay edificios.', 'No buildings yet.')) + '</p>';
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:480px;max-width:96vw">' +
      '<h3>' + esc(c.id ? T('Cliente', 'Client') : T('Nuevo cliente', 'New client')) + '</h3>' +
      '<label class="muted">' + esc(T('Nombre', 'Name')) + '</label><input id="ncName" value="' + esc(c.name || '') + '">' +
      '<label class="muted">' + esc(T('Teléfono', 'Phone')) + '</label><input id="ncPhone" value="' + esc(c.phone || '') + '">' +
      '<label class="muted">' + esc(T('Correo', 'Email')) + '</label><input id="ncEmail" type="email" value="' + esc(c.email || '') + '">' +
      '<p class="muted">' + esc(T('Edificios', 'Buildings')) + '</p>' + opts +
      '<div class="err" id="ncErr"></div>' +
      '<button class="btn" onclick="saveClientDoc(\'' + esc(c.id || '') + '\')">' + esc(T('Guardar', 'Save')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
  };
  window.saveClientDoc = async function (id) {
    var err = $('ncErr');
    var name = ($('ncName').value || '').trim();
    if (!name) { if (err) err.textContent = T('Escribe el nombre.', 'Type the name.'); return; }
    var ids = [].map.call(document.querySelectorAll('#modal [data-cbid]:checked'), function (el) { return el.getAttribute('data-cbid'); });
    var payload = {
      name: name,
      phone: ($('ncPhone').value || '').trim(),
      email: ($('ncEmail').value || '').trim(),
      buildingIds: ids,
      companyId: cid(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (id) await col('clients').doc(id).set(payload, { merge: true });
      else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await col('clients').add(payload);
      }
      $('modal').classList.add('hidden');
      openClients(window.clientUi.q || '');
    } catch (e) { if (err) err.textContent = e.message || e; }
  };
  window.upsertOfficeClient = async function (data) {
    var name = String((data && data.name) || '').trim();
    if (!name || !cid()) return '';
    var email = String((data && data.email) || '').trim().toLowerCase();
    var list = await loadClients();
    var found = list.find(function (c) { return email && String(c.email || '').toLowerCase() === email; })
      || list.find(function (c) { return String(c.name || '').toLowerCase() === name.toLowerCase(); });
    var ids = (found && found.buildingIds) ? found.buildingIds.slice() : [];
    if (data.buildingId && ids.indexOf(data.buildingId) < 0) ids.push(data.buildingId);
    var payload = {
      name: name, phone: (data.phone || (found && found.phone) || ''), email: data.email || (found && found.email) || '',
      buildingIds: ids, companyId: cid(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (found) { await col('clients').doc(found.id).set(payload, { merge: true }); return found.id; }
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    var ref = await col('clients').add(payload);
    return ref.id;
  };
  window.openClient = async function (id) {
    if (typeof canSeeClients === 'function' && !canSeeClients()) return;
    show('view-clients');
    var box = pane();
    box.innerHTML = '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>';
    var d = await col('clients').doc(id).get();
    if (!d.exists) { openClients(); return; }
    var c = Object.assign({ id: d.id }, d.data());
    var name = String(c.name || '').toLowerCase();
    var bld = (c.buildingIds || []).map(function (bid) {
      var b = (buildings || []).find(function (x) { return x.id === bid; });
      return b ? esc(b.name || '') : '';
    }).filter(Boolean).join(', ') || esc(T('Sin edificios', 'No buildings'));
    var jobRows = (jobs || []).filter(function (j) {
      return !jobArchived(j) && (j.clientId === id || String(j.clientName || j.contactName || '').toLowerCase() === name);
    }).map(function (j) {
      return '<button type="button" class="daycard" onclick="openJobView(\'' + j.id + '\')"><div class="daycard-k">' + esc((j.jobNumber ? '#' + j.jobNumber + ' · ' : '') + (j.title || j.kind || '')) + '</div></button>';
    }).join('') || empty(T('Sin trabajos', 'No jobs'));
    var quotes = [], invoices = [], requests = [];
    try {
      if (canSeeMoney()) {
        var qs = await db.collection('companies').doc(cid()).collection('quotes').limit(500).get();
        qs.forEach(function (x) { var q = x.data(); if (String(q.client || '').toLowerCase() === name) quotes.push(Object.assign({ id: x.id }, q)); });
        var is = await db.collection('companies').doc(cid()).collection('invoices').limit(500).get();
        is.forEach(function (x) { var inv = x.data(); if (String(inv.client || '').toLowerCase() === name) invoices.push(Object.assign({ id: x.id }, inv)); });
      }
      var rs = await col('requests').limit(500).get();
      rs.forEach(function (x) { var r = x.data(); if (r.clientId === id || String(r.client || '').toLowerCase() === name) requests.push(Object.assign({ id: x.id }, r)); });
    } catch (_) {}
    var money = canSeeMoney();
    box._client = c;
    box.innerHTML =
      '<div class="job-actions"><button class="btn ghost" onclick="openClients()">← ' + esc(T('Clientes', 'Clients')) + '</button>' +
        '<button class="btn ghost" onclick="openClientEditorNew($(\'officePane\')._client)">' + esc(T('Editar', 'Edit')) + '</button></div>' +
      '<div class="job-sec"><h3>' + esc(c.name || '') + '</h3><p>' + esc(c.phone || '—') + '<br>' + esc(c.email || '—') + '</p><p class="muted">' + bld + '</p></div>' +
      '<div class="job-sec"><h3>' + esc(T('Trabajos', 'Jobs')) + '</h3>' + jobRows + '</div>' +
      '<div class="job-sec"><h3>' + esc(T('Solicitudes', 'Requests')) + '</h3>' + (requests.map(function (r) {
        return '<p><button type="button" class="btn ghost" onclick="openRequests()">' + esc(r.client || c.name) + ' · ' + esc(r.status || '') + '</button></p>';
      }).join('') || empty(T('Sin solicitudes', 'No requests'))) + '</div>' +
      (money ? '<div class="job-sec"><h3>' + esc(T('Cotizaciones', 'Quotes')) + '</h3>' + (quotes.map(function (q) {
        return '<p><button type="button" class="btn ghost" onclick="openQuote(\'' + q.id + '\')">#' + esc(q.number || '') + ' · ' + money(q.total) + '</button></p>';
      }).join('') || empty(T('Sin cotizaciones', 'No quotes'))) + '</div>' +
      '<div class="job-sec"><h3>' + esc(T('Facturas', 'Invoices')) + '</h3>' + (invoices.map(function (inv) {
        return '<p><button type="button" class="btn ghost" onclick="openInvoice(\'' + inv.id + '\')">#' + esc(inv.number || '') + ' · ' + money(inv.total) + '</button></p>';
      }).join('') || empty(T('Sin facturas', 'No invoices'))) + '</div>' : '');
  };

  /* ---------- Requests ---------- */
  var REQ = { new: ['Nueva', 'New'], review: ['En revisión', 'In review'], converted: ['Convertida en trabajo', 'Turned into a job'], rejected: ['Rechazada', 'Rejected'] };
  function reqLabel(s) { var x = REQ[s] || REQ.new; return T(x[0], x[1]); }
  window.requestUi = window.requestUi || { status: 'all' };
  window.openRequests = async function () {
    if (!canAssign()) return;
    show('view-requests');
    var box = pane();
    if (!box) return;
    box.innerHTML = '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>';
    var list = [];
    try {
      var snap = await col('requests').limit(500).get();
      snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
    } catch (e) { box.innerHTML = '<p class="err">' + esc(e.message || e) + '</p>'; return; }
    list.sort(function (a, b) { return String(b.createdDay || '').localeCompare(String(a.createdDay || '')); });
    var f = window.requestUi.status;
    var shown = list.filter(function (r) { return f === 'all' || (r.status || 'new') === f; });
    var n = function (s) { return list.filter(function (r) { return (r.status || 'new') === s; }).length; };
    var chip = function (key, label, count) {
      return '<button type="button" class="btn ' + (f === key ? '' : 'ghost') + '" onclick="requestUi.status=\'' + key + '\';openRequests()">' + esc(label) + ' (' + count + ')</button>';
    };
    var rows = shown.map(function (r) {
      var b = (buildings || []).find(function (x) { return x.id === r.buildingId; });
      return '<tr onclick="openRequest(\'' + r.id + '\')"><td>' + esc(r.client || '—') + '</td><td>' + esc(r.createdDay || '—') + '</td><td>' + esc(r.description || '') + '</td><td>' + esc((b && b.name) || '—') + '</td><td>' + esc(reqLabel(r.status || 'new')) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">' + esc(list.length ? T('Nada en este filtro.', 'Nothing in this filter.') : T('Sin solicitudes', 'No requests')) + '</td></tr>';
    box.innerHTML =
      '<div class="jobs-toolbar"><h2>' + esc(T('Solicitudes', 'Requests')) + '</h2><button class="btn" onclick="openRequestEditor()">' + esc(T('+ Solicitud', '+ Request')) + '</button></div>' +
      '<div class="chip-row">' + chip('new', reqLabel('new'), n('new')) + chip('review', reqLabel('review'), n('review')) + chip('converted', reqLabel('converted'), n('converted')) + chip('rejected', reqLabel('rejected'), n('rejected')) + chip('all', T('Todas', 'All'), list.length) + '</div>' +
      '<table class="jobs-table"><thead><tr><th>' + esc(T('Cliente', 'Client')) + '</th><th>' + esc(T('Fecha', 'Date')) + '</th><th>' + esc(T('Descripción', 'Description')) + '</th><th>' + esc(T('Edificio', 'Building')) + '</th><th>' + esc(T('Estado', 'Status')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
  };
  window.openRequestEditor = function () {
    if (!canAssign()) return;
    var bopts = '<option value="">' + esc(T('Edificio…', 'Building…')) + '</option>' +
      (buildings || []).map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name || '') + '</option>'; }).join('');
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:480px;max-width:96vw"><h3>' + esc(T('Nueva solicitud', 'New request')) + '</h3>' +
      '<label class="muted">' + esc(T('Cliente', 'Client')) + '</label><input id="rqClient">' +
      '<label class="muted">' + esc(T('Teléfono', 'Phone')) + '</label><input id="rqPhone">' +
      '<label class="muted">' + esc(T('Correo', 'Email')) + '</label><input id="rqEmail" type="email">' +
      '<label class="muted">' + esc(T('Edificio', 'Building')) + '</label><select id="rqB">' + bopts + '</select>' +
      '<label class="muted">' + esc(T('Descripción', 'Description')) + '</label><textarea id="rqDesc" rows="3"></textarea>' +
      '<div class="err" id="rqErr"></div>' +
      '<button class="btn" onclick="saveRequest()">' + esc(T('Guardar', 'Save')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(T('Cancelar', 'Cancel')) + '</button></div>';
  };
  window.saveRequest = async function () {
    var err = $('rqErr');
    var client = ($('rqClient').value || '').trim();
    var description = ($('rqDesc').value || '').trim();
    if (!client || !description) { if (err) err.textContent = T('Cliente y descripción son obligatorios.', 'Client and description are required.'); return; }
    try {
      var clientId = await upsertOfficeClient({ name: client, phone: $('rqPhone').value, email: $('rqEmail').value, buildingId: $('rqB').value });
      await col('requests').add({
        client: client, clientId: clientId || '', phone: ($('rqPhone').value || '').trim(), email: ($('rqEmail').value || '').trim(),
        buildingId: $('rqB').value || '', description: description, status: 'new', companyId: cid(),
        createdDay: ymd(new Date()), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      $('modal').classList.add('hidden');
      openRequests();
    } catch (e) { if (err) err.textContent = e.message || e; }
  };
  window.openRequest = async function (id) {
    var d = await col('requests').doc(id).get();
    if (!d.exists) { openRequests(); return; }
    var r = Object.assign({ id: d.id }, d.data());
    var b = (buildings || []).find(function (x) { return x.id === r.buildingId; });
    show('view-requests');
    pane().innerHTML =
      '<div class="job-actions"><button class="btn ghost" onclick="openRequests()">← ' + esc(T('Solicitudes', 'Requests')) + '</button>' +
        (r.status !== 'converted' ? '<button class="btn" onclick="convertRequest(\'' + id + '\')">' + esc(T('Convertir en trabajo', 'Turn into a job')) + '</button>' : '') +
        (r.status !== 'rejected' && r.status !== 'converted' ? '<button class="btn ghost" onclick="setRequestStatus(\'' + id + '\',\'review\')">' + esc(reqLabel('review')) + '</button><button class="btn ghost" onclick="setRequestStatus(\'' + id + '\',\'rejected\')">' + esc(reqLabel('rejected')) + '</button>' : '') +
        (r.jobId ? '<button class="btn ghost" onclick="openJobView(\'' + r.jobId + '\')">' + esc(T('Ver trabajo', 'Open job')) + '</button>' : '') +
      '</div>' +
      '<div class="job-sec"><h3>' + esc(r.client || '') + '</h3><p>' + esc(reqLabel(r.status || 'new')) + '</p><p>' + esc(r.description || '') + '</p><p class="muted">' + esc((b && b.name) || '') + ' · ' + esc(r.createdDay || '') + '</p></div>';
  };
  window.setRequestStatus = async function (id, status) {
    await col('requests').doc(id).set({ status: status }, { merge: true });
    openRequest(id);
  };
  window.convertRequest = async function (id) {
    if (!canAssign()) return;
    var d = await col('requests').doc(id).get();
    if (!d.exists) return;
    var r = d.data() || {};
    if (r.status === 'converted' && r.jobId) { openJobView(r.jobId); return; }
    var b = (buildings || []).find(function (x) { return x.id === r.buildingId; });
    var title = (b && (b.address || b.name)) || r.client || T('Trabajo', 'Job');
    var day = ymd(new Date());
    var start = new Date(day + 'T09:00:00'), end = new Date(day + 'T11:00:00');
    var clientId = r.clientId || await upsertOfficeClient({ name: r.client, phone: r.phone, email: r.email, buildingId: r.buildingId });
    var job = {
      companyId: cid(), companyName: companyName || '', buildingId: r.buildingId || '', clientId: clientId || '',
      title: title, address: (b && (b.address || b.name)) || '', clientName: r.client || '', contactName: r.client || '',
      contactPhone: r.phone || '', contactEmail: r.email || '',
      kind: T('Solicitud', 'Request'), description: r.description || '', instructions: r.description || '',
      lines: [{ name: T('Solicitud', 'Request'), description: r.description || '', qty: 1, unitPrice: 0, total: 0 }],
      visits: [{ id: 'v1', scheduledDate: day, startClock: '09:00', endClock: '11:00', hour: 9, minute: 0, endHour: 11, endMinute: 0, assignedUid: '', status: 'open', instructions: r.description || '', checklists: ['inspection', 'jobReport'], title: title }],
      expenses: [], notesLog: [], status: 'open', scheduledDate: day, startClock: '09:00', endClock: '11:00',
      hour: 9, minute: 0, endHour: 11, endMinute: 0, requestId: id,
      appointment_start: firebase.firestore.Timestamp.fromDate(start), appointment_end: firebase.firestore.Timestamp.fromDate(end),
      assignedUid: '', workerId: '', assignedName: '', unassigned: true, companyType: typeof companyType !== 'undefined' ? companyType : ''
    };
    var coRef = db.collection('companies').doc(cid());
    var jobRef = db.collection('jobs').doc();
    await db.runTransaction(async function (tx) {
      var co = await tx.get(coRef);
      var n = ((co.exists && co.data().jobSeq) || 0) + 1;
      tx.set(coRef, { jobSeq: n }, { merge: true });
      tx.set(jobRef, Object.assign({}, job, { jobNumber: String(n), createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: (auth.currentUser && auth.currentUser.uid) || '' }));
    });
    await col('requests').doc(id).set({ status: 'converted', jobId: jobRef.id, clientId: clientId || '' }, { merge: true });
    if (typeof openJobView === 'function') openJobView(jobRef.id);
  };

  /* ---------- Payments (from real invoices; a pending stays pending until a payment is saved) ---------- */
  window.payUi = window.payUi || { tab: 'pending' };
  window.openPayments = async function () {
    if (!canSeeMoney()) return;
    show('view-payments');
    var box = pane();
    if (!box) return;
    box.innerHTML = '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>';
    var invoices = [];
    try {
      var snap = await db.collection('companies').doc(cid()).collection('invoices').limit(500).get();
      snap.forEach(function (d) { invoices.push(Object.assign({ id: d.id }, d.data())); });
    } catch (e) { box.innerHTML = '<p class="err">' + esc(e.message || e) + '</p>'; return; }
    var tab = window.payUi.tab;
    var rows = [];
    invoices.forEach(function (inv) {
      var st = window.invoicePayStatus ? invoicePayStatus(inv) : 'pending';
      if (st === 'draft' || st === 'sent') st = 'pending';
      var paidAmt = (inv.payments || []).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
      (inv.payments || []).forEach(function (p) {
        rows.push({ kind: 'paid', client: inv.client || '', invoice: inv.number || '', id: inv.id, date: p.date || '', amount: Number(p.amount || 0), status: 'paid' });
      });
      if (st === 'paid' && !(inv.payments || []).length) {
        rows.push({ kind: 'paid', client: inv.client || '', invoice: inv.number || '', id: inv.id, date: inv.issueDate || '', amount: Number(inv.total || 0), status: 'paid' });
      }
      var due = Math.max(0, Number(inv.total || 0) - paidAmt);
      if (st !== 'paid' && due > 0) rows.push({ kind: st === 'overdue' ? 'overdue' : 'pending', client: inv.client || '', invoice: inv.number || '', id: inv.id, date: inv.dueDate || inv.issueDate || '', amount: due, status: st === 'overdue' ? 'overdue' : 'pending' });
    });
    var shown = rows.filter(function (r) { return tab === 'all' || r.kind === tab || (tab === 'pending' && r.kind === 'pending'); });
    var count = function (k) { return rows.filter(function (r) { return r.kind === k; }).length; };
    var chip = function (key, label, n) {
      return '<button type="button" class="btn ' + (tab === key ? '' : 'ghost') + '" onclick="payUi.tab=\'' + key + '\';openPayments()">' + esc(label) + ' (' + n + ')</button>';
    };
    var body = shown.map(function (r) {
      var label = r.status === 'paid' ? T('Pagado', 'Paid') : r.status === 'overdue' ? T('Vencido', 'Overdue') : T('Pendiente', 'Pending');
      return '<tr onclick="openInvoice(\'' + r.id + '\')"><td>' + esc(r.client || '—') + '</td><td>#' + esc(r.invoice || '') + '</td><td>' + esc(r.date || '—') + '</td><td>' + money(r.amount) + '</td><td>' + esc(label) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">' + esc(rows.length ? T('Nada en este filtro.', 'Nothing in this filter.') : T('Sin pagos', 'No payments')) + '</td></tr>';
    box.innerHTML =
      '<div class="jobs-toolbar"><h2>' + esc(T('Pagos', 'Payments')) + '</h2></div>' +
      '<p class="muted">' + esc(T('Un pendiente cambia a pagado solo cuando el pago se registra en la factura.', 'A pending row becomes paid only when the payment is recorded on the invoice.')) + '</p>' +
      '<div class="chip-row">' + chip('paid', T('Pagados', 'Paid'), count('paid')) + chip('pending', T('Pendientes', 'Pending'), count('pending')) + chip('overdue', T('Vencidos', 'Overdue'), count('overdue')) + '</div>' +
      '<table class="jobs-table"><thead><tr><th>' + esc(T('Cliente', 'Client')) + '</th><th>' + esc(T('Factura', 'Invoice')) + '</th><th>' + esc(T('Fecha', 'Date')) + '</th><th>' + esc(T('Monto', 'Amount')) + '</th><th>' + esc(T('Estado', 'Status')) + '</th></tr></thead><tbody>' + body + '</tbody></table>';
  };
})();
