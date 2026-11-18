/* Edificios y Materiales: secciones propias del menú (oficina).
   Edificios = los mismos de buildings/{id} (y la copia en companies/{id}/buildings)
   que usan el horario, los reportes y "Crear trabajo".
   Materiales = la lista de materiales de la compañía (companies/{id}/materials:
   nombre, unidad, precio, proveedor) y lo que se compró en los trabajos
   (Total Material Cost, proveedor y recibo de cada Job Report, y los gastos
   anotados en el trabajo). */
(function () {
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function toD(x) { if (!x) return null; var d = x.toDate ? x.toDate() : new Date(x); return isNaN(d) ? null : d; }
  function coCol(n) { return db.collection('companies').doc(cid()).collection(n); }
  function jobList() { return (typeof jobs !== 'undefined' ? jobs : []).filter(function (j) { return j && !(typeof jobArchived === 'function' && jobArchived(j)); }); }

  // ------------------------------------------------------------- the view
  window.plCloseModal = function () { var m = $('modal'); if (m) { m.classList.add('hidden'); m.innerHTML = ''; } };
  (function () {
    var st = document.createElement('style');
    var hide = ['#staffMain', '#hoursPane', '#reportsPane', '#homePane', '#searchPane', '#billingPane', '#archivedPane', '#jobsPane',
      '#jobPane', '#officePane', '#rolesPane', '#workerPane', '#lvPane', '.weekbar', '#sidebar'];
    st.textContent = '#placesPane{display:none;flex:1;overflow:auto;background:#F2F2F7;padding:16px}' +
      'body.view-places #placesPane{display:block}' +
      hide.map(function (x) { return 'body.view-places ' + x; }).join(',') + '{display:none!important}' +
      '@media (max-width:760px){#placesPane{padding:10px 10px 88px}}';
    document.head.appendChild(st);
  })();
  var OTHER = ['view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived',
    'view-home', 'view-search', 'sites-open', 'view-jobs', 'view-job', 'view-payments', 'view-requests', 'view-clients',
    'view-quotes', 'view-lv', 'view-payroll'];
  var current = '';
  function pane() {
    var p = $('placesPane');
    if (!p) {
      p = document.createElement('div');
      p.id = 'placesPane';
      var after = $('jobPane');
      if (after && after.parentNode) after.parentNode.insertBefore(p, after.nextSibling);
      else document.body.appendChild(p);
    }
    return p;
  }
  function enter(which) {
    if (typeof closeMore === 'function') { try { closeMore(); } catch (_) {} }
    if (typeof closeCreate === 'function') { try { closeCreate(); } catch (_) {} }
    OTHER.forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('view-places');
    current = which;
    paintRail();
    window.scrollTo(0, 0);
    var p = pane(); p.scrollTop = 0;
    return p;
  }
  function leave() {
    if (!document.body.classList.contains('view-places')) return;
    document.body.classList.remove('view-places');
    current = '';
    paintRail();
  }
  function paintRail() {
    var on = { railBuildings: current === 'buildings', railMaterials: current === 'materials' };
    Object.keys(on).forEach(function (id) { var b = $(id); if (b) b.classList.toggle('on', on[id]); });
    if (current) document.querySelectorAll('#appRail .rail-item').forEach(function (b) { if (!(b.id in on)) b.classList.remove('on'); });
  }
  // Any other screen of the panel closes ours.
  new MutationObserver(function () {
    var b = document.body.classList;
    if (b.contains('view-places') && OTHER.some(function (c) { return b.contains(c); })) leave();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  ['navHorario', 'goToday', 'navHome', 'setSchedView', 'navTeam', 'navHours'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () { leave(); return orig.apply(this, arguments); };
  });
  function showRail() {
    var office = typeof canAssign === 'function' && canAssign();
    var b = $('railBuildings'); if (b) b.classList.toggle('hidden', !office);
    var m = $('railMaterials'); if (m) m.classList.toggle('hidden', !office);
  }
  setInterval(showRail, 1500);

  // ============================================================ EDIFICIOS
  var bq = '';
  function siteK(s) { return typeof siteKey === 'function' ? siteKey(s) : String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function jobsOf(b) {
    var bk = siteK(b.address || b.name), nk = siteK(b.name);
    return jobList().filter(function (j) {
      if (j.buildingId && j.buildingId === b.id) return true;
      var a = siteK(j.address || j.title || '');
      return !!a && (a === bk || a === nk);
    });
  }
  var clientsCache = null;
  async function loadClientsOnce() {
    if (clientsCache) return clientsCache;
    try { clientsCache = typeof loadClientsList === 'function' ? await loadClientsList() : []; } catch (_) { clientsCache = []; }
    return clientsCache;
  }
  function clientOf(b) {
    var c = (clientsCache || []).find(function (x) { return (x.buildingIds || []).indexOf(b.id) >= 0; });
    return (c && c.name) || b.clientName || '';
  }
  window.openBuildingsPage = async function (q) {
    if (typeof canAssign === 'function' && !canAssign()) return;
    var p = current === 'buildings' && q != null ? pane() : enter('buildings');
    if (q != null) bq = q;
    if (!clientsCache && typeof canSeeClients === 'function' && canSeeClients()) { p.innerHTML = '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>'; await loadClientsOnce(); }
    var query = String(bq || '').toLowerCase();
    var list = (typeof buildings !== 'undefined' ? buildings : []).slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    var rows = list.map(function (b) {
      var js = jobsOf(b);
      var last = js.map(function (j) { return String(j.scheduledDate || '').slice(0, 10); }).filter(Boolean).sort().pop() || '';
      return { b: b, n: js.length, last: last, client: clientOf(b) };
    }).filter(function (r) {
      return !query || [r.b.name, r.b.address, r.client].join(' ').toLowerCase().indexOf(query) >= 0;
    });
    var canDel = typeof canSeeMoney === 'function' && canSeeMoney();
    p.innerHTML = css() +
      '<div class="pl-page"><div class="pl-head"><div><h2>' + esc(T('Edificios', 'Buildings')) + '</h2>' +
        '<p class="muted">' + esc(T('Todas las propiedades donde trabajas. Se guardan solas al crear un trabajo con una dirección nueva.', 'Every property you work at. They save on their own when you create a job at a new address.')) + '</p></div>' +
        '<button class="btn pl-btn" onclick="editBuilding()">+ ' + esc(T('Edificio', 'Building')) + '</button></div>' +
      '<input id="plSearch" class="pl-search" type="search" placeholder="' + esc(T('Buscar por nombre, dirección o cliente…', 'Search by name, address or client…')) + '" value="' + esc(bq) + '" oninput="openBuildingsPage(this.value)">' +
      '<div class="pl-count muted">' + esc(rows.length + ' ' + (rows.length === 1 ? T('edificio', 'building') : T('edificios', 'buildings'))) + '</div>' +
      (rows.length ? '<div class="pl-tbl-wrap"><table class="pl-tbl"><thead><tr><th>' + esc(T('Edificio', 'Building')) + '</th><th>' + esc(T('Cliente', 'Client')) + '</th><th class="r">' + esc(T('Trabajos', 'Jobs')) + '</th><th>' + esc(T('Último trabajo', 'Last job')) + '</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          var b = r.b, same = !b.address || siteK(b.address) === siteK(b.name);
          return '<tr><td><b>' + esc(b.name || b.address || '—') + '</b>' + (same ? '' : '<div class="muted">' + esc(b.address) + '</div>') + '</td>' +
            '<td>' + esc(r.client || '—') + '</td><td class="r">' + r.n + '</td><td>' + esc(r.last || '—') + '</td>' +
            '<td class="pl-acts"><button class="pl-a" onclick="editBuilding(\'' + esc(b.id) + '\')">' + esc(T('Editar', 'Edit')) + '</button>' +
              (r.n ? '<button class="pl-a" onclick="buildingJobs(\'' + esc(b.id) + '\')">' + esc(T('Ver trabajos', 'See jobs')) + '</button>' : '') +
              (canDel ? '<button class="pl-a del" onclick="deleteBuilding(\'' + esc(b.id) + '\')">' + esc(T('Borrar', 'Delete')) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="pl-empty">' + esc(query ? T('Nada con esa búsqueda.', 'Nothing matches.') : T('Todavía no hay edificios. Toca "+ Edificio" o crea un trabajo con su dirección.', 'No buildings yet. Tap "+ Building" or create a job with its address.')) + '</div>') +
      '</div>';
    if (q != null && $('plSearch')) { var s = $('plSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  };
  window.buildingJobs = function (id) {
    var b = (buildings || []).find(function (x) { return x.id === id; });
    if (!b || typeof openJobs !== 'function') return;
    openJobs(b.address || b.name || '');
  };
  window.editBuilding = function (id) {
    var b = id ? (buildings || []).find(function (x) { return x.id === id; }) : null;
    b = b || { name: '', address: '', notes: '' };
    var m = $('modal');
    if (!m) return;
    m.classList.remove('hidden');
    m.innerHTML = '<div class="box" style="width:460px;max-width:96vw"><h3>' + esc(id ? T('Editar edificio', 'Edit building') : T('Nuevo edificio', 'New building')) + '</h3>' +
      '<label class="muted">' + esc(T('Nombre', 'Name')) + '</label><input id="pbName" value="' + esc(b.name || '') + '" placeholder="' + esc(T('Ej.: Harding Towers', 'E.g.: Harding Towers')) + '">' +
      '<label class="muted">' + esc(T('Dirección', 'Address')) + '</label><input id="pbAddr" value="' + esc(b.address || '') + '" placeholder="8000 Harding Ave, Miami Beach, FL">' +
      '<label class="muted">' + esc(T('Notas (código de la puerta, contacto…)', 'Notes (gate code, contact…)')) + '</label><input id="pbNotes" value="' + esc(b.notes || '') + '">' +
      '<p class="err" id="pbErr"></p>' +
      '<div style="display:flex;gap:8px"><button class="btn ghost" onclick="plCloseModal()">' + esc(T('Cancelar', 'Cancel')) + '</button>' +
      '<button class="btn" onclick="saveBuilding(\'' + esc(id || '') + '\')">' + esc(T('Guardar', 'Save')) + '</button></div></div>';
    setTimeout(function () { var x = $('pbName'); if (x) x.focus(); }, 30);
  };
  window.saveBuilding = async function (id) {
    var name = ($('pbName').value || '').trim(), addr = ($('pbAddr').value || '').trim(), notes = ($('pbNotes').value || '').trim();
    if (!name && !addr) { $('pbErr').textContent = T('Pon el nombre o la dirección.', 'Enter the name or the address.'); return; }
    name = name || addr; addr = addr || name;
    if (!id) {
      var k = siteK(addr), nk = siteK(name);
      var dup = (buildings || []).find(function (b) { return siteK(b.address || b.name) === k || siteK(b.name) === nk; });
      if (dup) { $('pbErr').textContent = T('Ese edificio ya está guardado: ', 'That building is already saved: ') + (dup.name || dup.address); return; }
    }
    try {
      var ref = id ? db.collection('buildings').doc(id) : db.collection('buildings').doc();
      var data = { id: ref.id, name: name, address: addr, notes: notes, companyId: cid() };
      if (!id) Object.assign(data, { floors: 1, kind: (typeof isPm === 'function' && isPm()) ? 'Inspections' : 'Site', companyType: (typeof companyType !== 'undefined' ? companyType : '') });
      await ref.set(data, { merge: true });
      try { await coCol('buildings').doc(ref.id).set({ id: ref.id, name: name, address: addr, notes: notes, companyId: cid() }, { merge: true }); } catch (_) {}
      var cur = (buildings || []).find(function (b) { return b.id === ref.id; });
      if (cur) Object.assign(cur, data); else buildings.push(Object.assign({}, data));
      plCloseModal();
      try { if (typeof renderBuildings === 'function') renderBuildings(); } catch (_) {}
      openBuildingsPage();
    } catch (e) { $('pbErr').textContent = T('No se pudo guardar: ', 'Could not save: ') + (e.message || e); }
  };
  window.deleteBuilding = async function (id) {
    var b = (buildings || []).find(function (x) { return x.id === id; });
    if (!b) return;
    var n = jobsOf(b).length;
    var msg = T('¿Borrar el edificio "' + (b.name || b.address) + '"?', 'Delete building "' + (b.name || b.address) + '"?') +
      (n ? '\n\n' + T('Sus ' + n + ' trabajo(s) NO se borran; solo deja de salir en la lista de edificios.', 'Its ' + n + ' job(s) are NOT deleted; it just leaves the buildings list.') : '');
    if (!confirm(msg)) return;
    try {
      await db.collection('buildings').doc(id).delete();
      try { await coCol('buildings').doc(id).delete(); } catch (_) {}
      buildings.splice(buildings.indexOf(b), 1);
      try { if (typeof renderBuildings === 'function') renderBuildings(); } catch (_) {}
      openBuildingsPage();
    } catch (e) { alert(T('No se pudo borrar: ', 'Could not delete: ') + (e.message || e)); }
  };

  // =========================================================== MATERIALES
  var mats = null, matYm = '';
  async function loadMats() {
    var out = [];
    try { var s = await coCol('materials').limit(500).get(); s.forEach(function (d) { out.push(Object.assign({ id: d.id }, d.data())); }); } catch (_) {}
    out.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    mats = out;
    return out;
  }
  // What was bought for the jobs in a month: Job Report material cost (with
  // supplier and receipt) and expenses typed on the job.
  function purchases(ym) {
    var out = [];
    jobList().forEach(function (j) {
      var r = j.report || {};
      var day = String(j.scheduledDate || '').slice(0, 10);
      var label = (j.jobNumber ? '#' + j.jobNumber + ' ' : '') + (j.kind || j.title || '');
      var addr = typeof cardAddr === 'function' ? cardAddr(j) : (j.address || '');
      var cost = Number(r.expensesTotal);
      if (r.expensesTotal != null && r.expensesTotal !== '' && cost > 0) {
        var d = (day || (toD(r.submittedAt || r.updatedAt) ? ymOf(toD(r.submittedAt || r.updatedAt)) + '-01' : ''));
        if (d.slice(0, 7) === ym) {
          var rec = (Array.isArray(r.receiptPhotos) ? r.receiptPhotos : []).concat(r.receiptPhoto ? [r.receiptPhoto] : []).filter(Boolean);
          out.push({ day: d, what: T('Materiales (Job Report)', 'Materials (Job Report)'), supplier: r.supplier || '', amount: cost, job: label, addr: addr, id: j.id, receipt: rec[0] || '' });
        }
      }
      (Array.isArray(j.expenses) ? j.expenses : []).forEach(function (e) {
        var ed = String(e.date || day || '').slice(0, 10);
        if (ed.slice(0, 7) !== ym) return;
        var amt = Number(e.amount || e.total || 0);
        if (!(amt > 0)) return;
        out.push({ day: ed, what: e.description || e.name || e.item || T('Gasto', 'Expense'), supplier: e.vendor || e.supplier || '', amount: amt, job: label, addr: addr, id: j.id, receipt: e.receiptUrl || e.receipt || e.photo || '' });
      });
    });
    out.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    return out;
  }
  window.openMaterialsPage = async function (ym) {
    if (typeof canAssign === 'function' && !canAssign()) return;
    var p = enter('materials');
    if (ym) matYm = ym;
    if (!matYm) matYm = ymOf(new Date());
    p.innerHTML = '<p class="muted">' + esc(T('Cargando…', 'Loading…')) + '</p>';
    if (!mats) await loadMats();
    var money1 = typeof canSeeMoney === 'function' && canSeeMoney();
    var buys = money1 ? purchases(matYm) : [];
    var total = buys.reduce(function (s, x) { return s + x.amount; }, 0);
    var bySup = {};
    buys.forEach(function (x) { var k = x.supplier || T('Sin proveedor', 'No supplier'); bySup[k] = (bySup[k] || 0) + x.amount; });
    var months = [];
    for (var i = 0; i < 12; i++) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(ymOf(d)); }
    var mLabel = function (m) { return typeof monthLabel === 'function' ? monthLabel(m) : m; };
    p.innerHTML = css() + '<div class="pl-page"><div class="pl-head"><div><h2>' + esc(T('Materiales', 'Materials')) + '</h2>' +
        '<p class="muted">' + esc(T('Tu lista de materiales con su precio, y lo que se compró para los trabajos.', 'Your materials list with prices, and what was bought for the jobs.')) + '</p></div>' +
        '<button class="btn pl-btn" onclick="editMaterial()">+ ' + esc(T('Material', 'Material')) + '</button></div>' +
      '<h3 class="pl-h3">' + esc(T('Lista de materiales', 'Materials list')) + ' <span class="muted">(' + mats.length + ')</span></h3>' +
      (mats.length ? '<div class="pl-tbl-wrap"><table class="pl-tbl"><thead><tr><th>' + esc(T('Material', 'Material')) + '</th><th>' + esc(T('Unidad', 'Unit')) + '</th>' + (money1 ? '<th class="r">' + esc(T('Precio', 'Price')) + '</th>' : '') + '<th>' + esc(T('Proveedor', 'Supplier')) + '</th><th></th></tr></thead><tbody>' +
        mats.map(function (m) {
          return '<tr><td><b>' + esc(m.name || '') + '</b>' + (m.notes ? '<div class="muted">' + esc(m.notes) + '</div>' : '') + '</td><td>' + esc(m.unit || '—') + '</td>' +
            (money1 ? '<td class="r">' + (m.price != null && m.price !== '' ? esc(money(m.price)) : '—') + '</td>' : '') + '<td>' + esc(m.supplier || '—') + '</td>' +
            '<td class="pl-acts"><button class="pl-a" onclick="editMaterial(\'' + esc(m.id) + '\')">' + esc(T('Editar', 'Edit')) + '</button><button class="pl-a del" onclick="deleteMaterial(\'' + esc(m.id) + '\')">' + esc(T('Borrar', 'Delete')) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="pl-empty">' + esc(T('Todavía no hay materiales. Agrega los que más usas (tubo de 1/2", breaker de 20A, pintura…) con su precio.', 'No materials yet. Add the ones you use most (1/2" pipe, 20A breaker, paint…) with their price.')) + '</div>') +
      (money1 ? '<h3 class="pl-h3">' + esc(T('Compras para los trabajos', 'Purchases for jobs')) + '</h3>' +
        '<div class="pl-row"><select onchange="openMaterialsPage(this.value)">' + months.map(function (m) { return '<option value="' + m + '"' + (m === matYm ? ' selected' : '') + '>' + esc(mLabel(m)) + '</option>'; }).join('') + '</select>' +
          '<b class="pl-total">' + esc(T('Total: ', 'Total: ') + money(total)) + '</b></div>' +
        (Object.keys(bySup).length ? '<div class="pl-chips">' + Object.keys(bySup).sort(function (a, b) { return bySup[b] - bySup[a]; }).map(function (k) { return '<span class="pl-chip">' + esc(k) + ' <b>' + esc(money(bySup[k])) + '</b></span>'; }).join('') + '</div>' : '') +
        (buys.length ? '<div class="pl-tbl-wrap"><table class="pl-tbl"><thead><tr><th>' + esc(T('Día', 'Day')) + '</th><th>' + esc(T('Qué', 'What')) + '</th><th>' + esc(T('Proveedor', 'Supplier')) + '</th><th>' + esc(T('Trabajo', 'Job')) + '</th><th class="r">' + esc(T('Monto', 'Amount')) + '</th></tr></thead><tbody>' +
          buys.map(function (x) {
            return '<tr><td>' + esc(x.day) + '</td><td>' + esc(x.what) + (x.receipt ? ' <a href="' + esc(x.receipt) + '" target="_blank" rel="noopener">' + esc(T('recibo', 'receipt')) + '</a>' : '') + '</td><td>' + esc(x.supplier || '—') + '</td>' +
              '<td><a href="#" onclick="openJobView(\'' + esc(x.id) + '\');return false">' + esc(x.job || '—') + '</a><div class="muted">' + esc(x.addr) + '</div></td><td class="r">' + esc(money(x.amount)) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<div class="pl-empty">' + esc(T('No se anotaron compras de materiales en ', 'No material purchases logged in ') + mLabel(matYm) + '.') + '</div>') : '') +
      '</div>';
  };
  window.editMaterial = function (id) {
    var m = id ? (mats || []).find(function (x) { return x.id === id; }) : null;
    m = m || {};
    var md = $('modal');
    if (!md) return;
    md.classList.remove('hidden');
    md.innerHTML = '<div class="box" style="width:460px;max-width:96vw"><h3>' + esc(id ? T('Editar material', 'Edit material') : T('Nuevo material', 'New material')) + '</h3>' +
      '<label class="muted">' + esc(T('Nombre', 'Name')) + '</label><input id="pmName" value="' + esc(m.name || '') + '" placeholder="' + esc(T('Ej.: Breaker 20A', 'E.g.: 20A breaker')) + '">' +
      '<div style="display:flex;gap:8px"><div style="flex:1"><label class="muted">' + esc(T('Unidad', 'Unit')) + '</label><input id="pmUnit" value="' + esc(m.unit || '') + '" placeholder="' + esc(T('pieza, galón, pie…', 'each, gallon, ft…')) + '"></div>' +
      '<div style="flex:1"><label class="muted">' + esc(T('Precio', 'Price')) + '</label><input id="pmPrice" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(m.price != null ? m.price : '') + '"></div></div>' +
      '<label class="muted">' + esc(T('Proveedor', 'Supplier')) + '</label><input id="pmSup" value="' + esc(m.supplier || '') + '" placeholder="Home Depot">' +
      '<label class="muted">' + esc(T('Notas', 'Notes')) + '</label><input id="pmNotes" value="' + esc(m.notes || '') + '">' +
      '<p class="err" id="pmErr"></p>' +
      '<div style="display:flex;gap:8px"><button class="btn ghost" onclick="plCloseModal()">' + esc(T('Cancelar', 'Cancel')) + '</button>' +
      '<button class="btn" onclick="saveMaterial(\'' + esc(id || '') + '\')">' + esc(T('Guardar', 'Save')) + '</button></div></div>';
    setTimeout(function () { var x = $('pmName'); if (x) x.focus(); }, 30);
  };
  window.saveMaterial = async function (id) {
    var name = ($('pmName').value || '').trim();
    if (!name) { $('pmErr').textContent = T('Pon el nombre del material.', 'Enter the material name.'); return; }
    var pr = $('pmPrice').value;
    var data = { name: name, unit: ($('pmUnit').value || '').trim(), price: pr === '' ? null : Math.max(0, Number(pr) || 0),
      supplier: ($('pmSup').value || '').trim(), notes: ($('pmNotes').value || '').trim(), companyId: cid(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    try {
      if (id) await coCol('materials').doc(id).set(data, { merge: true });
      else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await coCol('materials').add(data); }
      plCloseModal();
      mats = null;
      openMaterialsPage();
    } catch (e) { $('pmErr').textContent = T('No se pudo guardar: ', 'Could not save: ') + (e.message || e); }
  };
  window.deleteMaterial = async function (id) {
    var m = (mats || []).find(function (x) { return x.id === id; });
    if (!m || !confirm(T('¿Borrar "' + m.name + '" de la lista?', 'Delete "' + m.name + '" from the list?'))) return;
    try { await coCol('materials').doc(id).delete(); mats = null; openMaterialsPage(); }
    catch (e) { alert(T('No se pudo borrar: ', 'Could not delete: ') + (e.message || e)); }
  };

  function css() {
    return '<style>' +
            '.pl-page{max-width:1100px;margin:0 auto}.pl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px}' +
      '.pl-head h2{margin:0 0 4px}.pl-head p{margin:0}.pl-btn{width:auto!important;padding:10px 16px}' +
      '.pl-search{max-width:520px}.pl-count{margin:2px 0 8px;font-size:13px}.pl-h3{margin:18px 0 8px}' +
      '.pl-tbl-wrap{background:#fff;border-radius:12px;overflow:auto;border:1px solid #E5E7EB}' +
      '.pl-tbl{width:100%;border-collapse:collapse;font-size:14px}.pl-tbl th{text-align:left;background:#F9FAFB;color:#6B7280;font-size:12px;padding:9px 10px;border-bottom:1px solid #E5E7EB;white-space:nowrap}' +
      '.pl-tbl td{padding:10px;border-top:1px solid #F3F4F6;vertical-align:top}.pl-tbl .r{text-align:right}.pl-tbl .muted{font-size:12.5px}' +
      '.pl-acts{white-space:nowrap;text-align:right}.pl-a{border:1px solid #D1D5DB;background:#fff;border-radius:8px;padding:5px 10px;margin-left:4px;cursor:pointer;font-size:13px}' +
      '.pl-a.del{color:#B91C1C;border-color:#FECACA}.pl-empty{background:#fff;border-radius:12px;padding:18px;color:#6B7280;border:1px dashed #D1D5DB}' +
      '.pl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.pl-row select{width:auto;margin:0}.pl-total{font-size:16px}' +
      '.pl-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.pl-chip{background:#fff;border:1px solid #E5E7EB;border-radius:999px;padding:4px 10px;font-size:13px}' +
      '@media (max-width:760px){#placesPane{padding:10px 10px 88px}.pl-tbl{font-size:13px}.pl-acts{white-space:normal}.pl-a{margin:2px 0 2px 4px}}' +
      '</style>';
  }
})();
