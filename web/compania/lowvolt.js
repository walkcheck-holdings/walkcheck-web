/* Low Voltage (solo compañías de Low Voltage): Despacho de hoy, Crear orden de
   trabajo (WO) en 5 pasos, Orden en vivo (rastreo, mover técnico, cierre con
   firma) y Equipos (inventario). Usa los mismos datos que la app:
   jobs/{id} (+ campo lv) y equipment/{id}. Las demás industrias no ven nada. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- helpers
  var EN = function () { return typeof loginLang === 'function' && loginLang() === 'en'; };
  var T = function (es, en) { return EN() ? en : es; };
  function h(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(id) { return document.getElementById(id); }
  function me() { return (auth.currentUser && auth.currentUser.uid) || ''; }
  function myName() {
    return (typeof profile !== 'undefined' && profile && (profile.displayName || profile.email)) ||
      (auth.currentUser && auth.currentUser.email) || '';
  }
  function two(n) { return String(n).padStart(2, '0'); }
  function ymdOf(d) { return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function ampm(clock) {
    var p = String(clock || '').split(':');
    var hh = Number(p[0]); var mm = Number(p[1] || 0);
    if (isNaN(hh)) return '';
    return (hh % 12 === 0 ? 12 : hh % 12) + ':' + two(mm) + ' ' + (hh < 12 ? 'AM' : 'PM');
  }
  function nowClock() { var d = new Date(); return ampm(two(d.getHours()) + ':' + two(d.getMinutes())); }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = iso.toDate ? iso.toDate() : new Date(iso);
    if (isNaN(d)) return '';
    return ampm(two(d.getHours()) + ':' + two(d.getMinutes()));
  }
  function fmtDay(ymd) {
    var d = new Date(ymd + 'T12:00:00');
    if (isNaN(d)) return ymd || '';
    return d.toLocaleDateString(EN() ? 'en-US' : 'es-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function initials(n) {
    var p = String(n || '').trim().split(/\s+/);
    if (!p[0]) return '—';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function toast(msg) {
    var t = el('lvToast');
    if (!t) { t = document.createElement('div'); t.id = 'lvToast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    pin: '<path d="M12 22s-8-7.6-8-13a8 8 0 0 1 16 0c0 5.4-8 13-8 13z"/><circle cx="12" cy="9" r="3"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
    wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    off: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/>',
    on: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    cam: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>'
  };
  function ic(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  // ------------------------------------------------------ constants / labels
  var TYPES = [
    { k: 'install', es: 'Instalación', en: 'Install', des: 'Servicio nuevo: internet, TV, voz o alarmas', den: 'New service: internet, TV, voice or alarms', i: 'plus' },
    { k: 'repair', es: 'Reparación', en: 'Repair', des: 'Falla en un servicio ya instalado', den: 'Problem with an installed service', i: 'wrench' },
    { k: 'trouble', es: 'Trouble call', en: 'Trouble call', des: 'Visita técnica por reporte del cliente', den: 'Visit for a customer report', i: 'alert' },
    { k: 'upgrade', es: 'Upgrade', en: 'Upgrade', des: 'Subir velocidad, plan o equipos', den: 'Faster plan or new equipment', i: 'up' },
    { k: 'disconnect', es: 'Desconexión', en: 'Disconnect', des: 'Baja del servicio y retiro de equipos', den: 'End service and pick up equipment', i: 'off' },
    { k: 'reconnect', es: 'Reconexión', en: 'Reconnect', des: 'Volver a activar un servicio cortado', den: 'Turn a cut service back on', i: 'on' }
  ];
  var SERVICES = [
    ['internet', 'Internet', 'Internet'], ['tv', 'TV / Video', 'TV / Video'], ['voice', 'Voz / Teléfono', 'Voice / Phone'],
    ['alarm', 'Alarmas / Seguridad', 'Alarms / Security'], ['cameras', 'Cámaras', 'Cameras'], ['multi', 'Múltiple', 'Multiple']
  ];
  var PRIOS = [['normal', 'Normal', 'Normal', ''], ['high', 'Alta', 'High', 'amber'], ['emergency', 'Emergencia', 'Emergency', 'red']];
  var WINDOWS = [
    ['08:00', '10:00', '8 – 10 AM'], ['10:00', '12:00', '10 AM – 12 PM'], ['12:00', '14:00', '12 – 2 PM'],
    ['14:00', '16:00', '2 – 4 PM'], ['16:00', '18:00', '4 – 6 PM']
  ];
  var DURATIONS = [[60, '1 hora', '1 hour'], [90, '1.5 horas', '1.5 hours'], [120, '2 horas', '2 hours'], [180, '3 horas', '3 hours'], [240, 'Medio día', 'Half day']];
  var CLOSE_CODES = [
    ['completed', 'Completado', 'Completed'], ['partial', 'Completado parcial', 'Partially completed'],
    ['no_home', 'No acceso — NO HOME', 'No access — NO HOME'], ['revisit', 'Necesita revisita', 'Needs a return visit'],
    ['cancelled', 'Cancelado por el cliente', 'Cancelled by the customer'], ['outside', 'Problema en la calle / planta externa', 'Outside plant / street problem']
  ];
  var STAGES = [
    ['dispatched', 'Despachado', 'Dispatched', 'La cita le llega al teléfono del técnico', 'The appointment reaches the tech\'s phone', 'send'],
    ['enroute', 'En ruta', 'En route', 'El técnico va camino a la dirección · se avisa al cliente', 'The tech is on the way · the customer is told', 'truck'],
    ['arrived', 'Llegó', 'Arrived', 'El técnico marca llegada en la puerta', 'The tech checks in at the door', 'pin'],
    ['started', 'Trabajo iniciado', 'Work started', 'Empieza la instalación / reparación', 'Install / repair begins', 'tool'],
    ['completed', 'Completado', 'Completed', 'Cierre con señal, foto y firma del cliente', 'Closed with signal, photo and customer signature', 'flag']
  ];
  function label(list, k, idx) { var f = list.find(function (x) { return x[0] === k; }); return f ? f[EN() ? idx + 1 : idx] : ''; }
  function typeLabel(k) { var t = TYPES.find(function (x) { return x.k === k; }); return t ? (EN() ? t.en : t.es) : ''; }
  function serviceLabel(k) { return label(SERVICES, k, 1); }
  function prioLabel(k) { return label(PRIOS, k, 1) || T('Normal', 'Normal'); }
  function closeLabel(k) { return label(CLOSE_CODES, k, 1); }
  function windowLabel(start) { var w = WINDOWS.find(function (x) { return x[0] === start; }); return w ? w[2] : (start ? ampm(start) : ''); }
  function stageIndex(s) { return STAGES.findIndex(function (x) { return x[0] === s; }); }
  function stageWord(lv) {
    var s = (lv && lv.stage) || 'queued';
    if (s === 'queued') return T('En cola · sin despachar', 'Queued · not dispatched');
    var st = STAGES.find(function (x) { return x[0] === s; });
    return st ? st[EN() ? 2 : 1] : s;
  }
  function stageClass(s) {
    if (s === 'completed') return 'done';
    if (s === 'enroute' || s === 'dispatched') return 'ruta';
    if (s === 'arrived' || s === 'started') return 'sitio';
    return 'off';
  }
  var TECH_STATUS = {
    available: ['Disponible', 'Available', 'libre'], enroute: ['En ruta', 'En route', 'ruta'], onsite: ['En sitio', 'On site', 'sitio'],
    break: ['Break', 'Break', 'off'], lunch: ['Almuerzo', 'Lunch', 'off'], warehouse: ['Almacén', 'Warehouse', 'off'],
    training: ['Entrenamiento', 'Training', 'off'], exception: ['Excepción', 'Exception', 'sitio'], off: ['Fuera de turno', 'Off shift', 'off']
  };

  // ------------------------------------------------------------ company gate
  var lvCache = {};
  var lvOn = false;
  function curCid() { try { return typeof cid === 'function' ? cid() : ''; } catch (_) { return ''; } }
  async function isLowVolt(id) {
    if (!id) return false;
    if (lvCache[id] != null) return lvCache[id];
    try {
      var d = await db.collection('companies').doc(id).get();
      var m = d.exists ? d.data() : {};
      var ind = [m.industry, m.companyType, m.trade].concat(Array.isArray(m.industries) ? m.industries : []).join(' ').toLowerCase();
      lvCache[id] = m.equipmentEnabled === true || /low[\s_-]*volt/.test(ind);
    } catch (_) { lvCache[id] = false; }
    return lvCache[id];
  }
  var lastCid = null;
  async function syncGate() {
    var id = curCid();
    if (id === lastCid) return;
    lastCid = id;
    lvOn = await isLowVolt(id);
    document.body.classList.toggle('lv-co', !!lvOn && canOffice());
    if (!lvOn && document.body.classList.contains('view-lv')) leave();
  }
  function canOffice() { try { return typeof canAssign === 'function' && canAssign(); } catch (_) { return false; } }

  // --------------------------------------------------------------- the view
  function pane() {
    var p = el('lvPane');
    if (!p) {
      p = document.createElement('div');
      p.id = 'lvPane';
      var after = el('jobPane');
      if (after && after.parentNode) after.parentNode.insertBefore(p, after.nextSibling);
      else document.body.appendChild(p);
    }
    return p;
  }
  var VIEW_CLASSES = ['view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived',
    'view-home', 'view-search', 'sites-open', 'view-jobs', 'view-job', 'view-payments',
    'view-requests', 'view-clients', 'view-quotes'];
  var stopLive = null;
  var currentRail = '';
  function enter(rail) {
    if (typeof closeMore === 'function') { try { closeMore(); } catch (_) {} }
    VIEW_CLASSES.forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('view-lv');
    currentRail = rail;
    document.querySelectorAll('#appRail .rail-item').forEach(function (b) {
      b.classList.toggle('on', b.id === rail);
    });
    if (stopLive) { stopLive(); stopLive = null; }
    window.scrollTo(0, 0);
    var p = pane(); p.scrollTop = 0;
    return p;
  }
  function leave() {
    if (stopLive) { stopLive(); stopLive = null; }
    document.body.classList.remove('view-lv');
    var r = el('lvRailDispatch'); if (r) r.classList.remove('on');
    r = el('lvRailEquip'); if (r) r.classList.remove('on');
  }
  // Any other screen of the panel closes ours.
  new MutationObserver(function () {
    var b = document.body.classList;
    if (b.contains('view-lv') && VIEW_CLASSES.some(function (c) { return b.contains(c); })) leave();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  ['navHorario', 'goToday', 'navHome', 'setSchedView'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () { leave(); return orig.apply(this, arguments); };
  });

  function addRail() {
    var scroll = document.querySelector('#appRail .rail-scroll');
    if (!scroll || el('lvRailDispatch')) return;
    var mk = function (id, icon, es, en, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rail-item lv-only'; b.id = id;
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[icon] + '</svg>' +
        '<span class="rail-label">' + h(T(es, en)) + '</span>';
      b.onclick = fn;
      return b;
    };
    var after = el('railHorario');
    var d = mk('lvRailDispatch', 'truck', 'Despacho', 'Dispatch', function () { window.lvOpenDispatch(); });
    var e = mk('lvRailEquip', 'box', 'Equipos', 'Equipment', function () { window.lvOpenInventory(); });
    if (after && after.nextSibling) { scroll.insertBefore(d, after.nextSibling); scroll.insertBefore(e, d.nextSibling); }
    else { scroll.appendChild(d); scroll.appendChild(e); }
  }

  // --------------------------------------------------------- shared data
  function lvJobs() {
    return (typeof jobs !== 'undefined' ? jobs : []).filter(function (j) { return j && j.lv && !j.archived; });
  }
  async function loadUsers() {
    var out = [];
    try {
      var s = await db.collection('users').where('companyId', '==', curCid()).get();
      s.forEach(function (d) {
        var u = d.data() || {};
        out.push({ uid: d.id, name: u.displayName || u.email || '', email: String(u.email || '').toLowerCase(), role: u.role || 'worker',
          zone: u.zone || '', techId: u.techNumber || u.techId || '', status: u.techStatus || '' });
      });
    } catch (_) {
      out = (typeof techs !== 'undefined' ? techs : []).map(function (t) { return { uid: t.uid, name: t.name, email: t.email, role: t.role }; });
    }
    out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    return out;
  }
  async function loadEquipment(filter) {
    var out = [];
    try {
      var q = db.collection('equipment').where('companyId', '==', curCid());
      if (filter && filter.jobId) q = q.where('jobId', '==', filter.jobId);
      var s = await q.get();
      s.forEach(function (d) { out.push(Object.assign({ id: d.id }, d.data())); });
    } catch (_) {}
    return out;
  }
  function eqLog(action, detail) {
    return { at: new Date().toISOString(), byName: myName(), action: action, detail: detail };
  }
  function jobsToday(uid, day) {
    return (typeof jobs !== 'undefined' ? jobs : []).filter(function (j) {
      return j && !j.archived && (j.assignedUid === uid || j.workerId === uid) && String(j.scheduledDate || '') === day;
    }).length;
  }
  async function notify(uid, title) {
    if (!uid) return;
    try { await db.collection('notifications').add({ uid: uid, title: title, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } catch (_) {}
  }
  async function uploadFile(file, prefix) {
    var ref = storage.ref('photos/' + curCid() + '/' + prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) +
      (/png$/i.test(file.type || '') ? '.png' : '.jpg'));
    await ref.put(file, { contentType: file.type || 'image/jpeg' });
    return ref.getDownloadURL();
  }

  // ====================================================== DESPACHO DE HOY
  var dispDay = null, dispZone = '', dispQuery = '';
  // Live tech status (users/{uid}.techStatus, set from the tech's phone).
  var techNow = [];
  window.lvOpenDispatch = function () {
    if (!lvOn || !canOffice()) return;
    var p = enter('lvRailDispatch');
    if (!dispDay) dispDay = ymdOf(new Date());
    renderDispatch(p);
    var t = setInterval(function () { if (document.body.classList.contains('view-lv') && currentRail === 'lvRailDispatch') renderDispatch(pane(), true); }, 6000);
    var unsubU = db.collection('users').where('companyId', '==', curCid()).onSnapshot(function (snap) {
      techNow = [];
      snap.forEach(function (d) {
        var u = d.data() || {};
        var r = String(u.role || 'worker').toLowerCase();
        if (['worker', 'employee', 'tech', 'trabajador'].indexOf(r) < 0 && !u.techStatus) return;
        techNow.push({ uid: d.id, name: u.displayName || u.email || '', num: u.techNumber || '', status: u.techStatus || '', at: u.techStatusAt || null, zone: u.zone || '' });
      });
      techNow.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      paintTechNow();
    }, function () {});
    stopLive = function () { clearInterval(t); unsubU(); };
  };
  function sinceText(at) {
    var d = at && at.toDate ? at.toDate() : (at ? new Date(at) : null);
    if (!d || isNaN(d)) return '';
    var min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return T('ahora', 'now');
    if (min < 60) return T('hace ' + min + ' min', min + ' min ago');
    return fmtTime(d.toISOString());
  }
  function paintTechNow() {
    var box = el('lvTechNow'); if (!box) return;
    if (!techNow.length) { box.innerHTML = ''; return; }
    var today = ymdOf(new Date());
    var active = lvJobs().filter(function (j) { return String(j.scheduledDate || '') === today; });
    box.innerHTML = '<div class="technow-h">' + h(T('Técnicos ahora', 'Techs right now')) + '<span>' + h(T('en vivo', 'live')) + '</span></div>' +
      '<div class="technow">' + techNow.map(function (u) {
        var st = TECH_STATUS[u.status] || null;
        var mine = active.filter(function (j) { return j.assignedUid === u.uid; });
        var on = mine.find(function (j) { return ['enroute', 'arrived', 'started'].indexOf((j.lv || {}).stage) >= 0; });
        var next = on ? null : mine.filter(function (j) { return (j.lv || {}).stage !== 'completed'; })
          .sort(function (a, b) { return String(a.startClock).localeCompare(String(b.startClock)); })[0];
        var line = on
          ? (on.lv.workOrder || '') + ' · ' + stageWord(on.lv) + (on.lv.times && on.lv.times[on.lv.stage] ? ' ' + fmtTime(on.lv.times[on.lv.stage]) : '')
          : next ? T('Próxima: ', 'Next: ') + (next.lv.workOrder || '') + ' · ' + windowLabel(next.startClock)
          : mine.length ? (mine.length === 1 ? T('Terminó su orden de hoy', 'Finished the order for today') : T('Terminó sus ' + mine.length + ' órdenes de hoy', 'Finished all ' + mine.length + ' orders today')) : T('Sin órdenes hoy', 'No orders today');
        return '<button type="button" class="tn" ' + (on || next ? 'onclick="lvOpenOrder(\'' + h((on || next).id) + '\')"' : '') + '>' +
          '<span class="tav">' + h(initials(u.name)) + '</span>' +
          '<span class="ti"><b>' + h(u.name) + (u.num ? ' · ' + h(u.num) : '') + '</b><span>' + h(line) + '</span></span>' +
          '<span class="ts"><span class="status ' + (st ? st[2] : 'off') + (u.status === 'enroute' ? ' pulse' : '') + '">' + h(st ? st[EN() ? 1 : 0] : T('Sin estado', 'No status')) + '</span>' +
          '<small>' + h(sinceText(u.at)) + '</small></span></button>';
      }).join('') + '</div>';
  }
  function renderDispatch(p, soft) {
    var all = lvJobs();
    var zones = Array.from(new Set(all.map(function (j) { return (j.lv && j.lv.zone) || ''; }).filter(Boolean))).sort();
    var day = all.filter(function (j) { return String(j.scheduledDate || '') === dispDay; });
    if (dispZone) day = day.filter(function (j) { return (j.lv.zone || '') === dispZone; });
    var q = dispQuery.trim().toLowerCase();
    if (q) day = day.filter(function (j) {
      return [j.lv.workOrder, j.clientName, j.address, j.assignedName, j.lv.accountNumber].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    day.sort(function (a, b) { return String(a.startClock || '').localeCompare(String(b.startClock || '')); });
    var cnt = function (f) { return day.filter(f).length; };
    var moving = cnt(function (j) { return ['enroute', 'arrived', 'started'].indexOf(j.lv.stage) >= 0; });
    var done = cnt(function (j) { return j.lv.stage === 'completed'; });
    var queue = cnt(function (j) { return !j.assignedUid || j.lv.stage === 'queued'; });
    if (soft && el('lvDispList')) { el('lvDispList').innerHTML = orderRows(day); fillKpis(day.length, moving, done, queue); paintTechNow(); return; }
    p.innerHTML =
      '<div class="pagehead"><div><h1>' + h(T('Despacho', 'Dispatch')) + '</h1>' +
      '<p>' + h(T('Las órdenes del día por ventana de cita, con su técnico y el estado en vivo.', 'The day\'s orders by appointment window, with the tech and the live status.')) + '</p></div>' +
      '<div class="right"><button class="btn-create" style="width:auto;padding:12px 18px;min-height:46px" onclick="lvOpenCreate()">' + ic('plus') + h(T('Crear orden', 'Create order')) + '</button></div></div>' +
      '<div id="lvTechNow"></div>' +
      '<div class="kpis" id="lvKpis"></div>' +
      '<div class="toolbar">' +
        '<input type="date" value="' + h(dispDay) + '" onchange="lvDispSet(\'day\',this.value)">' +
        '<select onchange="lvDispSet(\'zone\',this.value)"><option value="">' + h(T('Todas las zonas', 'All zones')) + '</option>' +
          zones.map(function (z) { return '<option' + (z === dispZone ? ' selected' : '') + '>' + h(z) + '</option>'; }).join('') + '</select>' +
        '<input type="search" placeholder="' + h(T('Buscar WO, cliente, dirección…', 'Search WO, customer, address…')) + '" value="' + h(dispQuery) + '" oninput="lvDispSet(\'q\',this.value)">' +
        '<button class="btn-draft" style="width:auto;min-height:44px;padding:10px 14px" onclick="lvDispSet(\'day\',\'' + ymdOf(new Date()) + '\')">' + h(T('Hoy', 'Today')) + '</button>' +
      '</div>' +
      '<div class="orders" id="lvDispList">' + orderRows(day) + '</div>';
    fillKpis(day.length, moving, done, queue);
    paintTechNow();
  }
  function fillKpis(total, moving, done, queue) {
    var k = el('lvKpis'); if (!k) return;
    var one = function (c, l, n) { return '<div class="kpi"><span><i style="background:' + c + '"></i>' + h(l) + '</span><b>' + n + '</b></div>'; };
    k.innerHTML = one('#22a355', T('Citas del día', 'Appointments'), total) + one('#175cd3', T('En ruta / en sitio', 'En route / on site'), moving) +
      one('#17803f', T('Completadas', 'Completed'), done) + one('#b45309', T('En cola', 'Queued'), queue);
  }
  function orderRows(list) {
    if (!list.length) {
      return '<div class="empty">' + h(T('Sin órdenes este día.', 'No orders this day.')) +
        '<div><button class="btn-create" onclick="lvOpenCreate()">' + ic('plus') + h(T('Crear orden', 'Create order')) + '</button></div></div>';
    }
    return list.map(function (j) {
      var lv = j.lv || {};
      var st = lv.stage || 'queued';
      return '<button type="button" class="order" onclick="lvOpenOrder(\'' + h(j.id) + '\')">' +
        '<div class="win">' + h(windowLabel(j.startClock)) + '<small>' + h(lv.workOrder || '') + '</small></div>' +
        '<div class="what"><b>' + h(typeLabel(lv.jobType) + ' ' + serviceLabel(lv.service)) + '</b>' +
          '<span>' + h([j.clientName, j.address].filter(Boolean).join(' · ')) + '</span>' +
          '<span>' + ic('user', 'sm') + ' ' + h(j.assignedName || T('Sin asignar', 'Unassigned')) + (lv.zone ? ' · ' + h(lv.zone) : '') + '</span></div>' +
        '<div class="right"><span class="status ' + stageClass(st) + (st === 'enroute' ? ' pulse' : '') + '">' + h(stageWord(lv)) + '</span>' +
          (lv.priority && lv.priority !== 'normal' ? '<span class="badge ' + (lv.priority === 'emergency' ? 'emergencia' : 'alta') + '">' + h(prioLabel(lv.priority)) + '</span>' : '') +
        '</div></button>';
    }).join('');
  }
  window.lvDispSet = function (k, v) {
    if (k === 'day') dispDay = v || ymdOf(new Date());
    if (k === 'zone') dispZone = v;
    if (k === 'q') { dispQuery = v; var l = el('lvDispList'); if (l) { renderDispatch(pane(), true); return; } }
    renderDispatch(pane());
  };

  // ====================================================== CREAR ORDEN (WO)
  var F = null; // form state
  window.lvOpenCreate = async function () {
    if (!lvOn || !canOffice()) return;
    var p = enter('railCreate');
    p.innerHTML = '<p class="muted">' + h(T('Cargando…', 'Loading…')) + '</p>';
    var users = await loadUsers();
    var stock = (await loadEquipment()).filter(function (e) { return (e.status || 'bodega') === 'bodega'; });
    var nextNo = '';
    try { var co = await db.collection('companies').doc(curCid()).get(); nextNo = String(((co.exists && co.data().jobSeq) || 0) + 1); } catch (_) {}
    F = {
      users: users, stock: stock, nextNo: nextNo,
      type: '', service: '', prio: 'normal', win: '', dur: 90, confirm: ['sms'], tech: null, eq: [], busy: false
    };
    var today = ymdOf(new Date(Date.now() + 86400000));
    var wo = 'WO-' + (nextNo ? nextNo.padStart(5, '0') : '?????');
    p.innerHTML =
      '<button class="crumb" onclick="lvOpenDispatch()">' + ic('back', 'sm') + h(T('Despacho', 'Dispatch')) + '</button>' +
      '<div class="pagehead"><div><h1>' + h(T('Crear trabajo — Instalación y reparación', 'Create job — Install and repair')) + '</h1>' +
      '<p>' + h(T('Se crea la orden, se le da la ventana de cita y el técnico, y se rastrea su llegada.', 'Create the order, give it an appointment window and a tech, and track the arrival.')) + '</p></div></div>' +
      '<div class="wobar"><div><div class="wo">Work Order · ' + h(T('Orden de trabajo', 'Order')) + '</div><div class="wonum">' + h(wo) + '</div></div>' +
        '<span class="badge service" id="lvBadgeSvc">' + h(T('Sin servicio', 'No service')) + '</span>' +
        '<span class="badge normal" id="lvBadgePrio">' + h(T('Prioridad normal', 'Normal priority')) + '</span>' +
        '<span class="sys">' + h(T('El número se asigna solo al crear', 'The number is set when you create it')) + '</span></div>' +
      '<div class="steps">' +
        ['orden', 'cliente', 'cita', 'tecnico', 'equipos'].map(function (s, i) {
          var n = [T('Orden', 'Order'), T('Cliente', 'Customer'), T('Cita', 'Appointment'), T('Técnico', 'Tech'), T('Equipos', 'Equipment')][i];
          return '<button type="button" data-step="' + s + '" onclick="document.getElementById(\'lvSec-' + s + '\').scrollIntoView({behavior:\'smooth\'})"><span class="n">' + (i + 1) + '</span>' + h(n) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="cols"><div class="formcol">' +
      // 1 ORDEN
      '<section class="card" id="lvSec-orden"><div class="cardhead"><span class="n">1</span><h2>' + h(T('Orden de trabajo', 'Work order')) + '</h2><span class="ok">' + ic('check', 'sm') + h(T('Listo', 'Done')) + '</span></div>' +
        '<p class="hint">' + h(T('Tipo de visita, servicio y qué tan urgente es.', 'Visit type, service and how urgent it is.')) + '</p>' +
        '<div class="grid2"><div class="field"><label class="f">' + h(T('N.º de orden (Work Order)', 'Work Order #')) + '</label><input type="text" value="' + h(wo) + '" readonly></div>' +
        '<div class="field"><label class="f" for="lvRef">' + h(T('N.º de cuenta / orden externa (opcional)', 'Account / external order # (optional)')) + '</label><input type="text" id="lvRef" autocomplete="off" placeholder="8495 30 112 88412"></div></div>' +
        '<p class="sublabel">' + h(T('Tipo de trabajo', 'Job type')) + '</p>' +
        '<div class="tiles">' + TYPES.map(function (t) {
          return '<button type="button" class="tile" data-type="' + t.k + '" onclick="lvPick(\'type\',\'' + t.k + '\')"><span class="tic">' + ic(t.i) + '</span><b>' + h(EN() ? t.en : t.es) + '</b><span class="d">' + h(EN() ? t.den : t.des) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="grid2"><div class="field"><label class="f">' + h(T('Servicio', 'Service')) + '</label><div class="pillrow" id="lvSvc">' +
          SERVICES.map(function (s) { return '<button type="button" data-v="' + s[0] + '" onclick="lvPick(\'service\',\'' + s[0] + '\')">' + h(EN() ? s[2] : s[1]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label class="f">' + h(T('Prioridad', 'Priority')) + '</label><div class="pillrow" id="lvPrio">' +
          PRIOS.map(function (s) { return '<button type="button" data-v="' + s[0] + '" data-cls="' + s[3] + '" onclick="lvPick(\'prio\',\'' + s[0] + '\')">' + h(EN() ? s[2] : s[1]) + '</button>'; }).join('') + '</div></div></div>' +
        '<div class="field" style="margin-top:14px"><label class="f" for="lvDesc">' + h(T('Descripción / notas del despacho', 'Description / dispatch notes')) + '</label><textarea id="lvDesc" placeholder="' + h(T('Qué hay que hacer: instalar gateway nuevo, tirar línea al cuarto principal, revisar señal…', 'What to do: install a new gateway, run a line to the main bedroom, check signal…')) + '"></textarea></div>' +
      '</section>' +
      // 2 CLIENTE
      '<section class="card" id="lvSec-cliente"><div class="cardhead"><span class="n">2</span><h2>' + h(T('Cliente de la orden', 'Order customer')) + '</h2><span class="ok">' + ic('check', 'sm') + h(T('Listo', 'Done')) + '</span></div>' +
        '<p class="hint">' + h(T('El técnico ve el teléfono y las notas de acceso para poder entrar.', 'The tech sees the phone and access notes to get in.')) + '</p>' +
        '<div class="grid3"><div class="field"><label class="f" for="lvCName">' + h(T('Nombre del cliente', 'Customer name')) + '</label><input type="text" id="lvCName" autocomplete="off"></div>' +
        '<div class="field"><label class="f" for="lvCAcct">' + h(T('N.º de cuenta', 'Account #')) + '</label><input type="text" id="lvCAcct" autocomplete="off"></div>' +
        '<div class="field"><label class="f" for="lvCLang">' + h(T('Idioma preferido', 'Preferred language')) + '</label><select id="lvCLang"><option value="es">Español</option><option value="en">English</option></select></div></div>' +
        '<div class="grid2"><div class="field"><label class="f" for="lvCPhone">' + h(T('Teléfono', 'Phone')) + '</label><input type="tel" id="lvCPhone" autocomplete="off" placeholder="(305) 555-0100"></div>' +
        '<div class="field"><label class="f" for="lvCEmail">' + h(T('Correo', 'Email')) + '</label><input type="email" id="lvCEmail" autocomplete="off"></div></div>' +
        '<div class="grid2"><div class="field"><label class="f" for="lvCAddr">' + h(T('Dirección del servicio', 'Service address')) + '</label><input type="text" id="lvCAddr" autocomplete="off" placeholder="' + h(T('Calle, número, apto., ciudad, ZIP', 'Street, number, apt., city, ZIP')) + '"></div>' +
        '<div class="field"><label class="f" for="lvZone">' + h(T('Área / Zona', 'Area / Zone')) + '</label><input type="text" id="lvZone" list="lvZones" autocomplete="off" placeholder="Miami Central, Hialeah, Doral…">' +
          '<datalist id="lvZones">' + Array.from(new Set(lvJobs().map(function (j) { return j.lv.zone; }).concat(users.map(function (u) { return u.zone; })).filter(Boolean))).map(function (z) { return '<option value="' + h(z) + '">'; }).join('') + '</datalist></div></div>' +
        '<div class="field"><label class="f" for="lvAccess">' + h(T('Notas de acceso', 'Access notes')) + '</label><textarea id="lvAccess" placeholder="' + h(T('Gate y código, mascota, dónde estacionar, quién abre…', 'Gate and code, pets, where to park, who opens…')) + '"></textarea></div>' +
      '</section>' +
      // 3 CITA
      '<section class="card" id="lvSec-cita"><div class="cardhead"><span class="n">3</span><h2>' + h(T('Ventana de cita', 'Appointment window')) + '</h2><span class="ok">' + ic('check', 'sm') + h(T('Listo', 'Done')) + '</span></div>' +
        '<p class="hint">' + h(T('La ventana que se le promete al cliente: se asigna por ventana, no por hora exacta.', 'The window promised to the customer: booked by window, not exact time.')) + '</p>' +
        '<div class="grid2"><div class="field"><label class="f" for="lvDate">' + h(T('Fecha de la cita', 'Appointment date')) + '</label><input type="date" id="lvDate" value="' + today + '" min="' + ymdOf(new Date()) + '"></div>' +
        '<div class="field"><label class="f" for="lvDur">' + h(T('Duración estimada', 'Estimated duration')) + '</label><select id="lvDur">' +
          DURATIONS.map(function (d) { return '<option value="' + d[0] + '"' + (d[0] === 90 ? ' selected' : '') + '>' + h(EN() ? d[2] : d[1]) + '</option>'; }).join('') + '</select></div></div>' +
        '<p class="sublabel">' + h(T('Ventana horaria', 'Time window')) + '</p>' +
        '<div class="pillrow" id="lvWin" style="margin-bottom:14px">' + WINDOWS.map(function (w) { return '<button type="button" data-v="' + w[0] + '" onclick="lvPick(\'win\',\'' + w[0] + '\')">' + h(w[2]) + '</button>'; }).join('') + '</div>' +
        '<div class="grid2"><div class="field"><label class="f" for="lvPromise">' + h(T('Promesa: llegada antes de', 'Promise: arrive before')) + '</label><input type="time" id="lvPromise" value="10:00"></div>' +
        '<div class="field"><label class="f">' + h(T('Confirmación al cliente', 'Customer confirmation')) + '</label><div class="pillrow" id="lvConf">' +
          [['sms', T('Texto (SMS)', 'Text (SMS)')], ['email', T('Correo', 'Email')], ['call', T('Llamada', 'Call')]].map(function (c) {
            return '<button type="button" data-v="' + c[0] + '" class="' + (c[0] === 'sms' ? 'sel' : '') + '" onclick="lvPick(\'confirm\',\'' + c[0] + '\')">' + h(c[1]) + '</button>';
          }).join('') + '</div></div></div>' +
      '</section>' +
      // 4 TECNICO
      '<section class="card" id="lvSec-tecnico"><div class="cardhead"><span class="n">4</span><h2>' + h(T('Técnico asignado', 'Assigned tech')) + '</h2><span class="ok">' + ic('check', 'sm') + h(T('Listo', 'Done')) + '</span></div>' +
        '<p class="hint">' + h(T('Escoge por zona y por las citas que ya tiene. Si no escoges, la orden queda en la cola.', 'Pick by zone and how many appointments they have. If you skip it, the order goes to the queue.')) + '</p>' +
        '<div class="techgrid" id="lvTechs"></div>' +
      '</section>' +
      // 5 EQUIPOS
      '<section class="card" id="lvSec-equipos"><div class="cardhead"><span class="n">5</span><h2>' + h(T('Equipos a instalar', 'Equipment to install')) + '</h2><span class="ok">' + ic('check', 'sm') + h(T('Listo', 'Done')) + '</span></div>' +
        '<p class="hint">' + h(T('Cada equipo sale con su serial/MAC asignado al técnico. Nada se pierde entre el almacén y la casa del cliente.', 'Each device goes out with its serial/MAC assigned to the tech. Nothing gets lost between the warehouse and the home.')) + '</p>' +
        '<div id="lvEqList"></div>' +
        '<div class="grid2" style="margin-bottom:10px"><div class="field"><label class="f">' + h(T('Del almacén (en bodega)', 'From the warehouse (in stock)')) + '</label><select id="lvEqStock" onchange="lvEqFromStock(this.value)"><option value="">' +
          h(stock.length ? T('— Escoge un equipo —', '— Pick a device —') : T('No hay equipos en bodega', 'Nothing in stock')) + '</option>' +
          stock.map(function (e) { return '<option value="' + h(e.id) + '">' + h((e.name || '') + ' #' + (e.serial || '')) + '</option>'; }).join('') + '</select></div><div></div></div>' +
        '<div class="eqnew"><div class="field" style="margin:0"><label class="f" for="lvEqName">' + h(T('O equipo nuevo: nombre', 'Or a new device: name')) + '</label><input type="text" id="lvEqName" placeholder="' + h(T('Gateway, cable box, cámara…', 'Gateway, cable box, camera…')) + '"></div>' +
          '<div class="field" style="margin:0"><label class="f" for="lvEqSerial">' + h(T('Serial / MAC', 'Serial / MAC')) + '</label><input type="text" id="lvEqSerial" placeholder="R-8821"></div>' +
          '<button type="button" class="btn-draft" style="width:auto;min-height:44px" onclick="lvEqAddNew()">' + ic('plus', 'sm') + h(T('Agregar', 'Add')) + '</button></div>' +
        '<div class="rulebox"><strong>' + h(T('Regla de equipos:', 'Equipment rule:')) + '</strong> ' +
          h(T('la oficina sube y asigna los equipos; el técnico solo puede marcar INSTALADO lo que tiene en la mano, con foto. Lo no instalado vuelve a bodega.', 'the office adds and assigns devices; the tech can only mark INSTALLED what they have in hand, with a photo. What is not installed goes back to stock.')) + '</div>' +
      '</section>' +
      '</div>' +
      // SUMMARY
      '<aside class="summary"><div class="shead"><h3>' + h(T('Resumen', 'Summary')) + '</h3><span class="wonum">' + h(wo) + '</span></div>' +
        '<div class="sbody"><p class="jobtitle" id="lvSumTitle"></p><div class="badges"><span class="badge service" id="lvSumSvc"></span><span class="badge normal" id="lvSumPrio"></span></div>' +
        '<dl>' +
          srow('user', T('Cliente', 'Customer'), 'lvSumClient') + srow('home', T('Dirección', 'Address'), 'lvSumAddr') +
          srow('cal', T('Cita', 'Appt.'), 'lvSumAppt') + srow('clock', T('Promesa', 'Promise'), 'lvSumPromise') +
          srow('truck', T('Técnico', 'Tech'), 'lvSumTech') + srow('box', T('Equipos', 'Equipment'), 'lvSumEq') +
        '</dl></div>' +
        '<div class="sactions"><div class="err" id="lvErr"></div>' +
          '<button type="button" class="btn-create" id="lvBtnCreate" onclick="lvSave(false)">' + ic('check') + h(T('Crear trabajo', 'Create job')) + '</button>' +
          '<button type="button" class="btn-dispatch" id="lvBtnDispatch" onclick="lvSave(true)">' + ic('send') + h(T('Crear y despachar ahora', 'Create and dispatch now')) + '</button>' +
          '<button type="button" class="btn-draft" id="lvBtnQueue" onclick="lvSave(false,true)">' + h(T('Guardar en cola (sin técnico)', 'Save to queue (no tech)')) + '</button>' +
        '</div><p class="snote">' + h(T('Al despachar, la cita le llega al teléfono del técnico con la dirección y las notas de acceso.', 'When dispatched, the appointment reaches the tech\'s phone with the address and access notes.')) + '</p></aside>' +
      '</div>';
    renderTechs();
    renderEq();
    ['lvCName', 'lvCAddr', 'lvCPhone', 'lvDate', 'lvPromise', 'lvDesc', 'lvZone'].forEach(function (id) {
      var x = el(id); if (x) x.addEventListener('input', refreshSummary);
    });
    refreshSummary();
  };
  function srow(icon, k, id) {
    return '<div class="srow">' + ic(icon) + '<dt>' + h(k) + '</dt><dd id="' + id + '"></dd></div>';
  }
  function renderTechs() {
    var box = el('lvTechs'); if (!box || !F) return;
    var day = (el('lvDate') && el('lvDate').value) || ymdOf(new Date());
    var list = F.users.filter(function (u) { return u.role !== 'super'; });
    var zone = ((el('lvZone') && el('lvZone').value) || '').trim().toLowerCase();
    list.sort(function (a, b) {
      var za = zone && String(a.zone).toLowerCase() === zone ? 0 : 1, zb = zone && String(b.zone).toLowerCase() === zone ? 0 : 1;
      return za - zb || jobsToday(a.uid, day) - jobsToday(b.uid, day);
    });
    box.innerHTML = list.map(function (u) {
      var n = jobsToday(u.uid, day);
      var st = TECH_STATUS[u.status] || null;
      return '<button type="button" class="tech' + (F.tech === u.uid ? ' sel' : '') + '" onclick="lvPick(\'tech\',\'' + h(u.uid) + '\')">' +
        '<span class="tav">' + h(initials(u.name)) + '</span><span class="tinfo"><b>' + h(u.name) + (u.techId ? ' · ' + h(u.techId) : '') + '</b>' +
        '<span>' + h([u.zone ? T('Zona ', 'Zone ') + u.zone : '', n + ' ' + T(n === 1 ? 'cita ese día' : 'citas ese día', n === 1 ? 'appointment that day' : 'appointments that day')].filter(Boolean).join(' · ')) + '</span></span>' +
        '<span class="status ' + (st ? st[2] : 'off') + '">' + h(st ? st[EN() ? 1 : 0] : T('Sin estado', 'No status')) + '</span></button>';
    }).join('') +
      '<button type="button" class="tech' + (F.tech === '' ? ' sel' : '') + '" onclick="lvPick(\'tech\',\'\')"><span class="tav">—</span><span class="tinfo"><b>' +
      h(T('Sin asignar todavía', 'Not assigned yet')) + '</b><span>' + h(T('La orden queda en la cola de despacho', 'The order waits in the dispatch queue')) + '</span></span><span class="status off">' + h(T('Cola', 'Queue')) + '</span></button>';
  }
  window.lvPick = function (k, v) {
    if (!F) return;
    if (k === 'type') { F.type = v; document.querySelectorAll('#lvPane .tile').forEach(function (b) { b.classList.toggle('sel', b.dataset.type === v); }); }
    if (k === 'service') { F.service = v; selPills('lvSvc', v); }
    if (k === 'prio') { F.prio = v; selPills('lvPrio', v); }
    if (k === 'win') {
      F.win = v; selPills('lvWin', v);
      var w = WINDOWS.find(function (x) { return x[0] === v; });
      if (w && el('lvPromise')) el('lvPromise').value = w[1];
    }
    if (k === 'confirm') {
      var i = F.confirm.indexOf(v);
      if (i >= 0) F.confirm.splice(i, 1); else F.confirm.push(v);
      document.querySelectorAll('#lvConf button').forEach(function (b) { b.classList.toggle('sel', F.confirm.indexOf(b.dataset.v) >= 0); });
    }
    if (k === 'tech') { F.tech = v; renderTechs(); }
    refreshSummary();
  };
  function selPills(id, v) {
    document.querySelectorAll('#' + id + ' button').forEach(function (b) {
      var on = b.dataset.v === v;
      b.classList.toggle('sel', on);
      b.classList.remove('red', 'amber');
      if (on && b.dataset.cls) b.classList.add(b.dataset.cls);
    });
  }
  window.lvEqFromStock = function (id) {
    if (!F || !id) return;
    var e = F.stock.find(function (x) { return x.id === id; });
    if (e && !F.eq.some(function (x) { return x.id === id; })) F.eq.push({ id: e.id, name: e.name || '', serial: e.serial || '' });
    el('lvEqStock').value = '';
    renderEq(); refreshSummary();
  };
  window.lvEqAddNew = function () {
    if (!F) return;
    var n = (el('lvEqName').value || '').trim();
    var s = (el('lvEqSerial').value || '').trim().replace(/^#/, '');
    if (!n || !s) { toast(T('Pon el nombre y el serial/MAC del equipo.', 'Enter the device name and serial/MAC.')); return; }
    if (F.eq.some(function (x) { return String(x.serial).toLowerCase() === s.toLowerCase(); })) { toast(T('Ese serial ya está en la orden.', 'That serial is already on the order.')); return; }
    F.eq.push({ id: '', name: n, serial: s });
    el('lvEqName').value = ''; el('lvEqSerial').value = '';
    renderEq(); refreshSummary();
  };
  window.lvEqRemove = function (i) { if (!F) return; F.eq.splice(i, 1); renderEq(); refreshSummary(); };
  function renderEq() {
    var box = el('lvEqList'); if (!box || !F) return;
    box.innerHTML = F.eq.map(function (e, i) {
      return '<div class="eqrow"><div><b>' + h(e.name) + '</b><div class="muted" style="font-size:12.5px">#' + h(e.serial) + '</div></div>' +
        '<div class="muted" style="font-size:12.5px">' + h(e.id ? T('Sale de bodega', 'From stock') : T('Equipo nuevo', 'New device')) + '</div>' +
        '<span class="badge ok">' + h(T('ASIGNADO', 'ASSIGNED')) + '</span>' +
        '<button type="button" class="rm" title="' + h(T('Quitar', 'Remove')) + '" onclick="lvEqRemove(' + i + ')">' + ic('x', 'sm') + '</button></div>';
    }).join('');
  }
  function val(id) { var x = el(id); return x ? String(x.value || '').trim() : ''; }
  function setDD(id, text, pending) { var d = el(id); if (!d) return; d.textContent = text; d.classList.toggle('pending', !!pending); }
  function refreshSummary() {
    if (!F) return;
    var title = [typeLabel(F.type), serviceLabel(F.service)].filter(Boolean).join(' ');
    var t = el('lvSumTitle'); if (t) t.textContent = title || T('Orden sin tipo todavía', 'Order without a type yet');
    var svc = serviceLabel(F.service) || T('Sin servicio', 'No service');
    ['lvSumSvc', 'lvBadgeSvc'].forEach(function (id) { var b = el(id); if (b) b.textContent = svc; });
    ['lvSumPrio', 'lvBadgePrio'].forEach(function (id) {
      var b = el(id); if (!b) return;
      b.textContent = T('Prioridad ', 'Priority: ') + prioLabel(F.prio).toLowerCase();
      b.className = 'badge ' + (F.prio === 'emergency' ? 'emergencia' : F.prio === 'high' ? 'alta' : 'normal');
    });
    setDD('lvSumClient', val('lvCName') || T('Sin nombre', 'No name'), !val('lvCName'));
    setDD('lvSumAddr', val('lvCAddr') || T('Sin dirección', 'No address'), !val('lvCAddr'));
    setDD('lvSumAppt', F.win ? fmtDay(val('lvDate')) + ' · ' + windowLabel(F.win) : '—', !F.win);
    setDD('lvSumPromise', val('lvPromise') ? T('Llegada antes de las ', 'Arrive before ') + ampm(val('lvPromise')) : '—', !val('lvPromise'));
    var tu = F.tech ? F.users.find(function (u) { return u.uid === F.tech; }) : null;
    setDD('lvSumTech', tu ? tu.name : (F.tech === '' ? T('En cola', 'Queued') : T('Sin asignar', 'Unassigned')), !tu);
    setDD('lvSumEq', F.eq.length + ' ' + T(F.eq.length === 1 ? 'asignado' : 'asignados', 'assigned'), !F.eq.length);
    var done = {
      orden: !!(F.type && F.service), cliente: !!(val('lvCName') && val('lvCAddr')), cita: !!(F.win && val('lvDate')),
      tecnico: F.tech !== null, equipos: F.eq.length > 0
    };
    Object.keys(done).forEach(function (k) {
      var s = el('lvSec-' + k); if (s) { s.classList.toggle('done', done[k]); s.classList.remove('invalid'); }
      var b = document.querySelector('#lvPane .steps button[data-step="' + k + '"]'); if (b) b.classList.toggle('done', done[k]);
    });
  }

  window.lvSave = async function (dispatchNow, queueOnly) {
    if (!F || F.busy) return;
    var err = el('lvErr'); err.textContent = '';
    var miss = [];
    if (!F.type || !F.service) miss.push('orden');
    if (!val('lvCName') || !val('lvCAddr')) miss.push('cliente');
    if (!F.win || !val('lvDate')) miss.push('cita');
    var techUid = queueOnly ? '' : (F.tech || '');
    if (dispatchNow && !techUid) miss.push('tecnico');
    if (miss.length) {
      miss.forEach(function (k) { var s = el('lvSec-' + k); if (s) s.classList.add('invalid'); });
      el('lvSec-' + miss[0]).scrollIntoView({ behavior: 'smooth' });
      err.textContent = dispatchNow && miss.indexOf('tecnico') >= 0 && miss.length === 1
        ? T('Para despachar, escoge el técnico.', 'To dispatch, pick a tech.')
        : T('Faltan datos en los pasos marcados.', 'Some steps are missing data.');
      return;
    }
    F.busy = true;
    ['lvBtnCreate', 'lvBtnDispatch', 'lvBtnQueue'].forEach(function (id) { if (el(id)) el(id).disabled = true; });
    try {
      var day = val('lvDate');
      var w = WINDOWS.find(function (x) { return x[0] === F.win; });
      var start = new Date(day + 'T' + w[0] + ':00'), end = new Date(day + 'T' + w[1] + ':00');
      var title = typeLabel(F.type) + ' ' + serviceLabel(F.service);
      var addr = val('lvCAddr');
      var desc = val('lvDesc'), access = val('lvAccess');
      var instructions = [desc, access ? T('Acceso: ', 'Access: ') + access : ''].filter(Boolean).join('\n');
      var nowIso = new Date().toISOString();
      var stage = dispatchNow ? 'dispatched' : 'queued';
      var tu = techUid ? F.users.find(function (u) { return u.uid === techUid; }) : null;
      var visit = {
        id: 'v1', scheduledDate: day, startClock: w[0], endClock: w[1],
        hour: start.getHours(), minute: 0, endHour: end.getHours(), endMinute: 0,
        assignedUid: techUid, status: 'open', instructions: instructions, arrivalWindow: 'window',
        checklists: ['jobReport'], title: title
      };
      var payload = {
        companyId: curCid(), companyName: (typeof companyName !== 'undefined' ? companyName : ''),
        buildingId: '', title: title, kind: title,
        clientName: val('lvCName'), contactName: val('lvCName'), contactPhone: val('lvCPhone'), contactEmail: val('lvCEmail'),
        address: addr, description: desc, instructions: instructions,
        lines: [{ name: title, description: desc, qty: 1, unitPrice: 0, total: 0 }],
        visits: [visit], expenses: [], notesLog: [], arrivalWindow: 'window',
        companyType: 'low_voltage', status: 'open',
        scheduledDate: day, startClock: w[0], endClock: w[1],
        hour: start.getHours(), minute: 0, endHour: end.getHours(), endMinute: 0,
        startTime: ampm(w[0]), endTime: ampm(w[1]),
        appointment_start: firebase.firestore.Timestamp.fromDate(start),
        appointment_end: firebase.firestore.Timestamp.fromDate(end),
        unassigned: !techUid,
        lv: {
          externalRef: val('lvRef'), jobType: F.type, service: F.service, priority: F.prio,
          accountNumber: val('lvCAcct'), language: val('lvCLang'), accessNotes: access, zone: val('lvZone'),
          window: { start: w[0], end: w[1], label: w[2] }, durationMin: Number(val('lvDur')) || 90,
          promiseBy: val('lvPromise'), confirmVia: F.confirm.slice(),
          stage: stage, times: dispatchNow ? { dispatched: nowIso } : {},
          log: [{ at: nowIso, byName: myName(), action: 'created', detail: dispatchNow ? 'dispatched' : (techUid ? 'assigned' : 'queued') }]
        }
      };
      if (techUid) {
        Object.assign(payload, {
          workerId: techUid, assignedTo: techUid, assignedUid: techUid, assignedUserId: techUid, assignedUser: techUid,
          assignedName: tu ? tu.name : '', workerName: tu ? tu.name : '', assignedEmail: tu ? tu.email : '',
          assignedUserIds: [techUid], assignedUids: [techUid], workerIds: [techUid], assignedUserNames: [tu ? tu.name : ''],
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        Object.assign(payload, { assignedUid: '', workerId: '', assignedTo: '', assignedName: '' });
      }
      var coRef = db.collection('companies').doc(curCid());
      var jobRef = db.collection('jobs').doc();
      var wo = '';
      await db.runTransaction(async function (tx) {
        var co = await tx.get(coRef);
        var n = ((co.exists && co.data().jobSeq) || 0) + 1;
        wo = 'WO-' + String(n).padStart(5, '0');
        payload.jobNumber = String(n);
        payload.lv.workOrder = wo;
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        payload.createdBy = me();
        tx.set(coRef, { jobSeq: n }, { merge: true });
        tx.set(jobRef, payload);
      });
      // Equipment: existing stock moves to this order; new devices are created.
      for (var i = 0; i < F.eq.length; i++) {
        var e = F.eq[i];
        var patch = {
          companyId: curCid(), jobId: jobRef.id, jobAddress: addr,
          status: techUid ? 'asignado' : 'bodega', assignedUid: techUid, assignedName: tu ? tu.name : '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        var entry = eqLog('asignado', wo + ' · ' + addr + (tu ? ' · ' + tu.name : ''));
        if (e.id) {
          patch.log = firebase.firestore.FieldValue.arrayUnion(entry);
          await db.collection('equipment').doc(e.id).set(patch, { merge: true });
        } else {
          await db.collection('equipment').add(Object.assign(patch, {
            name: e.name, serial: e.serial, photoUrl: '', installSpot: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            log: [eqLog('creado', T('Oficina subió el equipo', 'Office added the device')), entry]
          }));
        }
      }
      if (techUid) {
        await notify(techUid, (dispatchNow ? T('Orden despachada', 'Order dispatched') : T('Te asignaron una orden', 'You were assigned an order')) +
          ': ' + wo + ' · ' + windowLabel(w[0]) + ' · ' + addr);
      }
      toast(T('Orden ' + wo + ' creada', 'Order ' + wo + ' created') + (dispatchNow ? T(' y despachada', ' and dispatched') : ''));
      F = null;
      window.lvOpenOrder(jobRef.id);
    } catch (e2) {
      err.textContent = (e2 && e2.message) || String(e2);
      F.busy = false;
      ['lvBtnCreate', 'lvBtnDispatch', 'lvBtnQueue'].forEach(function (id) { if (el(id)) el(id).disabled = false; });
    }
  };

  // ====================================================== ORDEN EN VIVO
  var O = null; // open order
  window.lvOpenOrder = function (id) {
    if (!id) return;
    var p = enter('lvRailDispatch');
    p.innerHTML = '<p class="muted">' + h(T('Cargando…', 'Loading…')) + '</p>';
    O = { id: id, job: null, users: [], eq: [], sig: null, photos: null };
    loadUsers().then(function (u) { if (O && O.id === id) { O.users = u; paintOrder(); } });
    var unsub = db.collection('jobs').doc(id).onSnapshot(function (d) {
      if (!O || O.id !== id) return;
      O.job = d.exists ? Object.assign({ id: d.id }, d.data()) : null;
      loadEquipment({ jobId: id }).then(function (eq) { if (O && O.id === id) { O.eq = eq; paintOrder(); } });
    }, function (e) { p.innerHTML = '<div class="empty">' + h(e.message || e) + '</div>'; });
    stopLive = function () { unsub(); };
  };
  function paintOrder() {
    var p = pane();
    if (!O || !O.job) return;
    var j = O.job, lv = j.lv || {};
    var keepClose = el('lvCloseForm') && O.closeDirty;
    var st = lv.stage || 'queued';
    var si = stageIndex(st);
    var times = lv.times || {};
    var techName = j.assignedName || '';
    var promise = lv.promiseBy ? ampm(lv.promiseBy) : '';
    var close = lv.close || {};
    var doneCount = O.eq.filter(function (e) { return e.status === 'instalado'; }).length;
    var next = si + 1 < STAGES.length ? STAGES[si + 1] : null;
    var html =
      '<button class="crumb" onclick="lvOpenDispatch()">' + ic('back', 'sm') + h(T('Despacho', 'Dispatch')) + '</button>' +
      '<div class="pagehead"><div><h1>' + h(j.title || T('Orden', 'Order')) + '</h1><p>' + h([j.clientName, j.address].filter(Boolean).join(' · ')) + '</p></div>' +
        '<div class="right"><button class="btn-draft" style="width:auto;padding:10px 14px" onclick="lvClassic(\'' + h(j.id) + '\')">' + h(T('Ver detalle completo', 'Full job detail')) + '</button></div></div>' +
      '<div class="wobar"><div><div class="wo">Work Order</div><div class="wonum">' + h(lv.workOrder || ('#' + (j.jobNumber || ''))) + '</div></div>' +
        '<span class="badge service">' + h(serviceLabel(lv.service) || '—') + '</span>' +
        '<span class="badge ' + (lv.priority === 'emergency' ? 'emergencia' : lv.priority === 'high' ? 'alta' : 'normal') + '">' + h(T('Prioridad ', 'Priority: ') + prioLabel(lv.priority).toLowerCase()) + '</span>' +
        (lv.externalRef ? '<span class="sys">' + h(T('Ref. externa ', 'External ref. ') + lv.externalRef) + '</span>' : '') + '</div>' +
      '<div class="cols"><div class="formcol">' +
      // tracking
      '<section class="card"><div class="cardhead"><span class="n">' + ic('truck', 'sm') + '</span><h2>' + h(T('Rastreo de llegada', 'Arrival tracking')) + '</h2></div>' +
        '<p class="hint">' + h(T('Así lo ve despacho: despachado, en ruta, llegó, trabajando y completado. El técnico lo marca desde su teléfono; la oficina también puede marcarlo aquí.', 'This is what dispatch sees. The tech marks it from the phone; the office can also mark it here.')) + '</p>' +
        '<div class="livestatus"><span class="status ' + stageClass(st) + (st === 'enroute' ? ' pulse' : '') + '" style="background:rgba(255,255,255,.14);color:#fff">' + h(stageWord(lv)) + '</span>' +
          '<span class="big">' + h(techName ? techName : T('Sin técnico', 'No tech')) + '</span>' +
          '<div class="eta"><b>' + h(st === 'completed' ? fmtTime(times.completed) : (promise || '—')) + '</b><span>' + h(st === 'completed' ? T('Completado', 'Completed') : T('Llegada antes de', 'Arrive before')) + '</span></div></div>' +
        '<div class="timeline">' + STAGES.map(function (s, i) {
          var cls = i <= si ? 'done' : (i === si + 1 && si >= 0 ? 'now' : '');
          return '<div class="tstep ' + cls + '"><span class="tdot">' + ic(i <= si ? 'check' : s[5], 'sm') + '</span><div><b>' + h(EN() ? s[2] : s[1]) + '</b><span>' + h(EN() ? s[4] : s[3]) + '</span></div><time>' + h(fmtTime(times[s[0]])) + '</time></div>';
        }).join('') + '</div>' +
        '<div class="advance">' +
          (st === 'queued'
            ? '<button type="button" class="primary" ' + (j.assignedUid ? '' : 'disabled title="' + h(T('Primero asigna un técnico', 'Assign a tech first')) + '"') + ' onclick="lvStage(\'dispatched\')">' + ic('send', 'sm') + h(T('Despachar ahora', 'Dispatch now')) + '</button>'
            : (next ? '<button type="button" class="' + (next[0] === 'completed' ? 'primary' : '') + '" onclick="lvStage(\'' + next[0] + '\')">' + ic(next[5], 'sm') + h(T('Marcar: ', 'Mark: ') + (EN() ? next[2] : next[1])) + '</button>' : '')) +
          (si > 0 && st !== 'completed' ? '<button type="button" onclick="lvStage(\'' + STAGES[si - 1][0] + '\',true)">' + h(T('Deshacer último paso', 'Undo last step')) + '</button>' : '') +
        '</div>' +
      '</section>' +
      // move tech
      '<section class="card"><div class="cardhead"><span class="n">' + ic('swap', 'sm') + '</span><h2>' + h(T('Técnico', 'Tech')) + '</h2></div>' +
        '<p class="hint">' + h(T('Mover el trabajo le quita la orden a un técnico y se la pone al otro. Fotos, notas e historial se quedan; los equipos sin instalar pasan al nuevo técnico.', 'Moving the job takes it from one tech and gives it to another. Photos, notes and history stay; uninstalled equipment goes to the new tech.')) + '</p>' +
        '<div class="grid2"><div class="field"><label class="f">' + h(T('Ahora', 'Now')) + '</label><input type="text" readonly value="' + h(techName || T('Sin asignar', 'Unassigned')) + '"></div>' +
        '<div class="field"><label class="f" for="lvMoveTo">' + h(T('Mover a', 'Move to')) + '</label><select id="lvMoveTo"><option value="">' + h(T('— Escoge el técnico —', '— Pick the tech —')) + '</option>' +
          O.users.filter(function (u) { return u.uid !== j.assignedUid; }).map(function (u) { return '<option value="' + h(u.uid) + '">' + h(u.name) + '</option>'; }).join('') + '</select></div></div>' +
        '<button type="button" class="btn-dispatch" style="width:auto;padding:12px 18px" onclick="lvMove()">' + ic('swap') + h(j.assignedUid ? T('Mover trabajo', 'Move job') : T('Asignar técnico', 'Assign tech')) + '</button>' +
      '</section>' +
      // equipment
      '<section class="card"><div class="cardhead"><span class="n">' + ic('box', 'sm') + '</span><h2>' + h(T('Equipos de la orden', 'Order equipment')) + '</h2></div>' +
        (O.eq.length ? O.eq.map(function (e) {
          var inst = e.status === 'instalado';
          return '<div class="eqrow" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto">' +
            '<div><b>' + h(e.name || '') + '</b><div class="muted" style="font-size:12.5px">#' + h(e.serial || '') + '</div></div>' +
            '<div class="muted" style="font-size:12.5px">' + h(inst ? [e.installedByName, fmtTime(e.installedAt)].filter(Boolean).join(' · ') : (e.assignedName || T('En bodega', 'In stock'))) + '</div>' +
            '<span class="status ' + (inst ? 'done' : e.status === 'asignado' ? 'ruta' : 'off') + '">' + h(inst ? T('INSTALADO', 'INSTALLED') : e.status === 'asignado' ? T('EN MANO', 'IN HAND') : T('EN BODEGA', 'IN STOCK')) + '</span></div>';
        }).join('') : '<p class="muted" style="margin:0">' + h(T('Sin equipos en esta orden.', 'No equipment on this order.')) + '</p>') +
      '</section>' +
      // close
      '<section class="card" id="lvCloseForm"><div class="cardhead"><span class="n">' + ic('flag', 'sm') + '</span><h2>' + h(T('Cierre del trabajo', 'Job close-out')) + '</h2>' +
        (close.code ? '<span class="ok" style="display:inline-flex">' + ic('check', 'sm') + h(closeLabel(close.code)) + '</span>' : '') + '</div>' +
        '<p class="hint">' + h(T('Lo que se deja firmado antes de salir: señal medida, velocidad, foto de la instalación, código de cierre y firma del cliente.', 'What is signed before leaving: measured signal, speed, install photo, close code and customer signature.')) + '</p>' +
        '<div class="grid3"><div class="field"><label class="f" for="lvSig">' + h(T('Señal medida (dBmV)', 'Measured signal (dBmV)')) + '</label><input type="text" id="lvSig" value="' + h(close.signalDbmv || '') + '" placeholder="-2.5"></div>' +
        '<div class="field"><label class="f" for="lvSpeed">' + h(T('Velocidad probada (Mbps)', 'Tested speed (Mbps)')) + '</label><input type="number" id="lvSpeed" value="' + h(close.speedMbps || '') + '" placeholder="940"></div>' +
        '<div class="field"><label class="f" for="lvCode">' + h(T('Código de cierre', 'Close code')) + '</label><select id="lvCode"><option value="">' + h(T('— Elige el cierre —', '— Pick the close —')) + '</option>' +
          CLOSE_CODES.map(function (c) { return '<option value="' + c[0] + '"' + (close.code === c[0] ? ' selected' : '') + '>' + h(EN() ? c[2] : c[1]) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label class="f">' + h(T('Foto de la instalación', 'Install photo')) + '</label><div class="photoline"><div class="thumbs" id="lvThumbs">' +
          ((close.photos || []).map(function (u) { return '<a href="' + h(u) + '" target="_blank" rel="noopener"><img src="' + h(u) + '" alt=""></a>'; }).join('') ||
            '<span class="muted" style="font-size:13px">' + h(T('Sin fotos todavía', 'No photos yet')) + '</span>') +
          '</div><label class="up">' + ic('cam', 'sm') + h(T('Agregar foto', 'Add photo')) + '<input type="file" accept="image/*" multiple onchange="lvAddPhotos(this.files)"></label></div></div>' +
        '<div class="field"><label class="f">' + h(T('Firma del cliente', 'Customer signature')) + '</label><div class="sigbox">' +
          (close.signatureUrl && !O.resign
            ? '<img src="' + h(close.signatureUrl) + '" alt=""><div class="sigfoot"><span>' + h(T('Firmado', 'Signed') + (close.signedAt ? ' · ' + fmtTime(close.signedAt) : '')) + '</span><button type="button" onclick="lvResign()">' + h(T('Firmar otra vez', 'Sign again')) + '</button></div>'
            : '<canvas id="lvCanvas" width="640" height="220"></canvas><div class="sigfoot"><span id="lvSigStatus">' + h(T('El cliente firma aquí con el dedo o el mouse', 'The customer signs here with a finger or mouse')) + '</span><button type="button" onclick="lvSigClear()">' + h(T('Borrar', 'Clear')) + '</button></div>') +
        '</div></div>' +
        '<div class="field"><label class="f" for="lvNotes">' + h(T('Notas de cierre', 'Close notes')) + '</label><textarea id="lvNotes" placeholder="' + h(T('Qué se hizo, qué quedó pendiente, qué se le explicó al cliente…', 'What was done, what is pending, what the customer was told…')) + '">' + h(close.notes || '') + '</textarea></div>' +
        '<div class="err" id="lvCloseErr"></div>' +
        '<button type="button" class="btn-create" style="width:auto;padding:12px 20px" id="lvCloseBtn" onclick="lvSaveClose()">' + ic('check') + h(T('Guardar cierre', 'Save close-out')) + '</button>' +
      '</section>' +
      '</div>' +
      // summary
      '<aside class="summary"><div class="shead"><h3>' + h(T('Resumen', 'Summary')) + '</h3><span class="wonum">' + h(lv.workOrder || '') + '</span></div>' +
        '<div class="sbody"><p class="jobtitle">' + h(j.title || '') + '</p>' +
        '<dl>' +
          sr('user', T('Cliente', 'Customer'), [j.clientName, lv.accountNumber ? '#' + lv.accountNumber : ''].filter(Boolean).join(' · ')) +
          sr('home', T('Dirección', 'Address'), j.address) +
          sr('cal', T('Cita', 'Appt.'), fmtDay(j.scheduledDate) + ' · ' + windowLabel(j.startClock)) +
          sr('clock', T('Promesa', 'Promise'), promise ? T('Antes de las ', 'Before ') + promise : '') +
          sr('truck', T('Técnico', 'Tech'), techName) +
          sr('box', T('Equipos', 'Equipment'), O.eq.length + ' ' + T('asignados', 'assigned') + ' · ' + doneCount + ' ' + T('instalados', 'installed')) +
          sr('pin', T('Zona', 'Zone'), lv.zone) +
          sr('flag', T('Cierre', 'Close'), closeLabel(close.code)) +
          (j.contactPhone ? sr('user', T('Teléfono', 'Phone'), j.contactPhone) : '') +
        '</dl>' +
        (lv.accessNotes ? '<div class="strack"><div class="lbl">' + h(T('Notas de acceso', 'Access notes')) + '</div><div style="font-size:13.5px">' + h(lv.accessNotes) + '</div></div>' : '') +
        '<div class="strack"><div class="lbl">' + h(T('Estado en vivo', 'Live status')) + '</div><div class="val"><span class="livedot ' + (st === 'completed' ? 'done' : (si >= 0 ? 'on' : '')) + '"></span>' + h(stageWord(lv)) + '</div></div>' +
        '</div></aside>' +
      '</div>';
    // Keep what the office is typing in the close-out when the job updates live.
    var saved = keepClose ? { sig: val('lvSig'), speed: val('lvSpeed'), code: val('lvCode'), notes: el('lvNotes').value } : null;
    p.innerHTML = html;
    if (saved) { el('lvSig').value = saved.sig; el('lvSpeed').value = saved.speed; el('lvCode').value = saved.code; el('lvNotes').value = saved.notes; }
    ['lvSig', 'lvSpeed', 'lvCode', 'lvNotes'].forEach(function (id) { var x = el(id); if (x) x.addEventListener('input', function () { O.closeDirty = true; }); });
    initCanvas();
  }
  function sr(icon, k, v) {
    return '<div class="srow">' + ic(icon) + '<dt>' + h(k) + '</dt><dd class="' + (v ? '' : 'pending') + '">' + h(v || '—') + '</dd></div>';
  }
  window.lvClassic = function (id) {
    leave();
    if (typeof window.__lvOrigJobDetail === 'function') window.__lvOrigJobDetail(id);
  };
  window.lvStage = async function (stage, undo) {
    if (!O || !O.job) return;
    var j = O.job;
    if (stage === 'dispatched' && !j.assignedUid) { toast(T('Primero asigna un técnico.', 'Assign a tech first.')); return; }
    var patch = {};
    patch['lv.stage'] = stage;
    patch['lv.log'] = firebase.firestore.FieldValue.arrayUnion({ at: new Date().toISOString(), byName: myName(), action: undo ? 'undo' : 'stage', detail: stage });
    if (!undo) patch['lv.times.' + stage] = new Date().toISOString();
    else {
      var after = STAGES.slice(stageIndex(stage) + 1).map(function (s) { return s[0]; });
      after.forEach(function (s) { patch['lv.times.' + s] = firebase.firestore.FieldValue.delete(); });
    }
    if (stage === 'arrived' || stage === 'started') {
      patch.visitStartedAt = j.visitStartedAt || firebase.firestore.FieldValue.serverTimestamp();
    }
    if (stage === 'completed') {
      patch.status = 'completed';
      patch.completedAt = firebase.firestore.FieldValue.serverTimestamp();
      var vs = (j.visits || []).map(function (v) { return Object.assign({}, v, { status: 'completed' }); });
      if (vs.length) patch.visits = vs;
    } else if (String(j.status || '').toLowerCase() === 'completed') {
      patch.status = 'open';
      var vs2 = (j.visits || []).map(function (v) { return Object.assign({}, v, { status: 'open' }); });
      if (vs2.length) patch.visits = vs2;
    }
    try {
      await db.collection('jobs').doc(j.id).update(patch);
      if (stage === 'dispatched') {
        await notify(j.assignedUid, T('Orden despachada', 'Order dispatched') + ': ' + ((j.lv && j.lv.workOrder) || '') + ' · ' + windowLabel(j.startClock) + ' · ' + (j.address || ''));
      }
      toast(T('Estado: ', 'Status: ') + stageWord({ stage: stage }));
    } catch (e) { toast(e.message || String(e)); }
  };

  // Move the job: every field that names the tech changes (no duplicate).
  window.lvMove = async function () {
    if (!O || !O.job) return;
    var j = O.job;
    var to = val('lvMoveTo');
    if (!to) { toast(T('Escoge a quién se lo pasas.', 'Pick who gets it.')); return; }
    var u = O.users.find(function (x) { return x.uid === to; });
    var from = j.assignedName || T('nadie', 'nobody');
    var ok = window.confirm(T(
      '¿Mover todo a ' + u.name + '?\n\nFotos, notas e historial: SE QUEDAN\nEquipos sin instalar: pasan a ' + u.name + '\n\nSolo cambia el asignado: ' + from + ' → ' + u.name,
      'Move everything to ' + u.name + '?\n\nPhotos, notes and history: STAY\nUninstalled equipment: goes to ' + u.name + '\n\nOnly the assignee changes: ' + from + ' → ' + u.name));
    if (!ok) return;
    var fromUid = j.assignedUid || j.workerId || '';
    var visits = (j.visits || []).map(function (v) {
      var x = Object.assign({}, v);
      var s = String(x.status || '').toLowerCase();
      var closed = ['completed', 'closed', 'done', 'completado'].indexOf(s) >= 0;
      if (!closed || !x.assignedUid || x.assignedUid === fromUid) x.assignedUid = to;
      return x;
    });
    var patch = {
      workerId: to, assignedTo: to, assignedUid: to, assignedUserId: to, assignedUser: to,
      assignedName: u.name, workerName: u.name, assignedEmail: u.email || '',
      assignedUserIds: [to], assignedUids: [to], workerIds: [to], assignedUserNames: [u.name],
      unassigned: false, assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reassignLog: firebase.firestore.FieldValue.arrayUnion({ fromUid: fromUid, fromName: j.assignedName || '', toUid: to, toName: u.name, byName: myName(), at: new Date().toISOString() }),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (visits.length) patch.visits = visits;
    // If it was on the road with the old tech, it goes back to "dispatched" for the new one.
    if (['enroute', 'arrived', 'started'].indexOf((j.lv || {}).stage) >= 0) patch['lv.stage'] = 'dispatched';
    try {
      await db.collection('jobs').doc(j.id).update(patch);
      for (var i = 0; i < O.eq.length; i++) {
        var e = O.eq[i];
        if (e.status === 'instalado') continue;
        await db.collection('equipment').doc(e.id).set({
          status: 'asignado', assignedUid: to, assignedName: u.name, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          log: firebase.firestore.FieldValue.arrayUnion(eqLog('movido', T('Trabajo movido a ', 'Job moved to ') + u.name))
        }, { merge: true });
      }
      await notify(to, T('Te asignaron una orden', 'You were assigned an order') + ': ' + ((j.lv && j.lv.workOrder) || '') + ' · ' + (j.address || ''));
      toast(T('Listo. La orden ahora es de ', 'Done. The order now belongs to ') + u.name);
    } catch (e2) { toast(e2.message || String(e2)); }
  };

  // ---- close-out: photos, signature, save
  var sigDirty = false;
  function initCanvas() {
    var c = el('lvCanvas'); if (!c) return;
    sigDirty = false;
    var ctx = c.getContext('2d');
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#182420';
    var drawing = false;
    function pos(ev) {
      var r = c.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (c.width / r.width), y: (ev.clientY - r.top) * (c.height / r.height) };
    }
    c.addEventListener('pointerdown', function (ev) { drawing = true; c.setPointerCapture(ev.pointerId); var p = pos(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
    c.addEventListener('pointermove', function (ev) {
      if (!drawing) return; var p = pos(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); sigDirty = true;
      var s = el('lvSigStatus'); if (s) s.textContent = T('Firmado — se guarda con el cierre', 'Signed — saved with the close-out');
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { c.addEventListener(n, function () { drawing = false; }); });
  }
  window.lvSigClear = function () {
    var c = el('lvCanvas'); if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height); sigDirty = false;
    var s = el('lvSigStatus'); if (s) s.textContent = T('El cliente firma aquí con el dedo o el mouse', 'The customer signs here with a finger or mouse');
  };
  window.lvResign = function () { if (!O) return; O.resign = true; paintOrder(); };
  window.lvAddPhotos = async function (files) {
    if (!O || !O.job || !files || !files.length) return;
    toast(T('Subiendo fotos…', 'Uploading photos…'));
    try {
      var urls = [];
      for (var i = 0; i < files.length; i++) urls.push(await uploadFile(files[i], 'lv_' + O.job.id));
      await db.collection('jobs').doc(O.job.id).update({ 'lv.close.photos': firebase.firestore.FieldValue.arrayUnion(...urls) });
      toast(T('Fotos guardadas', 'Photos saved'));
    } catch (e) { toast(e.message || String(e)); }
  };
  window.lvSaveClose = async function () {
    if (!O || !O.job) return;
    var err = el('lvCloseErr'); err.textContent = '';
    var code = val('lvCode');
    if (!code) { err.textContent = T('Escoge el código de cierre.', 'Pick the close code.'); return; }
    var btn = el('lvCloseBtn'); btn.disabled = true;
    try {
      var patch = {
        'lv.close.signalDbmv': val('lvSig'), 'lv.close.speedMbps': val('lvSpeed'), 'lv.close.code': code,
        'lv.close.notes': el('lvNotes').value.trim(), 'lv.close.byName': myName(), 'lv.close.at': new Date().toISOString()
      };
      if (sigDirty && el('lvCanvas')) {
        var blob = await new Promise(function (res) { el('lvCanvas').toBlob(res, 'image/png'); });
        patch['lv.close.signatureUrl'] = await uploadFile(blob, 'lv_firma_' + O.job.id);
        patch['lv.close.signedAt'] = new Date().toISOString();
      }
      if (code === 'no_home') {
        patch.needsReschedule = true;
        patch.lastVisitResult = { result: 'no_home', note: el('lvNotes').value.trim(), at: new Date().toISOString(), byName: myName(), photo: ((O.job.lv || {}).close || {}).photos ? O.job.lv.close.photos[0] || '' : '', seen: false };
      }
      if (code === 'revisit') patch.needsReturn = true;
      await db.collection('jobs').doc(O.job.id).update(patch);
      O.closeDirty = false; O.resign = false;
      toast(T('Cierre guardado', 'Close-out saved'));
      if ((code === 'completed' || code === 'partial') && (O.job.lv || {}).stage !== 'completed' &&
          window.confirm(T('¿Marcar la orden como COMPLETADA?', 'Mark the order as COMPLETED?'))) {
        await window.lvStage('completed');
      }
    } catch (e) { err.textContent = e.message || String(e); }
    if (btn) btn.disabled = false;
  };

  // ====================================================== EQUIPOS (inventario)
  var invFilter = 'all', invQuery = '';
  window.lvOpenInventory = async function () {
    if (!lvOn || !canOffice()) return;
    var p = enter('lvRailEquip');
    p.innerHTML = '<p class="muted">' + h(T('Cargando…', 'Loading…')) + '</p>';
    var users = await loadUsers();
    var unsub = db.collection('equipment').where('companyId', '==', curCid()).onSnapshot(function (s) {
      var list = [];
      s.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
      paintInventory(list, users);
    }, function (e) { p.innerHTML = '<div class="empty">' + h(e.message || e) + '</div>'; });
    stopLive = function () { unsub(); };
  };
  var invCache = { list: [], users: [] };
  function paintInventory(list, users) {
    invCache = { list: list, users: users };
    var p = pane();
    var keep = { name: val('lvInvName'), serial: val('lvInvSerial'), tech: val('lvInvTech') };
    var cnt = function (s) { return list.filter(function (e) { return (e.status || 'bodega') === s; }).length; };
    var rows = list.filter(function (e) { return invFilter === 'all' || (e.status || 'bodega') === invFilter; });
    var q = invQuery.trim().toLowerCase();
    if (q) rows = rows.filter(function (e) { return [e.name, e.serial, e.assignedName, e.jobAddress, e.installedByName].join(' ').toLowerCase().indexOf(q) >= 0; });
    var order = { asignado: 0, bodega: 1, instalado: 2 };
    rows.sort(function (a, b) { return (order[a.status] == null ? 1 : order[a.status]) - (order[b.status] == null ? 1 : order[b.status]) || String(a.serial).localeCompare(String(b.serial)); });
    var chip = function (k, l, n) { return '<button type="button" class="' + (invFilter === k ? 'sel' : '') + '" onclick="lvInvSet(\'f\',\'' + k + '\')">' + h(l) + ' (' + n + ')</button>'; };
    p.innerHTML =
      '<div class="pagehead"><div><h1>' + h(T('Equipos · Inventario', 'Equipment · Inventory')) + '</h1>' +
      '<p>' + h(T('Cada equipo con su serial: en bodega, en mano de un técnico o instalado en qué casa, con foto y quién lo instaló.', 'Every device with its serial: in stock, in a tech\'s hands or installed at which home, with photo and who installed it.')) + '</p></div></div>' +
      '<div class="card" style="margin:14px 0 16px"><div class="cardhead"><span class="n">' + ic('plus', 'sm') + '</span><h2>' + h(T('Agregar equipo', 'Add equipment')) + '</h2></div>' +
        '<div class="grid3" style="grid-template-columns:1.2fr 1fr 1fr auto;align-items:end">' +
          '<div class="field" style="margin:0"><label class="f" for="lvInvName">' + h(T('Nombre', 'Name')) + '</label><input type="text" id="lvInvName" placeholder="' + h(T('Cámara Ring, gateway…', 'Ring camera, gateway…')) + '"></div>' +
          '<div class="field" style="margin:0"><label class="f" for="lvInvSerial">' + h(T('Serial / MAC', 'Serial / MAC')) + '</label><input type="text" id="lvInvSerial" placeholder="R-8821"></div>' +
          '<div class="field" style="margin:0"><label class="f" for="lvInvTech">' + h(T('Asignar a', 'Assign to')) + '</label><select id="lvInvTech"><option value="">' + h(T('Nadie · bodega', 'Nobody · stock')) + '</option>' +
            users.map(function (u) { return '<option value="' + h(u.uid) + '">' + h(u.name) + '</option>'; }).join('') + '</select></div>' +
          '<button type="button" class="btn-create" style="width:auto;min-height:44px;padding:10px 18px" onclick="lvInvAdd()">' + h(T('Guardar', 'Save')) + '</button>' +
        '</div></div>' +
      '<div class="toolbar"><div class="pillrow">' + chip('all', T('Todos', 'All'), list.length) + chip('asignado', T('En mano', 'In hand'), cnt('asignado')) +
        chip('bodega', T('En bodega', 'In stock'), cnt('bodega')) + chip('instalado', T('Instalado', 'Installed'), cnt('instalado')) + '</div>' +
        '<input type="search" id="lvInvQ" placeholder="' + h(T('Buscar serial, técnico, casa…', 'Search serial, tech, home…')) + '" value="' + h(invQuery) + '" oninput="lvInvSet(\'q\',this.value)"></div>' +
      (rows.length ? '<table class="inv"><thead><tr><th></th><th>' + h(T('Equipo', 'Device')) + '</th><th>' + h(T('Estado', 'Status')) + '</th><th>' + h(T('Dónde / quién', 'Where / who')) + '</th><th></th></tr></thead><tbody>' +
        rows.map(function (e) {
          var st = e.status || 'bodega';
          var photo = e.installPhotoUrl || e.photoUrl || '';
          var where = st === 'instalado' ? [e.jobAddress, e.installedByName, fmtTime(e.installedAt)].filter(Boolean).join(' · ')
            : st === 'asignado' ? [e.assignedName, e.jobAddress].filter(Boolean).join(' · ') : T('Oficina · sin asignar', 'Office · unassigned');
          return '<tr><td>' + (photo ? '<a href="' + h(photo) + '" target="_blank" rel="noopener"><img src="' + h(photo) + '" alt=""></a>' : '') + '</td>' +
            '<td><b>' + h(e.name || '') + '</b><div class="muted">#' + h(e.serial || '') + '</div></td>' +
            '<td><span class="status ' + (st === 'instalado' ? 'done' : st === 'asignado' ? 'ruta' : 'off') + '">' + h(st === 'instalado' ? T('INSTALADO', 'INSTALLED') : st === 'asignado' ? T('EN MANO', 'IN HAND') : T('EN BODEGA', 'IN STOCK')) + '</span></td>' +
            '<td class="muted">' + h(where) + '</td>' +
            '<td><select onchange="lvInvAct(\'' + h(e.id) + '\',this.value);this.value=\'\'"><option value="">' + h(T('Acción…', 'Action…')) + '</option>' +
              users.map(function (u) { return '<option value="to:' + h(u.uid) + '">' + h(T('Dar a ', 'Give to ') + u.name) + '</option>'; }).join('') +
              (st !== 'bodega' ? '<option value="stock">' + h(T('Devolver a bodega', 'Return to stock')) + '</option>' : '') + '</select></td></tr>';
        }).join('') + '</tbody></table>'
        : '<div class="empty">' + h(list.length ? T('Nada con ese filtro.', 'Nothing with that filter.') : T('No hay equipos todavía. Agrega el primero arriba.', 'No equipment yet. Add the first one above.')) + '</div>');
    if (keep.name) el('lvInvName').value = keep.name;
    if (keep.serial) el('lvInvSerial').value = keep.serial;
    if (keep.tech) el('lvInvTech').value = keep.tech;
  }
  window.lvInvSet = function (k, v) {
    if (k === 'f') invFilter = v;
    if (k === 'q') invQuery = v;
    paintInventory(invCache.list, invCache.users);
    if (k === 'q') { var s = el('lvInvQ'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  };
  window.lvInvAdd = async function () {
    var name = val('lvInvName'), serial = val('lvInvSerial').replace(/^#/, ''), tech = val('lvInvTech');
    if (!name || !serial) { toast(T('Pon el nombre y el serial.', 'Enter name and serial.')); return; }
    if (invCache.list.some(function (e) { return String(e.serial).toLowerCase() === serial.toLowerCase(); })) { toast(T('Ya existe un equipo con ese serial.', 'A device with that serial already exists.')); return; }
    var u = invCache.users.find(function (x) { return x.uid === tech; });
    try {
      await db.collection('equipment').add({
        companyId: curCid(), name: name, serial: serial, photoUrl: '', installSpot: '',
        status: tech ? 'asignado' : 'bodega', assignedUid: tech, assignedName: u ? u.name : '', jobId: '', jobAddress: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        log: [eqLog('creado', T('Oficina subió el equipo', 'Office added the device'))].concat(u ? [eqLog('asignado', T('Asignado a ', 'Assigned to ') + u.name)] : [])
      });
      if (u) await notify(u.uid, T('Te asignaron equipo: ', 'Equipment assigned to you: ') + name + ' #' + serial);
      el('lvInvName').value = ''; el('lvInvSerial').value = '';
      toast(T('Equipo guardado', 'Device saved'));
    } catch (e) { toast(e.message || String(e)); }
  };
  window.lvInvAct = async function (id, action) {
    if (!action) return;
    var e = invCache.list.find(function (x) { return x.id === id; }); if (!e) return;
    try {
      if (action === 'stock') {
        if (!window.confirm(T('¿Devolver #' + e.serial + ' a bodega? El historial se queda.', 'Return #' + e.serial + ' to stock? History stays.'))) return;
        await db.collection('equipment').doc(id).set({
          status: 'bodega', assignedUid: '', assignedName: '', jobId: '', jobAddress: '', updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          log: firebase.firestore.FieldValue.arrayUnion(eqLog('bodega', T('Devuelto a bodega', 'Returned to stock')))
        }, { merge: true });
      } else if (action.indexOf('to:') === 0) {
        var u = invCache.users.find(function (x) { return x.uid === action.slice(3); }); if (!u) return;
        await db.collection('equipment').doc(id).set({
          status: e.status === 'instalado' ? 'instalado' : 'asignado', assignedUid: u.uid, assignedName: u.name, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          log: firebase.firestore.FieldValue.arrayUnion(eqLog('asignado', T('Asignado a ', 'Assigned to ') + u.name))
        }, { merge: true });
        await notify(u.uid, T('Te asignaron equipo: ', 'Equipment assigned to you: ') + (e.name || '') + ' #' + (e.serial || ''));
      }
      toast(T('Listo', 'Done'));
    } catch (e2) { toast(e2.message || String(e2)); }
  };

  // ------------------------------------------------- hook into the panel
  function hook() {
    if (typeof window.openCreateJob === 'function' && !window.openCreateJob.__lv) {
      var origCreate = window.openCreateJob;
      var wrapped = function () {
        if (lvOn && canOffice()) return window.lvOpenCreate();
        return origCreate.apply(this, arguments);
      };
      wrapped.__lv = true;
      window.openCreateJob = wrapped;
    }
    if (typeof window.openJobDetail === 'function' && !window.openJobDetail.__lv) {
      var origDetail = window.openJobDetail;
      window.__lvOrigJobDetail = origDetail;
      var wd = function (id) {
        var j = (typeof jobs !== 'undefined' ? jobs : []).find(function (x) { return x.id === id; });
        if (lvOn && j && j.lv) return window.lvOpenOrder(id);
        return origDetail.apply(this, arguments);
      };
      wd.__lv = true;
      window.openJobDetail = wd;
    }
    if (typeof window.openJobView === 'function' && !window.openJobView.__lv) {
      var origView = window.openJobView;
      var wv = function (id) {
        var j = (typeof jobs !== 'undefined' ? jobs : []).find(function (x) { return x.id === id; });
        if (lvOn && canOffice() && j && j.lv) return window.lvOpenOrder(id);
        return origView.apply(this, arguments);
      };
      wv.__lv = true;
      window.openJobView = wv;
    }
  }
  function boot() {
    addRail(); hook(); syncGate();
    setInterval(function () { addRail(); hook(); syncGate(); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
