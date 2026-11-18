/* Payroll / Nómina (sección propia del menú; solo dueño / admin).
   Horas de cada técnico en la semana o la quincena: horas REALES (cuando el
   técnico empieza la visita en la app y cuando la completa) y, si una visita
   no tiene hora real, la del horario (marcada). Tarifa por hora de cada
   técnico, horas extra (más de 40 en una semana, a 1.5) y total a pagar.
   La tarifa vive en companies/{id}/payRates/{uid}: solo el dueño la ve y la
   cambia (el perfil del trabajador lo puede editar él mismo). Al aprobar se
   guarda en companies/{id}/payrolls/{inicio}. */
(function () {
  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function h2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function toD(x) { if (!x) return null; var d = x.toDate ? x.toDate() : new Date(x); return isNaN(d) ? null : d; }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayLabel(s) {
    var d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function clockMin(s) {
    var m = String(s || '').match(/^(\d{1,2}):(\d{2})/);
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  // "9:05 AM" / "2:30 pm" / "14:30" → "HH:MM" (24 h).
  function ampm24(t) {
    var m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])?/);
    if (!m) return '';
    var h = +m[1];
    if (m[3]) { h = h % 12; if (/p/i.test(m[3])) h += 12; }
    return pad(h) + ':' + m[2];
  }

  var P = window.payrollState = window.payrollState || { kind: 'week', start: ymdOf(monday(addDays(new Date(), -7))), rates: null };

  async function loadRates() {
    var out = {};
    try {
      var snap = await db.collection('companies').doc(cid()).collection('payRates').get();
      snap.forEach(function (d) { out[d.id] = Number(d.data().rate || 0); });
    } catch (e) {}
    P.rates = out;
    return out;
  }

  // Hours typed by hand (office, shop, driving, a helper on a job).
  async function loadManual(from, to) {
    var out = [];
    try {
      var snap = await db.collection('companies').doc(cid()).collection('payHours')
        .where('day', '>=', from).where('day', '<=', to).get();
      snap.forEach(function (d) { out.push(Object.assign({ id: d.id }, d.data())); });
    } catch (e) {}
    P.manual = out; P.manualKey = from + '|' + to;
    return out;
  }
  function period() {
    var start = new Date(P.start + 'T12:00:00');
    return { from: P.start, to: ymdOf(addDays(start, (P.kind === 'biweek' ? 14 : 7) - 1)) };
  }
  async function ensureManual() {
    var pr = period();
    if (P.manualKey !== pr.from + '|' + pr.to) await loadManual(pr.from, pr.to);
  }
  var KINDS = { office: ['Oficina', 'Office'], shop: ['Taller', 'Shop'], drive: ['Manejo', 'Driving'], helper: ['Ayudante en un trabajo', 'Helper on a job'], other: ['Otro', 'Other'] };
  function kindLabel(k) { var x = KINDS[k] || KINDS.other; return T(x[0], x[1]); }

  // Every visit of the period, per technician, with its hours.
  function entries(from, to) {
    var out = [];
    (typeof jobs !== 'undefined' ? jobs : []).forEach(function (j) {
      if (typeof jobArchived === 'function' && jobArchived(j)) return;
      var visits = Array.isArray(j.visits) && j.visits.length ? j.visits : [j];
      var single = visits.length === 1;
      visits.forEach(function (v) {
        var day = String(v.scheduledDate || j.scheduledDate || '').slice(0, 10);
        if (!day || day < from || day > to) return;
        var uid = v.assignedUid || (typeof accountUidOf === 'function' ? accountUidOf(j) : '') || '';
        if (!uid) return;
        // The app stamps the job (visitStartedAt / completedAt), not each
        // visit: those stamps belong to the visit of the same day.
        var ja = toD(j.visitStartedAt || j.startedAt), jb = toD(j.completedAt || j.closedAt);
        var a = toD(v.startedAt || v.visitStartedAt) || (ja && (single || ymdOf(ja) === day) ? ja : null);
        var b = toD(v.completedAt || v.closedAt) || (jb && (single || ymdOf(jb) === day) ? jb : null);
        var rp = j.report || {};
        var s = clockMin(v.startClock || j.startClock), e = clockMin(v.endClock || j.endClock);
        if (s == null && typeof (v.hour != null ? v.hour : j.hour) === 'number') s = (v.hour != null ? v.hour : j.hour) * 60 + Number(v.minute || j.minute || 0);
        if (e == null && typeof (v.endHour != null ? v.endHour : j.endHour) === 'number') e = (v.endHour != null ? v.endHour : j.endHour) * 60 + Number(v.endMinute || j.endMinute || 0);
        var hrs = 0, real = false, how = '';
        // Job Report: the tech writes the real start and end.
        var ra = clockMin(ampm24(rp.actualStart)), rb = clockMin(ampm24(rp.actualEnd));
        if (ra != null && rb != null && rb > ra) { hrs = (rb - ra) / 60; real = true; how = 'report'; }
        else if (a && b && b > a && (b - a) < 16 * 3600000) { hrs = (b - a) / 3600000; real = true; }
        else if (!a && b && s != null && ymdOf(b) === day) {
          // Closed in the app without "Comenzar visita": from the scheduled
          // start to the real close.
          var bm = b.getHours() * 60 + b.getMinutes();
          if (bm > s && bm - s < 16 * 60) { hrs = (bm - s) / 60; real = true; how = 'end'; }
        }
        if (!real) hrs = s != null && e != null && e > s ? (e - s) / 60 : 1;
        out.push({ key: 'j:' + j.id + ':' + (v.id || '') + ':' + day, uid: uid, day: day, hrs: hrs, real: real, how: how,
          job: (j.jobNumber ? '#' + j.jobNumber + ' ' : '') + (j.kind || j.title || ''), addr: (typeof cardAddr === 'function' ? cardAddr(j) : (j.address || '')) });
      });
    });
    // Building walkthroughs the tech does from his list of buildings are not
    // jobs: add them too (skip one already counted as a job that same day at
    // the same address).
    function ampm(t, dayStr) {
      var m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])?/);
      if (!m) return null;
      var h = +m[1] % 12; if (m[3] && /p/i.test(m[3])) h += 12; if (!m[3] && +m[1] === 12) h = 12;
      return h * 60 + (+m[2]);
    }
    var key = function (s) { return typeof siteKey === 'function' ? siteKey(s) : String(s || '').toLowerCase(); };
    (typeof reportWalks !== 'undefined' ? reportWalks : []).forEach(function (w) {
      var uid = w.assignedUid || '';
      if (!uid) return;
      var a = toD(w.startedAt || w.createdAt), b = toD(w.closedAt || w.completedAt);
      var d = b || a;
      if (!d) return;
      var day = ymdOf(d);
      if (day < from || day > to) return;
      var addr = w.address || w.title || w.buildingName || '';
      if (out.some(function (e) { return e.uid === uid && e.day === day && addr && key(e.addr).indexOf(key(addr).slice(0, 12)) >= 0; })) return;
      var hrs = 0, real = false;
      if (a && b && b > a && (b - a) < 16 * 3600000 && ymdOf(a) === day) { hrs = (b - a) / 3600000; real = true; }
      else {
        var s1 = ampm(w.appointmentStart), e1 = ampm(w.appointmentEnd);
        hrs = s1 != null && e1 != null && e1 > s1 ? (e1 - s1) / 60 : 1;
      }
      out.push({ key: 'w:' + (w.id || addr) + ':' + day, uid: uid, day: day, hrs: hrs, real: real, job: 'Walkthrough', addr: addr });
    });
    // Fixes by hand: a payHours row with "replaces" takes the place of the
    // job/walkthrough hours with that key (0 h = that day does not count).
    var fixes = {};
    (P.manual || []).forEach(function (m) { if (m.replaces) fixes[m.replaces] = m; });
    out = out.filter(function (e) { return !fixes[e.key]; });
    (P.manual || []).forEach(function (m) {
      if (!m.uid || !m.day || m.day < from || m.day > to) return;
      out.push({ uid: m.uid, day: m.day, hrs: Number(m.hours || 0), real: true, manual: true, fixed: !!m.replaces, id: m.id,
        job: m.replaces ? (m.label || T('Corregido', 'Fixed')) : kindLabel(m.kind), addr: m.note || '' });
    });
    return out;
  }

  function techName(uid) {
    var t = (typeof teamAll !== 'undefined' && teamAll.find(function (x) { return x.uid === uid; })) || (typeof techs !== 'undefined' && techs.find(function (x) { return x.uid === uid; }));
    return (t && t.name) || T('Técnico', 'Technician');
  }

  function compute() {
    var start = new Date(P.start + 'T12:00:00');
    var days = P.kind === 'biweek' ? 14 : 7;
    var from = P.start, to = ymdOf(addDays(start, days - 1));
    var list = entries(from, to);
    P.lastEntries = list;
    list.forEach(function (e, i) { e.idx = i; });
    var by = {};
    list.forEach(function (e) {
      var t = by[e.uid] || (by[e.uid] = { uid: e.uid, name: techName(e.uid), items: [], real: 0, sched: 0, weeks: [0, 0] });
      t.items.push(e);
      if (e.real) t.real += e.hrs; else t.sched += e.hrs;
      var w = Math.floor((new Date(e.day + 'T12:00:00') - start) / (7 * 86400000));
      t.weeks[Math.max(0, Math.min(1, w))] += e.hrs;
    });
    var rows = Object.keys(by).map(function (k) {
      var t = by[k];
      var total = t.real + t.sched;
      var ot = t.weeks.reduce(function (s, w) { return s + Math.max(0, w - 40); }, 0);
      var reg = total - ot;
      var rate = Number((P.rates || {})[t.uid] || 0);
      t.items.sort(function (a, b) { return a.day < b.day ? -1 : 1; });
      return Object.assign(t, { total: total, ot: ot, reg: reg, rate: rate, pay: reg * rate + ot * rate * 1.5 });
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { from: from, to: to, rows: rows, total: rows.reduce(function (s, r) { return s + r.pay; }, 0) };
  }

  // Own section of the menu: the Reports pane shows only the payroll.
  (function () {
    var st = document.createElement('style');
    st.textContent = 'body.view-payroll #reportsPane>:not(#rptOut){display:none!important}' +
      'body.view-payroll #reportsPane{padding:16px}';
    document.head.appendChild(st);
  })();
  function payrollRailOn(on) {
    var r = $('railPayroll');
    if (r) r.classList.toggle('on', on);
    if (on) { var rr = $('railReports'); if (rr) rr.classList.remove('on'); }
  }
  new MutationObserver(function () {
    var b = document.body.classList;
    if (b.contains('view-payroll') && !b.contains('view-reports')) { b.remove('view-payroll'); payrollRailOn(false); }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  function wrapOpenReports() {
    var orig = window.openReports;
    if (typeof orig !== 'function' || orig.__py) return;
    var w = function () { document.body.classList.remove('view-payroll'); payrollRailOn(false); return orig.apply(this, arguments); };
    w.__py = true;
    window.openReports = w;
  }
  setInterval(function () {
    wrapOpenReports();
    var r = $('railPayroll');
    if (r) r.classList.toggle('hidden', !(typeof canSeeMoney === 'function' && canSeeMoney()));
  }, 1500);
  wrapOpenReports();
  window.payrollLoadRates = loadRates;
  window.payrollRates = function () { return P.rates || {}; };

  window.openPayroll = async function () {
    if (typeof canSeeMoney !== 'function' || !canSeeMoney()) return;
    if (!document.body.classList.contains('view-reports') && typeof openReports === 'function') await openReports();
    document.body.classList.add('view-payroll');
    payrollRailOn(true);
    var out = $('rptOut');
    if (!out) return;
    out.innerHTML = '<p class="muted">' + esc(T('Calculando horas…', 'Adding up hours…')) + '</p>';
    if (!P.rates) await loadRates();
    try { if (typeof loadReportWalks === 'function') await loadReportWalks(); } catch (e) {}
    await ensureManual();
    paint();
    var pn = $('reportsPane'); if (pn) pn.scrollTop = 0;
  };
  window.payrollSet = async function (k, v) {
    if (k === 'kind') P.kind = v;
    if (k === 'start' && v) P.start = ymdOf(monday(new Date(v + 'T12:00:00')));
    if (k === 'shift') P.start = ymdOf(addDays(new Date(P.start + 'T12:00:00'), (P.kind === 'biweek' ? 14 : 7) * v));
    await ensureManual();
    paint();
  };
  // "+ Horas": hours by hand for anyone on the team.
  window.payrollAddForm = function () {
    var box = $('pyAdd');
    if (!box) return;
    if (box.innerHTML) { box.innerHTML = ''; return; }
    var team = ((typeof teamAll !== 'undefined' && teamAll.length) ? teamAll : (typeof techs !== 'undefined' ? techs : []))
      .slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    var pr = period();
    box.innerHTML = '<div class="py-addf">' +
      '<label>' + esc(T('Empleado', 'Employee')) + '<select id="pyU">' + team.map(function (t) {
        return '<option value="' + esc(t.uid) + '">' + esc((t.name || t.email || t.uid) + (t.disabled ? ' (' + T('desactivado', 'disabled') + ')' : '')) + '</option>';
      }).join('') + '</select></label>' +
      '<label>' + esc(T('Día', 'Day')) + '<input id="pyD" type="date" min="' + esc(pr.from) + '" max="' + esc(pr.to) + '" value="' + esc(pr.from) + '"></label>' +
      '<label>' + esc(T('Horas', 'Hours')) + '<input id="pyH" type="number" min="0.25" max="24" step="0.25" inputmode="decimal" placeholder="8"></label>' +
      '<label>' + esc(T('Tipo', 'Type')) + '<select id="pyK">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + esc(kindLabel(k)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="py-wide">' + esc(T('Nota (opcional)', 'Note (optional)')) + '<input id="pyN" type="text" maxlength="120" placeholder="' + esc(T('Ej.: ayudó en 8000 Harding Ave', 'E.g.: helped at 8000 Harding Ave')) + '"></label>' +
      '<div class="py-wide"><span class="py-ot" id="pyErr"></span> <button class="btn" onclick="payrollAddSave()">' + esc(T('Guardar horas', 'Save hours')) + '</button></div></div>';
  };
  window.payrollAddSave = async function () {
    var uid = $('pyU').value, day = $('pyD').value, hrs = Number($('pyH').value || 0);
    var pr = period();
    if (!uid || !day) { $('pyErr').textContent = T('Escoge empleado y día.', 'Pick employee and day.'); return; }
    if (day < pr.from || day > pr.to) { $('pyErr').textContent = T('El día tiene que estar dentro de este período.', 'The day must be inside this period.'); return; }
    if (!(hrs > 0 && hrs <= 24)) { $('pyErr').textContent = T('Pon las horas (entre 0.25 y 24).', 'Enter the hours (0.25 to 24).'); return; }
    try {
      await db.collection('companies').doc(cid()).collection('payHours').add({
        uid: uid, day: day, hours: hrs, kind: $('pyK').value, note: ($('pyN').value || '').trim(),
        createdBy: (auth.currentUser || {}).uid || '', createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      P.manualKey = '';
      await ensureManual();
      paint();
    } catch (e) { $('pyErr').textContent = T('No se pudo guardar: ', 'Could not save: ') + (e.message || e); }
  };
  // Fix any line: a manual row is changed in place; a job/walkthrough line
  // gets a fix row that replaces it (0 h = does not count that day).
  window.payrollEdit = async function (idx) {
    var e = (P.lastEntries || [])[idx];
    if (!e) return;
    var v = prompt(T('Horas de ', 'Hours for ') + techName(e.uid) + ' · ' + dayLabel(e.day) + (e.job ? ' · ' + e.job : '') +
      T('\n(0 = ese día no cuenta)', '\n(0 = that day does not count)'), h2(e.hrs));
    if (v == null) return;
    var hrs = Number(String(v).replace(',', '.'));
    if (!(hrs >= 0 && hrs <= 24)) { alert(T('Pon horas entre 0 y 24.', 'Enter hours from 0 to 24.')); return; }
    var ref = db.collection('companies').doc(cid()).collection('payHours');
    try {
      if (e.manual) await ref.doc(e.id).set({ hours: hrs, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      else await ref.add({ uid: e.uid, day: e.day, hours: hrs, kind: 'fix', replaces: e.key, label: (e.job || '') + ' · ' + T('corregido', 'fixed'),
        note: e.addr || '', createdBy: (auth.currentUser || {}).uid || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      P.manualKey = '';
      await ensureManual();
      paint();
    } catch (err) { alert(T('No se pudo guardar: ', 'Could not save: ') + (err.message || err)); }
  };
  window.payrollDelHours = async function (id) {
    if (!confirm(T('¿Borrar estas horas?', 'Delete these hours?'))) return;
    try {
      await db.collection('companies').doc(cid()).collection('payHours').doc(id).delete();
      P.manualKey = '';
      await ensureManual();
      paint();
    } catch (e) { alert(T('No se pudo borrar: ', 'Could not delete: ') + (e.message || e)); }
  };
  window.payrollRate = async function (uid, val, noPaint) {
    var rate = Math.max(0, Number(String(val).replace(/[^\d.]/g, '')) || 0);
    if (!P.rates) await loadRates();
    P.rates[uid] = rate;
    try {
      await db.collection('companies').doc(cid()).collection('payRates').doc(uid).set({
        rate: rate, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: (auth.currentUser || {}).uid || ''
      }, { merge: true });
    } catch (e) { alert(T('No se pudo guardar la tarifa: ', 'Could not save the rate: ') + (e.message || e)); }
    if (!noPaint) paint();
  };
  window.payrollCsv = function () {
    var r = compute();
    var lines = [[T('Técnico', 'Technician'), T('Horas reales', 'Real hours'), T('Horas del horario', 'Scheduled hours'), T('Horas regulares', 'Regular hours'), T('Horas extra', 'Overtime'), T('Tarifa', 'Rate'), T('A pagar', 'Pay')]];
    r.rows.forEach(function (x) { lines.push([x.name, h2(x.real), h2(x.sched), h2(x.reg), h2(x.ot), x.rate.toFixed(2), x.pay.toFixed(2)]); });
    lines.push(['TOTAL', '', '', '', '', '', r.total.toFixed(2)]);
    var csv = '﻿' + lines.map(function (l) { return l.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'payroll-' + r.from + '-' + r.to + '.csv';
    a.click();
  };
  window.payrollApprove = async function () {
    var r = compute();
    if (!confirm(T('¿Aprobar el payroll del ', 'Approve payroll for ') + r.from + ' → ' + r.to + ' (' + money(r.total) + ')?')) return;
    try {
      await db.collection('companies').doc(cid()).collection('payrolls').doc(r.from + '_' + r.to).set({
        from: r.from, to: r.to, kind: P.kind, total: Math.round(r.total * 100) / 100,
        rows: r.rows.map(function (x) { return { uid: x.uid, name: x.name, real: +h2(x.real), sched: +h2(x.sched), reg: +h2(x.reg), ot: +h2(x.ot), rate: x.rate, pay: Math.round(x.pay * 100) / 100 }; }),
        approvedBy: (auth.currentUser || {}).uid || '', approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert(T('Payroll aprobado y guardado.', 'Payroll approved and saved.'));
    } catch (e) { alert(T('No se pudo guardar: ', 'Could not save: ') + (e.message || e)); }
  };

  function paint() {
    var out = $('rptOut');
    if (!out) return;
    var r = compute();
    var co = companyName || '';
    var missingRate = r.rows.filter(function (x) { return !x.rate; }).length;
    var anySched = r.rows.some(function (x) { return x.sched > 0; });

    var rateBox = r.rows.map(function (x) {
      return '<label class="py-rate"><span>' + esc(x.name) + '</span><span class="py-in">$<input type="number" min="0" step="0.25" inputmode="decimal" value="' + (x.rate || '') + '" placeholder="0.00" onchange="payrollRate(\'' + esc(x.uid) + '\', this.value)"> /h</span></label>';
    }).join('');

    var rows = r.rows.map(function (x) {
      var detail = x.items.map(function (e) {
        return '<tr class="py-d"><td>' + esc(dayLabel(e.day)) + '</td><td colspan="2">' + esc([e.job, e.addr].filter(Boolean).join(' · ')) + '</td><td class="r">' + h2(e.hrs) + (e.manual ? ' <span class="py-m">' + esc(e.fixed ? T('corregido', 'fixed') : T('a mano', 'manual')) + '</span>' : (e.real ? (e.how === 'end' ? ' <span class="py-m">' + esc(T('cierre real', 'real close')) + '</span>' : '') : ' <span class="py-s">' + esc(T('horario', 'sched.')) + '</span>')) + '</td>' +
          '<td colspan="3" class="r"><span data-html2canvas-ignore="true"><button class="py-e" title="' + esc(T('Cambiar horas', 'Change hours')) + '" onclick="payrollEdit(' + e.idx + ')">✎</button>' +
          (e.manual ? ' <button class="py-x" title="' + esc(e.fixed ? T('Quitar la corrección', 'Remove the fix') : T('Borrar', 'Delete')) + '" onclick="payrollDelHours(\'' + esc(e.id) + '\')">×</button>' : '') + '</span></td></tr>';
      }).join('');
      return '<tr class="py-t"><td><b>' + esc(x.name) + '</b></td><td class="r">' + h2(x.real) + '</td><td class="r">' + h2(x.sched) + '</td><td class="r"><b>' + h2(x.total) + '</b></td>' +
        '<td class="r">' + (x.ot ? '<span class="py-ot">' + h2(x.ot) + '</span>' : '0.00') + '</td><td class="r">' + (x.rate ? money(x.rate) : '<span class="py-ot">—</span>') + '</td><td class="r"><b>' + money(x.pay) + '</b></td></tr>' + detail;
    }).join('');

    var css = '<style>' +
      '.py-ctl{background:#fff;border-radius:12px;padding:14px;margin-bottom:12px}.py-ctl .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
      '.py-ctl select,.py-ctl input[type=date]{padding:8px;border:1px solid #D1D5DB;border-radius:8px;font-size:14px}' +
      '.py-ctl .row .btn{width:auto;flex:none;min-width:44px;padding:8px 14px;margin:0}.py-ctl .row select{flex:1;min-width:150px}' +
      '.py-rates{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:10px}' +
      '.py-rate{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:6px 10px;font-size:13px}' +
      '.py-in input{width:80px;padding:6px;border:1px solid #D1D5DB;border-radius:6px;font-size:14px;text-align:right}' +
      '#rptPaper.py{background:#fff;border:1px solid #16324F;padding:20px;color:#1F2937;font:13px/1.45 "DejaVu Sans",Verdana,sans-serif;max-width:900px;margin:0 auto}' +
      '.py-h{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:3px solid #16324F;padding-bottom:10px;margin-bottom:12px}' +
      '.py-h b{font:700 22px Georgia,serif;color:#16324F;text-transform:uppercase}.py-h .g{color:#1E9E4A;font-weight:700;letter-spacing:.5px}' +
      '.py-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.py-tbl th{background:#16324F;color:#fff;text-align:left;padding:7px 8px;font-size:10.5px;letter-spacing:.4px}' +
      '.py-tbl td{padding:6px 8px;border-top:1px solid #E5E7EB}.py-tbl .r{text-align:right}.py-t td{background:#F3F6F2}.py-d td{color:#6B7280;font-size:11.5px;border-top:0}' +
      '.py-e{border:0;background:#E0E7FF;color:#3730A3;border-radius:6px;width:26px;height:24px;cursor:pointer;font-weight:700}' +
      '.py-m{background:#DBEAFE;color:#1E40AF;border-radius:6px;padding:0 5px;font-size:10px}.py-x{border:0;background:#FEE2E2;color:#B91C1C;border-radius:6px;width:24px;height:24px;cursor:pointer;font-weight:700}' +
      '.py-addf{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:10px;margin-top:10px}.py-addf label{display:flex;flex-direction:column;font-size:12px;color:#6B7280;gap:3px}.py-addf input,.py-addf select{padding:8px;border:1px solid #D1D5DB;border-radius:8px;font-size:14px}.py-wide{grid-column:1/-1}' +
      '.py-s{background:#FEF3C7;color:#92400E;border-radius:6px;padding:0 5px;font-size:10px}.py-ot{color:#C0392B;font-weight:700}' +
      '.py-tot td{border-top:2px solid #16324F;font-size:14px}.py-note{font-size:11.5px;color:#6B7280;margin-top:10px}' +
      '@media (max-width:640px){.py-tbl{font-size:11px}.py-tbl th{font-size:9.5px}}' +
      '</style>';

    lastReportPdf = { blob: null, url: '', name: 'payroll-' + r.from + '-' + r.to + '.pdf', title: co + ' · Payroll · ' + r.from + ' → ' + r.to };

    out.innerHTML = css + '<div class="py-ctl"><h3 style="margin:0 0 8px">' + esc(T('Nómina (Payroll)', 'Payroll')) + '</h3><div class="row">' +
        '<select onchange="payrollSet(\'kind\', this.value)"><option value="week"' + (P.kind === 'week' ? ' selected' : '') + '>' + esc(T('Semanal', 'Weekly')) + '</option>' +
        '<option value="biweek"' + (P.kind === 'biweek' ? ' selected' : '') + '>' + esc(T('Quincenal (2 semanas)', 'Biweekly (2 weeks)')) + '</option></select>' +
        '<button class="btn ghost" onclick="payrollSet(\'shift\', -1)">‹</button>' +
        '<input type="date" value="' + esc(r.from) + '" onchange="payrollSet(\'start\', this.value)">' +
        '<button class="btn ghost" onclick="payrollSet(\'shift\', 1)">›</button>' +
        '<span class="muted">' + esc(T('al ', 'to ') + r.to) + '</span></div>' +
        (r.rows.length ? '<div class="muted" style="margin-top:10px">' + esc(T('Tarifa por hora de cada técnico (solo la ves tú; también se cambia en Trabajadores):', 'Hourly rate per technician (only you see it; also editable in Workers):')) + '</div><div class="py-rates">' + rateBox + '</div>' : '') +
        (missingRate ? '<p class="py-ot" style="margin:8px 0 0">' + esc(T('Falta la tarifa de ', 'Missing rate for ') + missingRate + T(' técnico(s).', ' technician(s).')) + '</p>' : '') +
        '<div style="margin-top:10px"><button class="btn ghost" style="width:auto" onclick="payrollAddForm()">+ ' + esc(T('Horas', 'Hours')) + '</button> <span class="muted" style="font-size:12px">' + esc(T('Oficina, taller, manejo o un ayudante: horas a mano para cualquier empleado.', 'Office, shop, driving or a helper: hours by hand for anyone.')) + '</span><div id="pyAdd"></div></div>' +
        '<div class="rpt-actions" style="margin-top:10px"><button class="btn" onclick="payrollApprove()">✓ ' + esc(T('Aprobar payroll', 'Approve payroll')) + '</button>' +
        '<button class="btn ghost" onclick="downloadReportPdf()">⬇ PDF</button><button class="btn ghost" onclick="payrollCsv()">⬇ Excel (CSV)</button></div></div>' +
      '<div class="rpt-paper py" id="rptPaper"><div class="py-h"><div><b>' + esc(co) + '</b><div class="g">PAYROLL · ' + esc(r.from + ' → ' + r.to) + '</div></div>' +
        '<div style="text-align:right"><div class="muted">' + esc(T('Total a pagar', 'Total to pay')) + '</div><b style="font-size:24px">' + esc(money(r.total)) + '</b></div></div>' +
        (r.rows.length ? '<table class="py-tbl"><thead><tr><th>' + esc(T('TÉCNICO / DÍA', 'TECH / DAY')) + '</th><th class="r">' + esc(T('REALES', 'REAL')) + '</th><th class="r">' + esc(T('HORARIO', 'SCHED.')) + '</th><th class="r">' + esc(T('HORAS', 'HOURS')) + '</th><th class="r">' + esc(T('EXTRA', 'OT')) + '</th><th class="r">' + esc(T('TARIFA', 'RATE')) + '</th><th class="r">' + esc(T('A PAGAR', 'PAY')) + '</th></tr></thead><tbody>' +
          rows + '<tr class="py-tot"><td><b>TOTAL</b></td><td colspan="5"></td><td class="r"><b>' + esc(money(r.total)) + '</b></td></tr></tbody></table>'
          : '<p class="muted">' + esc(T('No hay horas en este período. Usa ‹ › para cambiar de semana o "+ Horas" para agregarlas a mano.', 'No hours in this period. Use ‹ › to change week or "+ Hours" to add them by hand.')) + '</p>') +
        '<div class="py-note">' + esc(T('Reales = inicio y fin que el técnico puso en el Job Report o, si no, desde que empezó la visita en la app hasta que la completó ("cierre real" = no tocó Comenzar y se cuenta desde la hora del horario hasta que cerró). ✎ cambia cualquier línea. ', 'Real = start and end the tech wrote in the Job Report or, if none, from when the visit was started in the app until it was completed ("real close" = Start was not tapped; counted from the scheduled time to the close). ✎ changes any line. ')) +
          (anySched ? esc(T('"horario" = esa visita no tiene hora real y se usó la del horario. ', '"sched." = that visit has no real time; the scheduled time was used. ')) : '') +
          esc(T('"a mano" = horas escritas en Payroll. Horas extra = más de 40 en una semana, a 1.5 la tarifa.', '"manual" = hours typed in Payroll. Overtime = over 40 in a week, at 1.5× the rate.')) + '</div>' +
      '</div>';
  }
})();
