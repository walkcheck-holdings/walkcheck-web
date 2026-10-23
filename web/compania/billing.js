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
      var st = invStatus(inv);
      return '<div class="inv-row">' +
        '<div><b>' + esc(inv.number) + '</b> · ' + money(inv.total) +
        '<div class="muted">' + esc(inv.kind || '') + ' · ' + esc(inv.building || '') + ' · ' + esc(inv.issueDate || '') + '</div></div>' +
        '<span class="st-pill ' + (st === 'paid' ? 'on' : 'off') + '">' + esc(statusLabel(st)) + '</span>' +
        '<button type="button" class="btn ghost" onclick="openInvoice(\'' + inv.id + '\')">Abrir</button>' +
        '</div>';
    }).join('') || '<p class="muted">Todavía no hay facturas. Completa un trabajo y pulsa Crear factura.</p>';
    pane.innerHTML =
      '<div class="inv-kpis">' +
        '<div class="inv-kpi"><span>Pagada</span><b>' + money(paid) + '</b></div>' +
        '<div class="inv-kpi"><span>Pendiente</span><b>' + money(pend) + '</b></div>' +
        '<div class="inv-kpi"><span>Vencida</span><b>' + money(over) + '</b></div>' +
      '</div>' +
      '<div class="card"><h3 style="margin:0 0 8px">' + esc(uiT('money')) + '</h3>' +
      '<p class="muted">Precios por tipo de trabajo (solo dueño). El empleado no los ve.</p>' +
      '<label class="muted">Impuesto %</label>' +
      '<input id="taxPct" type="number" min="0" step="0.1" value="' + (Number(companyTaxRate || 0) * 100) + '">' +
      priceRows +
      '<button class="btn" style="margin-top:10px" onclick="saveBillingSettings()">Guardar precios</button></div>' +
      list +
      '<button class="btn ghost" onclick="document.body.classList.remove(\'view-billing\');renderSchedule()">Volver al horario</button>';
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
      var kind = j.kind || j.title || 'Job';
      lines = [{ name: kind, desc: j.description || '', qty: 1, unitPrice: 0, amount: 0 }];
    }
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
    $('modal').classList.remove('hidden');
    var lineHtml = (draft.lines || []).map(function (l, i) {
      return '<div class="line-row" style="grid-template-columns:1fr 2fr 70px 90px">' +
        '<input data-lname="' + i + '" value="' + esc(l.name || '') + '">' +
        '<textarea data-ldesc="' + i + '" rows="3">' + esc(l.desc || '') + '</textarea>' +
        '<input data-lqty="' + i + '" type="number" min="0" step="1" value="' + Number(l.qty || 1) + '">' +
        '<input data-lamt="' + i + '" type="number" min="0" step="0.01" value="' + Number(l.unitPrice != null ? l.unitPrice : l.amount || 0) + '">' +
        '</div>';
    }).join('');
    $('modal').innerHTML = '<div class="box" style="width:520px;max-width:96vw">' +
      '<h3>' + (existing && existing.number ? esc(existing.number) : esc(uiT('newInvoice'))) + '</h3>' +
      '<p class="muted">Invoice for Job #' + esc(draft.jobNumber || jobId) + '</p>' +
      '<p class="muted">' + esc(draft.companyName) + '<br>' + esc(draft.building) + ' · ' + esc(draft.client) + '</p>' +
      lineHtml +
      '<button type="button" class="btn ghost" onclick="addInvoiceLine()">+ Línea extra</button>' +
      '<label class="muted">Payment terms</label><input id="invTerms" type="text" value="' + esc(draft.paymentTerms || 'Due upon receipt') + '">' +
      '<label class="muted">Salesperson</label><input id="invSales" type="text" value="' + esc(draft.salesperson || '') + '">' +
      '<label><input type="checkbox" id="invTax"' + (draft.chargeTax ? ' checked' : '') + '> ' +
        esc(loginLang() === 'en' ? 'Charge tax (off for property management)' : 'Cobrar tax (apagado en manejo de propiedades)') + '</label>' +
      '<label class="muted">Issued</label><p>Draft — ' + esc(loginLang() === 'en' ? 'not sent until work photos are on the job' : 'no se envía hasta subir las fotos del trabajo') + '</p>' +
      '<div class="err" id="invErr"></div>' +
      '<button class="btn" onclick="saveInvoiceFromEditor(\'' + esc(jobId) + '\',' + (existing && existing.id ? '\'' + existing.id + '\'' : 'null') + ')">Save Invoice</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
    $('modal')._draft = draft;
  };
  window.addInvoiceLine = function () {
    var d = $('modal')._draft; if (!d) return;
    d.lines = readEditorLines(d);
    d.lines.push({ name: '', desc: '', qty: 1, unitPrice: 0, amount: 0 });
    d.paymentTerms = ($('invTerms') && $('invTerms').value) || d.paymentTerms;
    d.salesperson = ($('invSales') && $('invSales').value) || d.salesperson;
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
    draft.lines = readEditorLines(draft);
    draft.paymentTerms = ($('invTerms') && $('invTerms').value) || 'Due upon receipt';
    draft.salesperson = ($('invSales') && $('invSales').value) || draft.salesperson;
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
    $('billingPane').innerHTML =
      '<div class="inv-actions">' +
        '<button class="btn ghost" onclick="openBilling()">← ' + esc(uiT('money')) + '</button>' +
        (inv.jobId ? '<button class="btn ghost" onclick="openJobDetail(\'' + inv.jobId + '\')">Job #' + esc(inv.jobNumber || '') + '</button>' : '') +
        '<button class="btn" onclick="downloadInvoicePdf()">PDF</button>' +
        (canSendInvoice(jobs.find(function (x) { return x.id === inv.jobId; }) || {}, inv)
          ? '<button class="btn" onclick="openEmailInvoice(\'' + id + '\')">Email</button>' +
            '<button class="btn" style="background:#34C759" onclick="sendInvoiceSms(\'' + id + '\')">Send Text Message</button>'
          : '<p class="muted">' + esc(loginLang() === 'en' ? 'Draft: upload BEFORE and AFTER job photos before sending.' : 'Borrador: sube fotos de ANTES y DESPUÉS del trabajo antes de enviar.') + '</p>') +
      '</div>' +
      '<div class="inv-paper" id="invPaper">' +
        '<div class="rpt-brand"><div class="rpt-logo">' + esc((inv.companyName || 'W').charAt(0)) + '</div>' +
        '<div><h2 style="margin:0">' + esc(inv.companyName || companyName) + '</h2></div></div>' +
        '<p><b>Invoice #' + esc(inv.number) + '</b></p>' +
        '<p>Invoice for Job #' + esc(inv.jobNumber || '') + '</p>' +
        '<p>Issued: ' + esc(statusLabel(st)) + '</p>' +
        '<p>Payment terms: ' + esc(inv.paymentTerms || 'Due upon receipt') + '</p>' +
        '<p>Salesperson: ' + esc(inv.salesperson || '') + '</p>' +
        '<p>' + esc(inv.client || '—') + '<br>' + esc(inv.building) + '</p>' +
        '<table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p>Subtotal ' + money(inv.subtotal) + '<br>Tax ' + money(inv.tax) + '<br><b>Total ' + money(inv.total) + '</b></p>' +
        '<p>with ' + money(dueAmt) + ' to be paid by ' + esc(inv.paymentTerms || 'upon receipt') + '</p>' +
      '</div>' +
      '<div class="job-sec"><h3>Payments</h3>' + pays +
      (st !== 'paid' ? '<label class="muted">Amount</label><input id="payAmt" type="number" min="0" step="0.01">' +
        '<label class="muted">Date</label><input id="payDate" type="date" value="' + ymd(new Date()) + '">' +
        '<label class="muted">Method</label><input id="payMethod" type="text">' +
        '<button class="btn" onclick="saveInvoicePayment(\'' + id + '\')">' + esc(loginLang() === 'en' ? 'Record payment' : 'Registrar pago') + '</button>' : '') +
      '</div>' +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Sends' : 'Envíos') + '</h3>' + sends + '</div>' +
      '<div class="job-sec"><h3>Notes</h3>' + notes +
      '<textarea id="invNote" rows="2"></textarea><button class="btn ghost" onclick="addInvoiceNote(\'' + id + '\')">' + esc(loginLang() === 'en' ? 'Add note' : 'Agregar nota') + '</button></div>';
    $('billingPane')._inv = inv;
  };
  window.downloadInvoicePdf = function () {
    var el = $('invPaper');
    var inv = $('billingPane')._inv || {};
    if (!el || !window.html2pdf) { window.print(); return; }
    html2pdf().set({ margin: 10, filename: (inv.number || 'factura') + '.pdf', html2canvas: { scale: 2 } }).from(el).save();
  };
  function invoiceMailCopy(inv) {
    var co = inv.companyName || companyName || '';
    var addr = inv.address || inv.building || '';
    var tot = money(inv.total);
    var terms = inv.paymentTerms || 'upon receipt';
    var en = loginLang() === 'en';
    return {
      subject: 'Invoice from ' + co + ' – ' + addr,
      body: (en
        ? ('Hello ' + (inv.client || '') + ',\nThank you for your valued business with us. The invoice total is ' + tot + ', with ' + tot + ' to be paid by ' + terms + '.')
        : ('Hola ' + (inv.client || '') + ',\nGracias por su negocio. El total de la factura es ' + tot + ', con ' + tot + ' a pagar ' + terms + '.'))
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
    var photos = jobPhotos(j);
    var quotes = (j.quoteAttachments || inv.quoteAttachments || []);
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:480px;max-width:96vw"><h3>Email Invoice #' + esc(inv.number) + ' to ' + esc(inv.client || '') + '</h3>' +
      '<label class="muted">To</label><input id="emTo" type="email" value="' + esc(inv.clientEmail || '') + '">' +
      '<label class="muted">Subject</label><input id="emSub" type="text" value="' + esc(copy.subject) + '">' +
      '<label class="muted">Body</label><textarea id="emBody" rows="6">' + esc(copy.body) + '</textarea>' +
      '<p class="muted">Attachments: PDF + photos' + (quotes.length ? ' + quote' : '') + '</p>' +
      photos.concat(quotes.map(function (q) { return typeof q === 'string' ? q : (q.url || ''); }).filter(Boolean)).map(function (u) { return '<div class="thumbs"><img src="' + esc(u) + '"></div>'; }).join('') +
      '<button class="btn" onclick="sendInvoiceMail(\'' + id + '\')">Send Email</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
  };
  window.sendInvoiceMail = async function (id) {
    var inv = $('billingPane')._inv || {};
    var j = jobs.find(function (x) { return x.id === inv.jobId; }) || {};
    if (!canSendInvoice(j, inv)) {
      alert(loginLang() === 'en' ? 'The invoice stays in Draft until work photos are uploaded.' : 'La factura se queda en borrador hasta subir las fotos del trabajo.');
      return;
    }
    var to = ($('emTo') && $('emTo').value) || inv.clientEmail || '';
    var sub = ($('emSub') && $('emSub').value) || invoiceMailCopy(inv).subject;
    var body = ($('emBody') && $('emBody').value) || invoiceMailCopy(inv).body;
    downloadInvoicePdf();
    var sends = (inv.sends || []).slice();
    sends.push({ channel: 'email', to: to, at: new Date().toISOString() });
    try {
      await db.collection('companies').doc(cid()).collection('invoices').doc(id || inv.id).set({
        sends: sends, issuedStatus: 'sent', status: invStatus(Object.assign({}, inv, { issuedStatus: 'sent', sends: sends })) === 'paid' ? 'paid' : 'sent'
      }, { merge: true });
    } catch (e) { alert(e.message || e); return; }
    $('modal').classList.add('hidden');
    location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(body);
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
