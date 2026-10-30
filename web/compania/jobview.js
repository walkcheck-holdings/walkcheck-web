/* Company panel: job "Visit" window (centered, with tabs) and the assignments list.
   Opening a job shows this window over the list; "Editar trabajo" opens the full
   editor page (openJobDetail in jobs.js). Workers never load this file. */
(function () {
  function L(es, en) { return loginLang() === 'en' ? en : es; }
  function uid() { return (auth.currentUser && auth.currentUser.uid) || ''; }
  function who() { return (profile && (profile.displayName || profile.email)) || (auth.currentUser && auth.currentUser.email) || ''; }
  function usd(n) { return '$' + Number(n || 0).toFixed(2); }
  function toDate(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(d) {
    if (!d) return '';
    return d.toLocaleDateString(L('es-US', 'en-US'), { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateTime(d) {
    if (!d) return '';
    return fmtDate(d) + ', ' + fmtClock(d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'));
  }
  function fmtClock(c) {
    var p = String(c || '').split(':');
    if (p.length < 2) return '';
    var h = parseInt(p[0], 10), m = p[1].slice(0, 2);
    if (isNaN(h)) return '';
    return (h % 12 || 12) + ':' + m + (h < 12 ? ' AM' : ' PM');
  }
  function ymdLabel(s) {
    if (!s) return '';
    var d = new Date(s + 'T12:00:00');
    return isNaN(d.getTime()) ? s : fmtDate(d);
  }
  function techName(id) {
    if (!id) return '';
    var t = (techs || []).find(function (x) { return x.uid === id || x.id === id || String(x.email || '').toLowerCase() === String(id).toLowerCase(); });
    return (t && (t.name || t.displayName || t.email)) || '';
  }
  function clientInfo(j) {
    var c = typeof invoiceClientOf === 'function' ? invoiceClientOf(j) : { name: j.clientName || '', email: j.clientEmail || '', address: j.clientAddress || '' };
    return {
      name: c.name || j.clientName || j.contactName || '',
      email: c.email || j.clientEmail || '',
      phone: j.contactPhone || j.clientPhone || j.phone || '',
      contact: j.contactName || '',
      address: j.address || c.address || '',
      unit: j.unit || '',
      buildingId: j.buildingId || ''
    };
  }
  function mapsUrl(addr) { return 'https://maps.google.com/?q=' + encodeURIComponent(addr || ''); }
  function telHref(p) { return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); }

  /* When and by whom the job was completed (empty when it is not). */
  function completedInfo(j, insp) {
    if (!jobDone(j)) return null;
    var at = toDate(j.completedAt) || toDate(j.closedAt) || toDate(insp && insp.completedAt) || toDate(j.report && j.report.updatedAt) || toDate(j.updatedAt);
    var by = (insp && insp.completedBy && !looksLikeId(insp.completedBy) ? insp.completedBy : '') ||
      techName(j.completedBy) || techName(assignedOf(j)) || techName(j.closedBy) || (j.closedByOffice ? L('Oficina', 'Office') : '');
    return { at: at, by: by };
  }
  function looksLikeId(v) { v = String(v || ''); return v.length >= 20 && v.indexOf(' ') < 0 && v.indexOf('@') < 0; }

  function statusPill(j) {
    if (jobArchived(j)) return '<span class="jv-pill jv-gray">' + esc(L('Archivado', 'Archived')) + '</span>';
    if (j.needsReturn === true) return '<span class="jv-pill jv-red">↩ ' + esc(L('Necesita volver', 'Needs return visit')) + '</span>';
    if (jobDone(j)) return '<span class="jv-pill jv-green">✓ ' + esc(L('Completado', 'Completed')) + '</span>';
    return '<span class="jv-pill jv-amber">' + esc(L('Pendiente', 'Pending')) + '</span>';
  }

  /* ---------- Inspection report labels (same items as the app form) ---------- */
  var INSP = [
    [L('Pisos', 'Flooring'), [
      ['q', 'flooring', L('Revisar el piso de cada cuarto. Estado', 'Check floor in every room. Condition')],
      ['p', 'floor_living', L('Piso de la sala', 'Living room floor')], ['p', 'floor_kitchen', L('Piso de la cocina', 'Kitchen floor')],
      ['p', 'floor_bed1', L('Piso del cuarto 1', 'Bedroom 1 floor')], ['p', 'floor_bed2', L('Piso del cuarto 2', 'Bedroom 2 floor')],
      ['p', 'floor_bed3', L('Piso del cuarto 3', 'Bedroom 3 floor')], ['p', 'floor_bath1', L('Piso del baño 1', 'Bathroom 1 floor')],
      ['p', 'floor_bath2', L('Piso del baño 2', 'Bathroom 2 floor')]]],
    [L('Paredes', 'Walls'), [
      ['q', 'walls', L('Revisar las paredes de cada cuarto. Estado', 'Check walls in every room. Condition')],
      ['p', 'walls_living', L('Paredes de la sala', 'Living room walls')], ['p', 'walls_kitchen', L('Paredes de la cocina', 'Kitchen walls')],
      ['p', 'walls_bed1', L('Paredes del cuarto 1', 'Bedroom 1 walls')], ['p', 'walls_bed2', L('Paredes del cuarto 2', 'Bedroom 2 walls')],
      ['p', 'walls_bed3', L('Paredes del cuarto 3', 'Bedroom 3 walls')], ['p', 'walls_bath1', L('Paredes del baño 1', 'Bathroom 1 walls')],
      ['p', 'walls_bath2', L('Paredes del baño 2', 'Bathroom 2 walls')]]],
    [L('Ventanas', 'Windows'), [['q', 'windows', L('Revisar las ventanas de cada cuarto. Estado', 'Check windows in every room. Condition')]]],
    [L('Techos', 'Ceilings'), [['q', 'ceilings', L('Revisar los techos de cada cuarto. Estado', 'Check ceilings in every room. Condition')]]],
    [L('Baño', 'Bathroom'), [
      ['p', 'bath_full', L('Foto del baño completo', 'Full bathroom')], ['p', 'bath_sink', L('Debajo del lavamanos', 'Under bathroom sink')],
      ['p', 'bath_tub', L('Bañera', 'Bathtub')], ['q', 'bath_flush', L('¿El inodoro descarga bien?', 'Does the toilet flush properly?')]]],
    [L('Cocina', 'Kitchen'), [
      ['p', 'kit_full', L('Foto de la cocina completa', 'Full kitchen')], ['p', 'kit_sink', L('Debajo del fregadero', 'Under kitchen sink')],
      ['q', 'kit_counter', L('Estado del mostrador', 'Kitchen counter condition')]]],
    [L('Detectores de humo', 'Smoke detectors'), [
      ['q', 'smoke_kit', L('Detector de la cocina, ¿funciona?', 'Kitchen detector, does it work?')], ['p', 'smoke_kit_pic', L('Foto del detector de la cocina', 'Kitchen detector photo')],
      ['q', 'smoke_br1', L('Detector del cuarto 1, ¿funciona?', 'Bedroom 1 detector, does it work?')], ['p', 'smoke_br1_pic', L('Foto del detector del cuarto 1', 'Bedroom 1 detector photo')],
      ['q', 'smoke_br2', L('Detector del cuarto 2, ¿funciona?', 'Bedroom 2 detector, does it work?')], ['p', 'smoke_br2_pic', L('Foto del detector del cuarto 2', 'Bedroom 2 detector photo')],
      ['q', 'smoke_br3', L('Detector del cuarto 3, ¿funciona?', 'Bedroom 3 detector, does it work?')], ['p', 'smoke_br3_pic', L('Foto del detector del cuarto 3', 'Bedroom 3 detector photo')]]],
    [L('Aire acondicionado', 'Air conditioning'), [
      ['q', 'ac_working', L('¿Funciona el aire?', 'Is the AC working?')], ['q', 'ac_temp', L('¿A qué temperatura está?', 'Temperature set to')],
      ['p', 'ac_pic', L('Foto del aire', 'AC photo')], ['p', 'ac_filter', L('Foto del filtro', 'AC filter photo')]]],
    [L('Calentador de agua', 'Water heater'), [['p', 'water_heater', L('Foto del calentador', 'Water heater photo')]]],
    [L('Extintor', 'Fire extinguisher'), [
      ['q', 'extinguisher', L('¿Hay extintor en el lugar?', 'Is there a fire extinguisher on site?')],
      ['q', 'extinguisher_exp', L('Fecha de vencimiento del extintor', 'Fire extinguisher expiration date')],
      ['p', 'extinguisher_pic', L('Foto del extintor', 'Fire extinguisher photo')]]],
    [L('Exterior', 'Exterior'), [
      ['p', 'ext_patio', L('Patio (parte de atrás)', 'Patio (back)')], ['p', 'ext_porch', L('Portal (frente)', 'Porch (front)')],
      ['p', 'ext_house', L('Foto de la casa', 'House photo')], ['q', 'exterior_trash', L('¿Hay basura o peligros a la vista?', 'Any visible trash or hazards?')]]],
    [L('Daños por agua', 'Water damage'), [['q', 'water_damage', L('¿Hay goteras o daños por agua?', 'Any leaks or water damage?')]]]
  ];
  function inspPhotos(insp, id) {
    var items = (insp && insp.photos && insp.photos.items) || {};
    return (items[id] || []).filter(function (u) { return /^https?:/.test(String(u)); });
  }

  /* ---------- state ---------- */
  var S = { id: null, job: null, tab: 'info', insp: null, appNotes: [], view: 'job', showAllInsp: false };
  window.jvOpenId = null;

  function modalEl() { return $('jvModal'); }
  function ensureModal() {
    var m = modalEl();
    if (m) return m;
    m = document.createElement('div');
    m.id = 'jvModal';
    m.className = 'jv-backdrop hidden';
    m.addEventListener('click', function (e) { if (e.target === m) closeJobVisit(); });
    document.body.appendChild(m);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !m.classList.contains('hidden')) closeJobVisit();
    });
    return m;
  }

  window.closeJobVisit = function () {
    var m = modalEl();
    if (m) { m.classList.add('hidden'); m.innerHTML = ''; }
    document.body.classList.remove('jv-open');
    S.id = null; window.jvOpenId = null;
  };

  async function loadJob(id) {
    var j = (jobs || []).find(function (x) { return x.id === id; });
    try {
      var d = await db.collection('jobs').doc(id).get();
      if (d.exists) j = Object.assign({ id: d.id }, d.data());
    } catch (_) {}
    return j;
  }
  async function loadExtras(j) {
    var insp = null, appNotes = [];
    try {
      var s = await db.collection('inspection_reports').doc(j.id).get();
      if (s.exists) insp = s.data();
    } catch (_) {}
    try {
      var ns = await db.collection('notes').where('companyId', '==', cid()).where('jobId', '==', j.id).limit(50).get();
      ns.forEach(function (d) { appNotes.push(Object.assign({ id: d.id }, d.data())); });
    } catch (_) {}
    // Worker photos live in several places depending on the app screen used.
    var photos = [], lost = 0;
    function add(src, url) {
      url = String(url || '').trim();
      if (!url) return;
      if (!/^https?:/.test(url)) { lost++; return; } // phone path: never uploaded
      if (!photos.some(function (p) { return p.url === url; })) photos.push({ src: src, url: url });
    }
    jobBeforePhotos(j).forEach(function (u) { add(L('Reporte del trabajo · antes', 'Job report · before'), u); });
    jobAfterPhotos(j).forEach(function (u) { add(L('Reporte del trabajo · después', 'Job report · after'), u); });
    try {
      var jr = await db.collection('jobReports').where('companyId', '==', cid()).where('jobId', '==', j.id).limit(30).get();
      jr.forEach(function (d) {
        var x = d.data() || {};
        var src = x.type === 'danger' ? L('Aviso de peligro', 'Danger alert') + (x.area ? ' · ' + x.area : '') : L('Reporte del trabajo', 'Job report');
        add(src, x.photo);
        (x.photos || []).forEach(function (u) { add(src, u); });
        (x.beforePhotos || []).forEach(function (u) { add(src, u); });
      });
    } catch (_) {}
    try {
      var wt = await db.collection('walkthroughs').doc(j.id).get();
      if (wt.exists) (wt.data().findings || []).forEach(function (f) {
        var src = L('Recorrido', 'Walkthrough') + (f.itemLabel || f.location ? ' · ' + (f.itemLabel || f.location) : '');
        (f.photoUrls || []).forEach(function (u) { add(src, u); });
        if (!(f.photoUrls || []).length) (f.photos || []).forEach(function (u) { add(src, u); });
      });
    } catch (_) {}
    try {
      var ar = await db.collection('walkthroughs').doc(j.id).collection('areas').get();
      ar.forEach(function (d) {
        var x = d.data() || {};
        (x.photos || []).forEach(function (u) { add(L('Área', 'Area') + ' · ' + (x.name || d.id), u); });
      });
    } catch (_) {}
    if (insp) INSP.forEach(function (sec) {
      sec[1].forEach(function (it) {
        if (it[0] === 'p') (((insp.photos || {}).items || {})[it[1]] || []).forEach(function (u) { add(L('Inspección', 'Inspection') + ' · ' + it[2], u); });
      });
    });
    (j.notesLog || []).forEach(function (n) { if (n.photo && !/\.pdf(\?|$)/i.test(n.photo)) add(L('Nota', 'Note'), n.photo); });
    appNotes.forEach(function (n) { add(L('Nota', 'Note'), n.photo); });
    return { insp: insp, appNotes: appNotes, photos: photos, lost: lost };
  }

  function photosHtml() {
    var list = S.photos || [];
    var lostMsg = S.lost ? '<p class="jv-warn">' + esc(L(
      S.lost + (S.lost === 1 ? ' foto se quedó' : ' fotos se quedaron') + ' solo en el teléfono del trabajador: la versión de la app que tiene no las subía. Con la versión nueva de la app ya se suben solas.',
      S.lost + (S.lost === 1 ? ' photo stayed' : ' photos stayed') + ' only on the worker\'s phone: their app version did not upload them. The new app version uploads them.')) + '</p>' : '';
    if (!list.length) return lostMsg || '<p class="muted">' + esc(L('El trabajador todavía no ha subido fotos de este trabajo.', 'The worker has not uploaded photos for this job yet.')) + '</p>';
    var groups = {};
    list.forEach(function (p) { (groups[p.src] = groups[p.src] || []).push(p.url); });
    return Object.keys(groups).map(function (k) {
      return '<div class="jv-photo-grp"><div class="muted">' + esc(k) + '</div><div class="jv-gallery">' + groups[k].map(function (u) {
        return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img class="jv-thumb" loading="lazy" src="' + esc(u) + '" alt="' + esc(k) + '"></a>';
      }).join('') + '</div></div>';
    }).join('') + lostMsg;
  }

  window.openJobVisit = async function (id, tab) {
    if (!id || isWorker()) return;
    var m = ensureModal();
    S.id = id; window.jvOpenId = id; S.view = 'job'; S.showAllInsp = false;
    if (tab) S.tab = tab; else if (S.jobIdForTab !== id) S.tab = 'info';
    S.jobIdForTab = id;
    m.classList.remove('hidden');
    document.body.classList.add('jv-open');
    m.innerHTML = '<div class="jv-box"><p class="muted" style="padding:24px">' + esc(L('Cargando…', 'Loading…')) + '</p></div>';
    var j = await loadJob(id);
    if (!j || S.id !== id) { if (!j) closeJobVisit(); return; }
    var ex = await loadExtras(j);
    if (S.id !== id) return;
    S.job = j; S.insp = ex.insp; S.appNotes = ex.appNotes; S.photos = ex.photos; S.lost = ex.lost;
    render();
  };

  function allNotes(j) {
    var out = [];
    (j.notesLog || []).forEach(function (n) {
      out.push({ by: n.authorName || '', at: toDate(n.at), text: n.text || '', photo: n.photo || '' });
    });
    if (j.notes && !(j.notesLog || []).length) out.push({ by: '', at: null, text: j.notes, photo: '' });
    S.appNotes.forEach(function (n) {
      out.push({ by: n.author || '', at: toDate(n.createdAt), text: n.text || '', photo: /^https?:/.test(String(n.photo || '')) ? n.photo : '' });
    });
    out.sort(function (a, b) { return (b.at ? b.at.getTime() : 0) - (a.at ? a.at.getTime() : 0); });
    return out;
  }
  function checklistKeys(j) {
    var set = {};
    jobVisits(j).forEach(function (v) { (v.checklists || ['inspection', 'jobReport']).forEach(function (k) { set[k] = 1; }); });
    if (S.insp) set.inspection = 1;
    if (j.report) set.jobReport = 1;
    var keys = Object.keys(set).filter(function (k) { return k === 'inspection' || k === 'jobReport'; });
    return keys.length ? keys : ['inspection', 'jobReport'];
  }

  function render() {
    var m = modalEl(), j = S.job;
    if (!m || !j) return;
    if (S.view === 'client') { m.innerHTML = '<div class="jv-box" role="dialog" aria-modal="true">' + clientProfileHtml(j) + '</div>'; return; }
    var c = clientInfo(j);
    var v = jobVisits(j)[0] || {};
    var when = [ymdLabel(v.scheduledDate || j.scheduledDate), [fmtClock(v.startClock || j.startClock), fmtClock(v.endClock || j.endClock)].filter(Boolean).join(' – ')].filter(Boolean).join(', ');
    var notesN = allNotes(j).length, ckN = checklistKeys(j).length;
    var tabs = [['info', L('Info', 'Info'), null], ['client', L('Cliente', 'Client'), null], ['notes', L('Notas', 'Notes'), notesN], ['checklists', L('Checklists', 'Checklists'), ckN]];
    var body = S.tab === 'client' ? clientTabHtml(j) : S.tab === 'notes' ? notesTabHtml(j) : S.tab === 'checklists' ? checklistsTabHtml(j) : infoTabHtml(j);
    m.innerHTML = '<div class="jv-box" role="dialog" aria-modal="true" aria-label="' + esc(j.title || 'Job') + '">' +
      '<button type="button" class="jv-x" onclick="closeJobVisit()" aria-label="' + esc(L('Cerrar', 'Close')) + '">×</button>' +
      '<div class="jv-head">' +
        '<div class="jv-head-main">' +
          '<h2>' + esc(j.title || j.kind || L('Trabajo', 'Job')) + '</h2>' +
          (c.name ? '<div class="jv-client">' + esc(c.name) + '</div>' : '') +
          (c.address ? '<div class="muted">' + esc(c.address) + (c.unit ? ' · Unit ' + esc(c.unit) : '') + '</div>' : '') +
        '</div>' +
        '<div class="jv-head-side">' +
          (when ? '<div class="jv-meta"><span aria-hidden="true">📅</span> ' + esc(when) + '</div>' : '') +
          (c.phone ? '<div class="jv-meta"><span aria-hidden="true">📞</span> <a href="' + esc(telHref(c.phone)) + '">' + esc(c.phone) + '</a></div>' : '') +
          (c.address ? '<div class="jv-meta"><span aria-hidden="true">📍</span> <a target="_blank" rel="noopener" href="' + esc(mapsUrl(c.address)) + '">' + esc(L('Cómo llegar', 'Directions')) + '</a></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="jv-status">' + statusPill(j) + '</div>' +
      '<div class="jv-tabs" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (S.tab === t[0]) + '" class="jv-tab' + (S.tab === t[0] ? ' on' : '') + '" onclick="jvTab(\'' + t[0] + '\')">' +
          esc(t[1]) + (t[2] != null ? ' <span class="jv-count">' + t[2] + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="jv-body">' + body + '</div>' +
      actionsHtml(j) +
    '</div>';
  }
  window.jvTab = function (t) { S.tab = t; S.view = 'job'; render(); };

  function actionsHtml(j) {
    if (!canAssign()) return '';
    var id = j.id, b = [];
    if (!jobArchived(j)) b.push('<button type="button" class="btn ghost" onclick="jvEdit(\'' + id + '\')">' + esc(L('Editar trabajo', 'Edit job')) + '</button>');
    if (!jobArchived(j)) b.push(jobDone(j)
      ? '<button type="button" class="btn ghost" onclick="reopenJob(\'' + id + '\')">' + esc(L('Reabrir trabajo', 'Reopen job')) + '</button>'
      : '<button type="button" class="btn" onclick="closeJob(\'' + id + '\')">' + esc(L('Cerrar trabajo', 'Close job')) + '</button>');
    if (canSeeMoney() && !jobArchived(j)) b.push(j.invoiceId
      ? '<button type="button" class="btn ghost" onclick="closeJobVisit();openInvoice(\'' + esc(j.invoiceId) + '\')">' + esc(L('Ver factura', 'View invoice')) + '</button>'
      : '<button type="button" class="btn ghost" onclick="closeJobVisit();openInvoiceEditor(\'' + id + '\')">' + esc(L('Crear factura', 'Create invoice')) + '</button>');
    b.push(jobArchived(j)
      ? '<button type="button" class="btn ghost" onclick="closeJobVisit();unarchiveJob(\'' + id + '\')">' + esc(L('Desarchivar', 'Unarchive')) + '</button>'
      : '<button type="button" class="btn ghost" onclick="closeJobVisit();askArchiveJob(\'' + id + '\')">' + esc(L('Archivar', 'Archive')) + '</button>');
    return '<div class="jv-actions">' + b.join('') + '</div>';
  }
  window.jvEdit = function (id) { closeJobVisit(); openJobDetail(id); };

  /* ---------- Info ---------- */
  function infoTabHtml(j) {
    var ins = String(j.instructions || j.description || (jobVisits(j)[0] || {}).instructions || '').trim();
    var done = completedInfo(j, S.insp);
    var vs = jobVisits(j);
    var team = [];
    vs.forEach(function (v) { var n = techName(v.assignedUid); if (n && team.indexOf(n) < 0) team.push(n); });
    if (!team.length && techName(assignedOf(j))) team.push(techName(assignedOf(j)));
    // Only lines someone really added (jobLines() invents one from the title otherwise).
    var real = (Array.isArray(j.lines) && j.lines.length) || (Array.isArray(j.quoteLines) && j.quoteLines.length);
    var lines = real ? jobLines(j).filter(function (l) { return String(l.name || l.description || '').trim(); }) : [];
    var money = canSeeMoney();
    var linesHtml = lines.length
      ? '<ul class="jv-lines">' + lines.map(function (l) {
          var t = Number(l.total != null ? l.total : Number(l.qty || 1) * Number(l.unitPrice || 0));
          return '<li><div><b>' + esc(l.name || L('Servicio', 'Service')) + '</b>' + (Number(l.qty || 1) !== 1 ? ' × ' + esc(l.qty) : '') +
            (l.description ? '<div class="muted jv-pre">' + esc(l.description) + '</div>' : '') + '</div>' +
            (money && t > 0 ? '<span>' + usd(t) + '</span>' : '') + '</li>';
        }).join('') + '</ul>' +
        (money && jobLineTotal(j) > 0 ? '<p class="jv-total">' + esc(L('Total', 'Total')) + ' <b>' + usd(jobLineTotal(j)) + '</b></p>' : '')
      : '<p class="muted">' + esc(L('Este trabajo no tiene líneas de producto o servicio.', 'This job has no product or service lines.')) + '</p>';
    return '<section class="jv-sec"><h3>' + esc(L('Instrucciones', 'Instructions')) + '</h3>' +
        (ins ? '<p class="jv-pre jv-ins">' + esc(ins) + '</p>' : '<p class="muted">' + esc(L('Este trabajo no tiene instrucciones.', 'This job has no instructions.')) + '</p>') + '</section>' +
      '<section class="jv-sec"><h3>' + esc(L('Fotos del trabajo', 'Job photos')) + ' <span class="jv-count">' + (S.photos || []).length + '</span></h3>' + photosHtml() + '</section>' +
      '<div class="jv-cols">' +
        '<section class="jv-sec"><h3>' + esc(L('Trabajo', 'Job')) + '</h3><p>' + (j.jobNumber ? '<b>#' + esc(j.jobNumber) + '</b> · ' : '') + esc(j.title || j.kind || '') + '</p></section>' +
        '<section class="jv-sec"><h3>' + esc(L('Equipo', 'Team')) + '</h3>' +
          (team.length ? '<p>' + team.map(esc).join('<br>') + '</p>' : '<p class="muted">' + esc(L('Sin asignar.', 'Not assigned.')) + '</p>') +
          (done ? '<p class="muted">' + esc(L('Completado', 'Completed')) + (done.at ? ' ' + esc(fmtDateTime(done.at)) : '') + (done.by ? ' ' + esc(L('por', 'by')) + ' ' + esc(done.by) : '') + '</p>' : '') +
        '</section>' +
        '<section class="jv-sec"><h3>' + esc(L('Recordatorios', 'Reminders')) + '</h3><p class="muted">' + esc(L('No hay recordatorios programados.', 'No reminders scheduled.')) + '</p></section>' +
      '</div>' +
      '<section class="jv-sec"><h3>' + esc(L('Líneas del trabajo', 'Line items')) + '</h3>' + linesHtml + '</section>';
  }

  /* ---------- Cliente ---------- */
  function clientTabHtml(j) {
    var c = clientInfo(j);
    return '<section class="jv-sec"><div class="jv-sec-head"><h3>' + esc(L('Cliente', 'Client')) + '</h3>' +
        '<button type="button" class="btn ghost jv-small" onclick="jvClient()">' + esc(L('Ver cliente', 'View client')) + '</button></div>' +
        '<p><b>' + esc(c.name || L('Sin nombre de cliente', 'No client name')) + '</b>' + (c.contact && c.contact !== c.name ? '<br><span class="muted">' + esc(L('Contacto: ', 'Contact: ') + c.contact) + '</span>' : '') + '</p>' +
        '<p>' + (c.phone ? '📞 <a href="' + esc(telHref(c.phone)) + '">' + esc(c.phone) + '</a><br>' : '<span class="muted">' + esc(L('Sin teléfono', 'No phone')) + '</span><br>') +
        (c.email ? '✉️ <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '<span class="muted">' + esc(L('Sin correo', 'No email')) + '</span>') + '</p></section>' +
      '<section class="jv-sec"><h3>' + esc(L('Propiedad', 'Property')) + '</h3>' +
        (c.address ? '<p>' + esc(c.address) + (c.unit ? '<br>Unit ' + esc(c.unit) : '') + '<br><a target="_blank" rel="noopener" href="' + esc(mapsUrl(c.address)) + '">' + esc(L('Cómo llegar', 'Directions')) + '</a></p>'
          : '<p class="muted">' + esc(L('Sin dirección.', 'No address.')) + '</p>') + '</section>';
  }

  /* Jobs of the same client: same building, or same client name/email. */
  function clientJobs(j) {
    var c = clientInfo(j);
    var key = String(c.email || c.name || '').toLowerCase();
    return (jobs || []).filter(function (x) {
      if (x.id === j.id) return true;
      if (j.buildingId && x.buildingId === j.buildingId) return true;
      var cx = clientInfo(x);
      return key && String(cx.email || cx.name || '').toLowerCase() === key;
    }).sort(function (a, b) { return String(jobDate(b)).localeCompare(String(jobDate(a))); });
  }
  function jobDate(x) { var v = jobVisits(x)[0] || {}; return v.scheduledDate || x.scheduledDate || ''; }
  window.jvClient = function () { S.view = 'client'; render(); };
  window.jvBackToJob = function () { S.view = 'job'; render(); };

  function clientProfileHtml(j) {
    var c = clientInfo(j), list = clientJobs(j), money = canSeeMoney();
    var props = [];
    list.forEach(function (x) {
      var a = String(x.address || '').trim();
      if (a && props.indexOf(a) < 0) props.push(a);
    });
    var visits = [];
    list.forEach(function (x) {
      jobVisits(x).forEach(function (v) { visits.push({ job: x, v: v }); });
    });
    visits.sort(function (a, b) { return String(b.v.scheduledDate || '').localeCompare(String(a.v.scheduledDate || '')); });
    function visitStatus(v, x) {
      var st = String(v.status || '').toLowerCase();
      if (st === 'completed' || st === 'done' || (jobDone(x) && jobVisits(x).length === 1)) return '<span class="st-done">' + esc(L('Completada', 'Completed')) + '</span>';
      return '<span class="st-pend">' + esc(L('Pendiente', 'Pending')) + '</span>';
    }
    return '<button type="button" class="jv-x" onclick="closeJobVisit()" aria-label="' + esc(L('Cerrar', 'Close')) + '">×</button>' +
      '<button type="button" class="btn ghost jv-small jv-back" onclick="jvBackToJob()">← ' + esc(L('Volver al trabajo', 'Back to job')) + '</button>' +
      '<div class="jv-head"><div class="jv-head-main"><h2>' + esc(c.name || L('Cliente', 'Client')) + '</h2>' +
        '<div class="muted">' + esc(L('Ficha del cliente', 'Client profile')) + '</div></div></div>' +
      '<div class="jv-body">' +
        '<section class="jv-sec"><h3>' + esc(L('Contacto', 'Contact')) + '</h3><p>' +
          (c.contact && c.contact !== c.name ? esc(c.contact) + '<br>' : '') +
          (c.phone ? '📞 <a href="' + esc(telHref(c.phone)) + '">' + esc(c.phone) + '</a><br>' : '') +
          (c.email ? '✉️ <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '<span class="muted">' + esc(L('Sin correo', 'No email')) + '</span>') + '</p></section>' +
        '<section class="jv-sec"><h3>' + esc(L('Propiedades', 'Properties')) + ' <span class="jv-count">' + props.length + '</span></h3>' +
          (props.length ? '<ul class="jv-list">' + props.map(function (a) {
            return '<li><span>' + esc(a) + '</span><a target="_blank" rel="noopener" href="' + esc(mapsUrl(a)) + '">' + esc(L('Mapa', 'Map')) + '</a></li>';
          }).join('') + '</ul>' : '<p class="muted">' + esc(L('Sin propiedades registradas.', 'No properties.')) + '</p>') + '</section>' +
        '<section class="jv-sec"><h3>' + esc(L('Trabajos', 'Jobs')) + ' <span class="jv-count">' + list.length + '</span></h3>' +
          '<ul class="jv-list">' + list.map(function (x) {
            var t = jobLineTotal(x);
            return '<li class="jv-click" onclick="openJobVisit(\'' + x.id + '\',\'info\')"><span><b>' + esc(x.title || x.kind || L('Trabajo', 'Job')) + '</b>' +
              (x.jobNumber ? ' <span class="muted">#' + esc(x.jobNumber) + '</span>' : '') + '<br><span class="muted">' + esc(ymdLabel(jobDate(x)) || '—') + '</span></span>' +
              '<span class="jv-right">' + statusPill(x) + (money && t > 0 ? '<br><b>' + usd(t) + '</b>' : '') + '</span></li>';
          }).join('') + '</ul></section>' +
        '<section class="jv-sec"><h3>' + esc(L('Visitas', 'Visits')) + ' <span class="jv-count">' + visits.length + '</span></h3>' +
          (visits.length ? '<ul class="jv-list">' + visits.slice(0, 40).map(function (it) {
            var v = it.v;
            return '<li><span>' + esc(ymdLabel(v.scheduledDate) || '—') + (v.startClock ? ' · ' + esc(fmtClock(v.startClock)) : '') +
              '<br><span class="muted">' + esc(it.job.title || it.job.kind || '') + (techName(v.assignedUid) ? ' · ' + esc(techName(v.assignedUid)) : '') + '</span></span>' +
              '<span class="jv-right">' + visitStatus(v, it.job) + '</span></li>';
          }).join('') + '</ul>' : '<p class="muted">' + esc(L('Sin visitas.', 'No visits.')) + '</p>') + '</section>' +
      '</div>';
  }

  /* ---------- Notas ---------- */
  function draftKey(id) { return 'wk_jvNote_' + id; }
  function notesTabHtml(j) {
    var list = allNotes(j);
    var draft = '';
    try { draft = localStorage.getItem(draftKey(j.id)) || ''; } catch (_) {}
    return '<section class="jv-sec jv-newnote">' +
        '<label for="jvNote" class="jv-label">' + esc(L('Nueva nota', 'New note')) + '</label>' +
        '<textarea id="jvNote" rows="3" placeholder="' + esc(L('Escribe una nota para el equipo…', 'Write a note for the team…')) + '" oninput="jvNoteDraft(this.value)">' + esc(draft) + '</textarea>' +
        '<div class="jv-noterow"><label class="btn ghost jv-small jv-file">📎 ' + esc(L('Adjuntar foto o archivo', 'Attach photo or file')) +
          '<input id="jvNoteFile" type="file" accept="image/*,application/pdf" onchange="jvNoteFileName(this)" hidden></label>' +
          '<span id="jvNoteFileName" class="muted"></span>' +
          '<button type="button" class="btn jv-small" id="jvNoteBtn" onclick="jvSaveNote()">' + esc(L('Guardar nota', 'Save note')) + '</button></div>' +
        '<div id="jvNoteErr" class="err"></div></section>' +
      '<section class="jv-sec"><h3>' + esc(L('Notas del trabajo', 'Job notes')) + ' <span class="jv-count">' + list.length + '</span></h3>' +
        (list.length ? list.map(function (n) {
          var isImg = n.photo && !/\.pdf(\?|$)/i.test(n.photo);
          return '<div class="jv-note"><div class="muted">' + esc(n.by || L('Equipo', 'Team')) + (n.at ? ' · ' + esc(fmtDateTime(n.at)) : '') + '</div>' +
            (n.text ? '<div class="jv-pre">' + esc(n.text) + '</div>' : '') +
            (n.photo ? (isImg
              ? '<a href="' + esc(n.photo) + '" target="_blank" rel="noopener"><img class="jv-thumb" src="' + esc(n.photo) + '" alt="' + esc(L('Foto de la nota', 'Note photo')) + '"></a>'
              : '<a href="' + esc(n.photo) + '" target="_blank" rel="noopener">📄 ' + esc(L('Ver archivo', 'View file')) + '</a>') : '') +
            '</div>';
        }).join('') : '<p class="muted">' + esc(L('Todavía no hay notas en este trabajo.', 'No notes on this job yet.')) + '</p>') + '</section>';
  }
  window.jvNoteDraft = function (v) { try { localStorage.setItem(draftKey(S.id), v || ''); } catch (_) {} };
  window.jvNoteFileName = function (inp) {
    var f = inp.files && inp.files[0];
    $('jvNoteFileName').textContent = f ? f.name : '';
  };
  window.jvSaveNote = async function () {
    var j = S.job; if (!j) return;
    var text = ($('jvNote').value || '').trim();
    var f = $('jvNoteFile').files && $('jvNoteFile').files[0];
    var err = $('jvNoteErr'); err.textContent = '';
    if (!text && !f) { err.textContent = L('Escribe la nota o adjunta una foto.', 'Write the note or attach a photo.'); return; }
    var btn = $('jvNoteBtn'); btn.disabled = true; btn.textContent = L('Guardando…', 'Saving…');
    try {
      var photo = f ? await uploadJobFile(j.id, 'note', f) : '';
      var fresh = await loadJob(j.id) || j;
      var log = (fresh.notesLog || []).slice();
      log.push({ text: text, photo: photo, authorName: who(), authorUid: uid(), at: new Date().toISOString() });
      await db.collection('jobs').doc(j.id).set({ notesLog: log, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      try { localStorage.removeItem(draftKey(j.id)); } catch (_) {}
      fresh.notesLog = log; S.job = fresh;
      render();
    } catch (e) {
      err.textContent = L('No se pudo guardar la nota: ', 'Could not save the note: ') + (e.message || e);
      btn.disabled = false; btn.textContent = L('Guardar nota', 'Save note');
    }
  };

  /* ---------- Checklists ---------- */
  function checklistsTabHtml(j) {
    return checklistKeys(j).map(function (k) { return k === 'inspection' ? inspectionHtml(j) : jobReportHtml(j); }).join('');
  }
  function inspDone(insp) { return !!(insp && (insp.isCompleted === true || insp.status === 'completado' || insp.status === 'completed')); }
  function inspectionHtml(j) {
    var insp = S.insp;
    var done = inspDone(insp) || !!(j.inspectionReport && j.inspectionReport.isCompleted);
    var head = '<div class="jv-sec-head"><h3>' + esc(L('Reporte de inspección', 'Inspection report')) + '</h3>' +
      (done ? '<span class="jv-pill jv-green">✓ ' + esc(L('Completado', 'Completed')) + '</span>'
        : '<span class="jv-pill jv-amber">' + esc(L('Pendiente', 'Pending')) + (insp && insp.total ? ' · ' + esc((insp.filled || 0) + '/' + insp.total) : '') + '</span>') + '</div>';
    if (!insp) return '<section class="jv-sec">' + head + '<p class="muted">' + esc(L('El trabajador todavía no ha llenado este formulario.', 'The worker has not filled this form yet.')) + '</p></section>';
    var fields = insp.fields || {};
    var shown = S.showAllInsp ? INSP : INSP.slice(0, 3);
    var sections = shown.map(function (sec) {
      var rows = sec[1].map(function (it) {
        if (it[0] === 'q') {
          var a = String(fields[it[1]] || '').trim();
          return '<div class="jv-field"><span>' + esc(it[2]) + '</span><b class="' + (a ? '' : 'muted') + '">' + esc(a || L('Sin respuesta', 'No answer')) + '</b></div>';
        }
        var ph = inspPhotos(insp, it[1]);
        if (!ph.length) return '';
        return '<div class="jv-field"><span>' + esc(it[2]) + '</span><div class="jv-thumbs">' + ph.slice(0, 4).map(function (u) {
          return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img class="jv-thumb sm" src="' + esc(u) + '" alt="' + esc(it[2]) + '"></a>';
        }).join('') + (ph.length > 4 ? '<span class="muted">+' + (ph.length - 4) + '</span>' : '') + '</div></div>';
      }).join('');
      return '<div class="jv-insp-sec"><h4>' + esc(sec[0]) + '</h4>' + rows + '</div>';
    }).join('');
    var t0 = insp.startTime || '', t1 = insp.endTime || '';
    var compAt = toDate(insp.completedAt);
    return '<section class="jv-sec">' + head +
      '<div class="jv-field"><span>' + esc(L('Hora de inicio / fin', 'Start / end time')) + '</span><b>' + esc([t0, t1].filter(Boolean).join(' – ') || '—') + '</b></div>' +
      (compAt ? '<div class="jv-field"><span>' + esc(L('Formulario completado', 'Form completed')) + '</span><b>' + esc(fmtDateTime(compAt)) + (insp.completedBy && !looksLikeId(insp.completedBy) ? ' · ' + esc(insp.completedBy) : '') + '</b></div>' : '') +
      sections +
      (S.showAllInsp ? '' : '<button type="button" class="btn ghost jv-small" onclick="jvMoreInsp()">' + esc(L('Ver más campos', 'Show more fields')) + ' (' + (INSP.length - 3) + ')</button>') +
      '<div class="jv-noterow">' +
        '<button type="button" class="btn ghost jv-small" onclick="jvPrintInsp()">⬇ ' + esc(L('Descargar', 'Download')) + '</button>' +
        (canSeeMoney() ? '<button type="button" class="btn ghost jv-small" onclick="jvEmailInsp()">✉️ ' + esc(L('Enviar por correo', 'Email')) + '</button>' : '') +
      '</div><div id="jvInspMsg" class="muted"></div></section>';
  }
  window.jvMoreInsp = function () { S.showAllInsp = true; render(); };

  function jobReportHtml(j) {
    var r = j.report || {};
    var sent = !!(j.jobReport && j.jobReport.isCompleted) || r.completed === true;
    var has = !!(r.problem || (r.beforePhotos || []).length || r.outcome || r.solution);
    var pill = sent ? '<span class="jv-pill jv-green">✓ ' + esc(L('Completado', 'Completed')) + '</span>'
      : has ? '<span class="jv-pill jv-amber">' + esc(L('Borrador guardado', 'Draft saved')) + '</span>'
      : '<span class="jv-pill jv-amber">' + esc(L('Pendiente', 'Pending')) + '</span>';
    var outcome = { yes: L('Sí, se resolvió', 'Yes, solved'), no: L('No se resolvió', 'Not solved'), 'return': L('Necesita volver', 'Needs return visit') }[r.outcome || ''] ||
      (r.solved === true ? L('Sí, se resolvió', 'Yes, solved') : r.solved === false ? L('No se resolvió', 'Not solved') : '');
    var photos = jobBeforePhotos(j).concat(jobAfterPhotos(j)).filter(function (u) { return /^https?:/.test(String(u)); });
    var head = '<div class="jv-sec-head"><h3>' + esc(L('Reporte del trabajo', 'Job report')) + '</h3>' + pill + '</div>';
    if (!has) return '<section class="jv-sec">' + head + '<p class="muted">' + esc(L('El trabajador todavía no ha llenado este reporte.', 'The worker has not filled this report yet.')) + '</p></section>';
    return '<section class="jv-sec">' + head +
      '<div class="jv-field"><span>' + esc(L('¿Qué se necesita reparar?', 'What needs repair?')) + '</span><b class="jv-pre">' + esc(r.problem || '—') + '</b></div>' +
      (outcome ? '<div class="jv-field"><span>' + esc(L('¿Se resolvió?', 'Solved?')) + '</span><b>' + esc(outcome) + '</b></div>' : '') +
      (r.returnReason ? '<div class="jv-field"><span>' + esc(L('Qué falta para terminar', 'What is missing')) + '</span><b class="jv-pre">' + esc(r.returnReason) + '</b></div>' : '') +
      (r.solution ? '<div class="jv-field"><span>' + esc(L('Solución', 'Solution')) + '</span><b class="jv-pre">' + esc(r.solution) + '</b></div>' : '') +
      (photos.length ? '<div class="jv-field"><span>' + esc(L('Fotos', 'Photos')) + '</span><div class="jv-thumbs">' + photos.map(function (u) {
        return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img class="jv-thumb sm" src="' + esc(u) + '" alt="' + esc(L('Foto del reporte', 'Report photo')) + '"></a>';
      }).join('') + '</div></div>' : '') +
      '</section>';
  }

  /* Inspection report as a clean page: print / save as PDF. */
  function inspReportHtml(j) {
    var insp = S.insp || {}, fields = insp.fields || {}, c = clientInfo(j);
    var rows = INSP.map(function (sec) {
      return '<h3>' + esc(sec[0]) + '</h3>' + sec[1].map(function (it) {
        if (it[0] === 'q') return '<p><span>' + esc(it[2]) + '</span><b>' + esc(String(fields[it[1]] || '').trim() || '—') + '</b></p>';
        var ph = inspPhotos(insp, it[1]);
        return ph.length ? '<p><span>' + esc(it[2]) + '</span></p><div class="ph">' + ph.map(function (u) { return '<img src="' + esc(u) + '">'; }).join('') + '</div>' : '';
      }).join('');
    }).join('');
    return '<!doctype html><html lang="' + L('es', 'en') + '"><head><meta charset="utf-8"><title>' + esc(L('Reporte de inspección', 'Inspection report') + ' — ' + (j.title || '')) + '</title>' +
      '<style>body{font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111827;margin:32px}h1{font-size:22px;margin:0 0 4px}h3{margin:22px 0 6px;font-size:15px;border-bottom:1px solid #E5E7EB;padding-bottom:4px}' +
      'p{display:flex;justify-content:space-between;gap:16px;margin:4px 0}p span{color:#4B5563}.ph{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.ph img{width:120px;height:120px;object-fit:cover;border-radius:6px}.m{color:#6B7280}</style></head><body>' +
      '<h1>' + esc(L('Reporte de inspección', 'Inspection report')) + '</h1>' +
      '<div class="m">' + esc(companyName || '') + ' · ' + esc(j.title || '') + (j.jobNumber ? ' #' + esc(j.jobNumber) : '') + '</div>' +
      '<div class="m">' + esc(c.name || '') + (c.address ? ' · ' + esc(c.address) : '') + '</div>' +
      '<p><span>' + esc(L('Hora de inicio / fin', 'Start / end time')) + '</span><b>' + esc([insp.startTime, insp.endTime].filter(Boolean).join(' – ') || '—') + '</b></p>' +
      rows + '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>';
  }
  window.jvPrintInsp = function () {
    var j = S.job; if (!j || !S.insp) return;
    var w = window.open('', '_blank');
    if (!w) { $('jvInspMsg').textContent = L('Permite las ventanas emergentes para descargar.', 'Allow pop-ups to download.'); return; }
    w.document.open(); w.document.write(inspReportHtml(j)); w.document.close();
  };
  window.jvEmailInsp = async function () {
    var j = S.job, insp = S.insp || {}, c = clientInfo(j), msg = $('jvInspMsg');
    if (!c.email) { msg.textContent = L('Falta el correo del cliente. Agrégalo en el cliente.', 'The client email is missing.'); return; }
    if (!confirm(L('¿Enviar el reporte de inspección a ', 'Send the inspection report to ') + c.email + '?')) return;
    var fields = insp.fields || {};
    var html = '<h2>' + esc(L('Reporte de inspección', 'Inspection report')) + '</h2><p>' + esc(j.title || '') + (c.address ? '<br>' + esc(c.address) : '') + '</p>' +
      INSP.map(function (sec) {
        return '<h3>' + esc(sec[0]) + '</h3>' + sec[1].map(function (it) {
          if (it[0] === 'q') return '<p>' + esc(it[2]) + ': <b>' + esc(String(fields[it[1]] || '').trim() || '—') + '</b></p>';
          var ph = inspPhotos(insp, it[1]);
          return ph.length ? '<p>' + esc(it[2]) + ': ' + ph.map(function (u, i) { return '<a href="' + esc(u) + '">' + esc(L('foto ', 'photo ')) + (i + 1) + '</a>'; }).join(' · ') + '</p>' : '';
        }).join('');
      }).join('') + '<p>' + esc(companyName || '') + '</p>';
    try {
      await db.collection('mail').add({
        to: [c.email], companyId: cid(), jobId: j.id,
        message: { subject: L('Reporte de inspección', 'Inspection report') + ' — ' + (j.title || ''), html: html },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      msg.textContent = L('Reporte enviado a ', 'Report sent to ') + c.email;
    } catch (e) { msg.textContent = L('No se pudo enviar: ', 'Could not send: ') + (e.message || e); }
  };

  /* ---------- Assignments list (Trabajos) ---------- */
  function jobSearchBlob(j) {
    return [j.jobNumber, j.title, j.kind, j.clientName, j.contactName, j.address, typeof cardAddr === 'function' ? cardAddr(j) : '', j.instructions].join(' ').toLowerCase();
  }
  function cardHtml(j) {
    var c = clientInfo(j), done = completedInfo(j, null);
    var v = jobVisits(j)[0] || {};
    var desc = String(j.instructions || j.description || v.instructions || '').trim();
    if (desc.length > 110) desc = desc.slice(0, 107) + '…';
    var right = done
      ? '<div class="jv-card-k">' + esc(L('Completado', 'Completed')) + '</div><div>' + esc(done.at ? fmtDateTime(done.at) : '—') + '</div>' +
        (done.by ? '<div class="muted">' + esc(L('por', 'by')) + ' ' + esc(done.by) + '</div>' : '')
      : '<div class="jv-card-k">' + esc(L('Programado', 'Scheduled')) + '</div><div>' + esc(ymdLabel(v.scheduledDate || j.scheduledDate) || L('Sin fecha', 'No date')) +
        (v.startClock ? ' · ' + esc(fmtClock(v.startClock)) : '') + '</div>' +
        '<div class="muted">' + esc(techName(v.assignedUid || assignedOf(j)) || L('Sin asignar', 'Not assigned')) + '</div>';
    return '<button type="button" class="jv-card" onclick="openJobVisit(\'' + j.id + '\')">' +
      '<span class="jv-check ' + (done ? 'on' : (j.needsReturn ? 'ret' : '')) + '" aria-hidden="true">' + (done ? '✓' : (j.needsReturn ? '↩' : '')) + '</span>' +
      '<span class="jv-card-main"><b>' + esc(j.title || j.kind || L('Trabajo', 'Job')) + '</b>' + (j.jobNumber ? ' <span class="muted">#' + esc(j.jobNumber) + '</span>' : '') +
        (c.name ? '<span class="jv-card-sub">' + esc(L('Cliente: ', 'Client: ') + c.name) + '</span>' : '') +
        (j.needsReturn ? '<span class="jv-card-sub st-late">' + esc(L('Necesita volver', 'Needs return visit')) + '</span>' : '') + '</span>' +
      '<span class="jv-card-desc muted">' + esc(desc || L('Sin instrucciones.', 'No instructions.')) + '</span>' +
      '<span class="jv-card-right">' + right + '</span></button>';
  }
  window.openJobs = function (q) {
    if (isWorker()) return;
    document.body.classList.remove('view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived', 'view-home', 'view-search', 'sites-open', 'view-job', 'view-payments');
    document.body.classList.add('view-jobs');
    if (typeof closeMore === 'function') closeMore();
    if (typeof markNav === 'function') markNav('jobs');
    var pane = $('jobsPane'); if (!pane) return;
    var prevScroll = pane.scrollTop;
    var keepFocus = document.activeElement && document.activeElement.id === 'jobSearch';
    var query = (q != null ? q : (($('jobSearch') && $('jobSearch').value) || '')).toLowerCase();
    var list = (jobs || []).filter(function (j) { return !jobArchived(j) && (!query || jobSearchBlob(j).indexOf(query) >= 0); });
    var today = ymd(new Date());
    var pend = [], doneToday = [], doneBefore = [];
    list.forEach(function (j) {
      if (!jobDone(j)) { pend.push(j); return; }
      var d = completedInfo(j, null);
      (d && d.at && ymd(d.at) === today ? doneToday : doneBefore).push(j);
    });
    pend.sort(function (a, b) { return String(jobDate(a)).localeCompare(String(jobDate(b))); });
    function byDone(a, b) { var x = completedInfo(a, null), y = completedInfo(b, null); return ((y && y.at) ? y.at.getTime() : 0) - ((x && x.at) ? x.at.getTime() : 0); }
    doneToday.sort(byDone); doneBefore.sort(byDone);
    function group(title, arr, empty) {
      return '<section class="jv-group"><h3>' + esc(title) + ' <span class="jv-count">' + arr.length + '</span></h3>' +
        (arr.length ? arr.map(cardHtml).join('') : '<p class="muted jv-empty">' + esc(empty) + '</p>') + '</section>';
    }
    pane.innerHTML =
      '<div class="jobs-toolbar"><h2>' + esc(L('Asignaciones', 'Assignments')) + '</h2>' +
        (canAssign() ? '<button class="btn" onclick="openCreateJob()">' + esc(uiT('createJob')) + '</button>' : '') +
        '<button class="btn ghost" onclick="openArchived()">' + esc(L('Archivados', 'Archived')) + '</button></div>' +
      '<div class="jobs-toolbar"><input id="jobSearch" type="search" aria-label="' + esc(L('Buscar trabajos', 'Search jobs')) + '" placeholder="' + esc(L('Buscar trabajos…', 'Search jobs…')) + '" value="' + esc(query) + '" oninput="openJobs(this.value)"></div>' +
      group(L('Pendientes', 'Pending'), pend, L('No hay trabajos pendientes.', 'No pending jobs.')) +
      group(L('Completados hoy', 'Completed today'), doneToday, L('Nada completado hoy todavía.', 'Nothing completed today yet.')) +
      (doneBefore.length ? group(L('Completados antes', 'Completed earlier'), doneBefore, '') : '');
    pane.scrollTop = prevScroll;
    if (keepFocus) { var s = $('jobSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  };

  // Calendar and alerts open a job through openJobView: show the window too.
  window.openJobView = function (id) { return openJobVisit(id); };
  // After close/reopen from the window, refresh the window instead of the editor page.
  window.jvAfterJobChange = function (id) {
    if (window.jvOpenId === id) { openJobVisit(id); if (document.body.classList.contains('view-jobs')) openJobs(); return true; }
    return false;
  };
})();
