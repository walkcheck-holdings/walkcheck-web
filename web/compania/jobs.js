/* Company jobs: list, create, detail, visits, expenses, notes. Workers never load this file. */
(function () {
  function usd(n) {
    return '$' + Number(n || 0).toFixed(2);
  }
  function who() {
    return (profile && (profile.displayName || profile.email)) || (auth.currentUser && auth.currentUser.email) || '';
  }
  function uid() {
    return (auth.currentUser && auth.currentUser.uid) || '';
  }
  function mapsUrl(j) {
    var q = encodeURIComponent(j.address || j.title || '');
    return 'https://maps.google.com/?q=' + q;
  }
  function parseWhen(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    if (v instanceof Date) return v;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  window.jobVisits = function (j) {
    if (j && Array.isArray(j.visits) && j.visits.length) return j.visits;
    if (!j) return [];
    return [{
      id: 'primary',
      scheduledDate: j.scheduledDate || '',
      startClock: j.startClock || '',
      endClock: j.endClock || '',
      assignedUid: assignedOf(j),
      status: j.visitStatus || j.status || 'open',
      instructions: j.instructions || j.description || '',
      arrivalWindow: 'start',
      checklists: ['inspection', 'jobReport'],
      title: j.title || j.kind || ''
    }];
  };
  window.scheduleItems = function () {
    var out = [];
    (jobs || []).forEach(function (j) {
      if (jobArchived(j)) return;
      jobVisits(j).forEach(function (v) {
        out.push(Object.assign({}, j, {
          _visit: v,
          _visitId: v.id,
          scheduledDate: v.scheduledDate || j.scheduledDate,
          startClock: v.startClock || j.startClock,
          endClock: v.endClock || j.endClock,
          hour: v.hour != null ? v.hour : j.hour,
          minute: v.minute != null ? v.minute : j.minute,
          endHour: v.endHour != null ? v.endHour : j.endHour,
          endMinute: v.endMinute != null ? v.endMinute : j.endMinute,
          workerId: v.assignedUid || assignedOf(j),
          assignedUid: v.assignedUid || assignedOf(j),
          assignedTo: v.assignedUid || assignedOf(j),
          status: v.status || j.status,
          visitStatus: v.status || j.visitStatus,
          instructions: v.instructions != null ? v.instructions : j.instructions,
          kind: j.kind || j.title || v.title || 'Job'
        }));
      });
    });
    return out;
  };
  window.jobLines = function (j) {
    if (j && Array.isArray(j.quoteLines) && j.quoteLines.length && !(j.lines && j.lines.length)) {
      return j.quoteLines.map(function (l) {
        var qty = Number(l.qty || 1);
        var unit = Number(l.unitPrice != null ? l.unitPrice : 0);
        return { name: l.name || '', description: l.description || l.desc || '', qty: qty, unitPrice: unit, total: +(qty * unit).toFixed(2) };
      });
    }
    if (j && Array.isArray(j.lines) && j.lines.length) return j.lines;
    if (!j) return [];
    var name = j.kind || j.title || '';
    if (!name) return [];
    var qty = Number(j.qty || 1);
    var unit = Number(j.unitPrice != null ? j.unitPrice : 0);
    return [{ name: name, description: j.description || '', qty: qty, unitPrice: unit, total: +(qty * unit).toFixed(2) }];
  };
  window.jobBeforePhotos = function (j) {
    var r = (j && j.report) || {};
    return (r.beforePhotos || []).concat(r.beforePhoto ? [r.beforePhoto] : []).filter(Boolean);
  };
  window.jobAfterPhotos = function (j) {
    var r = (j && j.report) || {};
    return (r.afterPhotos || []).concat(r.afterPhoto ? [r.afterPhoto] : []).filter(Boolean);
  };
  window.jobHasWorkPhotos = function (j) {
    return jobBeforePhotos(j).length > 0 && jobAfterPhotos(j).length > 0;
  };
  window.jobLineTotal = function (j) {
    return jobLines(j).reduce(function (s, l) {
      return s + Number(l.total != null ? l.total : Number(l.qty || 1) * Number(l.unitPrice || 0));
    }, 0);
  };
  window.jobExpenses = function (j) {
    return (j && Array.isArray(j.expenses)) ? j.expenses : [];
  };
  window.jobExpenseTotal = function (j) {
    return jobExpenses(j).reduce(function (s, e) { return s + Number(e.total || 0); }, 0);
  };
  function firstVisitDate(j) {
    var vs = jobVisits(j);
    var d = (vs[0] && vs[0].scheduledDate) || j.scheduledDate || '';
    return d;
  }
  function jobIsLate(j) {
    if (jobArchived(j) || jobDone(j)) return false;
    var d = firstVisitDate(j);
    if (!d) return false;
    return d < ymd(new Date());
  }
  function statusWord(j) {
    if (jobArchived(j)) return loginLang() === 'en' ? 'Archived' : 'Archivado';
    if (jobDone(j)) return loginLang() === 'en' ? 'Completed' : 'Completado';
    if (jobIsLate(j)) return 'Late';
    return loginLang() === 'en' ? 'Pending' : 'Pendiente';
  }
  function statusClass(j) {
    if (jobDone(j)) return 'st-done';
    if (jobIsLate(j)) return 'st-late';
    return 'st-pend';
  }
  function clockMins(clock) {
    var p = String(clock || '').split(':');
    if (p.length < 2 || !clock) return null;
    var h = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  function durationLabel(j) {
    var mins = 0;
    var r = (j && j.report) || {};
    var a0 = clockMins(r.actualStart);
    var a1 = clockMins(r.actualEnd);
    if (a0 != null && a1 != null && a1 > a0) mins += a1 - a0;
    var vs = jobVisits(j);
    vs.forEach(function (v) {
      var s = clockMins(v.officeStart);
      var e = clockMins(v.officeEnd);
      if (s != null && e != null && e > s) mins += e - s;
    });
    if (!mins) return '—';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + 'h ' + m + 'm';
  }
  function closeJobViews() {
    document.body.classList.remove('view-jobs', 'view-job', 'view-payments');
  }
  function enterJobsView(which) {
    closeMore();
    document.body.classList.remove('view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived', 'view-home', 'view-search', 'sites-open', 'view-jobs', 'view-job', 'view-payments');
    document.body.classList.add(which);
  }
  function readLinesFromForm() {
    var names = document.querySelectorAll('[data-ln]');
    var lines = [];
    for (var i = 0; i < names.length; i++) {
      var name = names[i].value.trim();
      var desc = (document.querySelector('[data-ld="' + i + '"]') || {}).value || '';
      var qty = Number((document.querySelector('[data-lq="' + i + '"]') || {}).value || 1);
      var unit = Number((document.querySelector('[data-lp="' + i + '"]') || {}).value || 0);
      if (!name && !desc && !unit) continue;
      lines.push({ name: name || (loginLang() === 'en' ? 'Service' : 'Servicio'), description: desc, qty: qty || 1, unitPrice: unit, total: +((qty || 1) * unit).toFixed(2) });
    }
    return lines;
  }
  function lineEditorHtml(lines) {
    lines = lines && lines.length ? lines : [{ name: '', description: '', qty: 1, unitPrice: 0, total: 0 }];
    return lines.map(function (l, i) {
      return '<div class="line-row">' +
        '<input data-ln="' + i + '" placeholder="' + esc(loginLang() === 'en' ? 'Item name' : 'Nombre del ítem') + '" value="' + esc(l.name || '') + '">' +
        '<textarea data-ld="' + i + '" rows="3" placeholder="' + esc(loginLang() === 'en' ? 'Scope' : 'Alcance') + '">' + esc(l.description || '') + '</textarea>' +
        '<input data-lq="' + i + '" type="number" min="0" step="1" value="' + esc(l.qty || 1) + '">' +
        '<input data-lp="' + i + '" type="number" min="0" step="0.01" value="' + (l.unitPrice != null ? esc(l.unitPrice) : '') + '">' +
        '<span>' + usd(l.total || 0) + '</span>' +
        '<button type="button" class="btn ghost" onclick="moveJobLine(' + i + ',1)">↓</button>' +
        '</div>';
    }).join('') + '<button type="button" class="btn ghost" onclick="addJobLineRow()">+ ' + esc(loginLang() === 'en' ? 'Line' : 'Línea') + '</button>';
  }

  window.openJobs = function (q) {
    if (isWorker()) return;
    enterJobsView('view-jobs');
    if (typeof markNav === 'function') markNav('jobs');
    var pane = $('jobsPane');
    if (!pane) return;
    var query = (q != null ? q : (($('jobSearch') && $('jobSearch').value) || '')).toLowerCase();
    var list = (jobs || []).filter(function (j) {
      if (jobArchived(j)) return false;
      if (!query) return true;
      var blob = [j.jobNumber, j.title, j.kind, j.clientName, j.contactName, j.address, cardAddr(j)].join(' ').toLowerCase();
      return blob.indexOf(query) >= 0;
    }).sort(function (a, b) {
      return String(firstVisitDate(b)).localeCompare(String(firstVisitDate(a)));
    });
    var rows = list.map(function (j) {
      return '<tr onclick="openJobDetail(\'' + j.id + '\')">' +
        '<td>' + esc(firstVisitDate(j) || '—') + '</td>' +
        '<td class="' + statusClass(j) + '">' + esc(statusWord(j)) + '</td>' +
        '<td>' + (canSeeMoney() ? usd(jobLineTotal(j)) : '—') + '</td>' +
        '<td><b>' + esc(j.title || j.kind || 'Job') + '</b><div class="muted">' +
        esc((j.jobNumber ? '#' + j.jobNumber + ' · ' : '') + (j.clientName || j.contactName || cardAddr(j) || '')) +
        '</div></td></tr>';
    }).join('') || '<tr><td colspan="4" class="muted">' + esc(loginLang() === 'en' ? 'No jobs' : 'Sin trabajos') + '</td></tr>';
    pane.innerHTML =
      '<div class="jobs-toolbar">' +
        '<h2>' + esc(loginLang() === 'en' ? 'Jobs' : 'Trabajos') + '</h2>' +
        (canAssign() ? '<button class="btn" onclick="openCreateJob()">' + esc(uiT('createJob')) + '</button>' : '') +
        '<button class="btn ghost" onclick="openArchived()">' + esc(loginLang() === 'en' ? 'Archived' : 'Archivados') + '</button>' +
      '</div>' +
      '<div class="jobs-toolbar"><input id="jobSearch" type="search" placeholder="' + esc(loginLang() === 'en' ? 'Search jobs…' : 'Buscar trabajos…') + '" value="' + esc(query) + '" oninput="openJobs(this.value)"></div>' +
      '<table class="jobs-table"><thead><tr><th>Schedule</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  };

  window.openCreateJob = function () {
    if (!canAssign()) return;
    enterJobsView('view-job');
    var pane = $('jobPane');
    var bopts = '<option value="">' + esc(uiT('siteOrAddr')) + '</option>' +
      buildings.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    var topts = techs.map(function (t) { return '<option value="' + t.uid + '">' + esc(t.name) + '</option>'; }).join('');
    pane.innerHTML =
      '<div class="job-actions"><button class="btn ghost" onclick="openJobs()">← ' + esc(loginLang() === 'en' ? 'Jobs' : 'Trabajos') + '</button></div>' +
      '<div class="job-sec"><h3>' + esc(uiT('createJob')) + '</h3>' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Client / building' : 'Cliente / edificio') + '</label><select id="njB">' + bopts + '</select>' +
      '<label class="muted">' + esc(uiT('address')) + '</label><input id="njAddr" type="text">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Title' : 'Título') + '</label><input id="njTitle" type="text">' +
      '<label class="muted">' + esc(uiT('contact')) + '</label><input id="njContact" type="text">' +
      '<label class="muted">' + esc(uiT('phone')) + '</label><input id="njPhone" type="text">' +
      '<label class="muted">Email</label><input id="njEmail" type="email">' +
      '</div>' +
      '<div class="job-sec"><h3>Product / Service</h3><p class="muted">' +
        esc(loginLang() === 'en' ? 'Lines inherit from an approved quote. Without a quote they start at $0 — type the price.' : 'Las líneas se heredan de un presupuesto aprobado. Sin quote salen en $0: pon el precio a mano.') +
        '</p><div id="njLines">' + lineEditorHtml([{ name: '', description: '', qty: 1, unitPrice: 0, total: 0 }]) + '</div></div>' +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'First visit' : 'Primera visita') + '</h3>' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Date' : 'Fecha') + '</label><input id="njDate" type="date" value="' + ymd(selectedDay) + '">' +
      '<label class="muted">' + esc(uiT('start')) + '</label><select id="njStart">' + clockChoices('09:00') + '</select>' +
      '<label class="muted">' + esc(uiT('end')) + '</label><select id="njEnd">' + clockChoices('11:00') + '</select>' +
      '<label class="muted">' + esc(uiT('worker')) + '</label><select id="njT">' + topts + '</select>' +
      '<p class="muted">Arrival window: Arrive at start time</p>' +
      '<label class="muted">' + esc(uiT('instructions')) + '</label><textarea id="njInstr" rows="3"></textarea>' +
      '<label><input type="checkbox" id="njCkInsp" checked> Inspection Report</label>' +
      '<label><input type="checkbox" id="njCkJob" checked> Job Report</label>' +
      '</div>' +
      '<div class="err" id="njErr"></div>' +
      '<button class="btn" onclick="saveCreateJob()">' + esc(uiT('save')) + '</button>';
  };

  window.addJobLineRow = function () {
    var wrap = $('njLines') || $('jdLines');
    if (!wrap) return;
    var lines = readLinesFromForm();
    lines.push({ name: '', description: '', qty: 1, unitPrice: 0, total: 0 });
    wrap.innerHTML = lineEditorHtml(lines);
  };
  window.moveJobLine = function (i, dir) {
    var wrap = $('njLines') || $('jdLines');
    if (!wrap) return;
    var lines = readLinesFromForm();
    var j = i + dir;
    if (j < 0 || j >= lines.length) return;
    var t = lines[i]; lines[i] = lines[j]; lines[j] = t;
    wrap.innerHTML = lineEditorHtml(lines);
    if ($('jdLines') && $('jobPane') && $('jobPane').dataset.jid) {
      saveJobLines($('jobPane').dataset.jid, lines);
    }
  };

  window.saveCreateJob = async function () {
    if (!canAssign()) return;
    var err = $('njErr');
    var bid = $('njB').value;
    var uidW = $('njT').value;
    var start = clockToDate(snapClock($('njStart').value), new Date($('njDate').value + 'T12:00:00'));
    var end = clockToDate(snapClock($('njEnd').value), start);
    if (!cid()) { err.textContent = uiT('pickCompany'); return; }
    if (!uidW) { err.textContent = loginLang() === 'en' ? 'Pick a worker.' : 'Elige un trabajador.'; return; }
    if (!start || !end || !(end > start)) { err.textContent = loginLang() === 'en' ? 'End after start.' : 'La hora de fin va después del inicio.'; return; }
    var b = buildings.find(function (x) { return x.id === bid; });
    var title = ($('njTitle').value || '').trim() || (b && b.name) || ($('njAddr').value || '').trim() || 'Job';
    var lines = readLinesFromForm();
    if (!lines.length) lines = [{ name: title, description: '', qty: 1, unitPrice: 0, total: 0 }];
    var cks = [];
    if ($('njCkInsp').checked) cks.push('inspection');
    if ($('njCkJob').checked) cks.push('jobReport');
    var day = $('njDate').value;
    var visit = {
      id: 'v1',
      scheduledDate: day,
      startClock: toClock(start),
      endClock: toClock(end),
      hour: start.getHours(), minute: start.getMinutes(),
      endHour: end.getHours(), endMinute: end.getMinutes(),
      assignedUid: uidW,
      status: 'open',
      instructions: ($('njInstr').value || '').trim(),
      arrivalWindow: 'start',
      checklists: cks,
      title: title
    };
    var payload = Object.assign({
      companyId: cid(), companyName: companyName,
      buildingId: bid || '',
      title: title,
      clientName: (b && b.name) || ($('njContact').value || '').trim(),
      address: ($('njAddr').value || '').trim() || (b && (b.address || b.name)) || title,
      contactName: ($('njContact').value || '').trim(),
      contactPhone: ($('njPhone').value || '').trim(),
      contactEmail: ($('njEmail').value || '').trim(),
      kind: (lines[0] && lines[0].name) || title,
      description: (lines[0] && lines[0].description) || '',
      instructions: visit.instructions,
      lines: lines,
      visits: [visit],
      expenses: [],
      notesLog: [],
      arrivalWindow: 'start',
      companyType: companyType,
      status: 'open',
      scheduledDate: day,
      startClock: visit.startClock, endClock: visit.endClock,
      hour: visit.hour, minute: visit.minute, endHour: visit.endHour, endMinute: visit.endMinute,
      appointment_start: firebase.firestore.Timestamp.fromDate(start),
      appointment_end: firebase.firestore.Timestamp.fromDate(end)
    }, assignmentPatch(uidW));
    try {
      var coRef = db.collection('companies').doc(cid());
      var jobRef = db.collection('jobs').doc();
      await db.runTransaction(async function (tx) {
        var co = await tx.get(coRef);
        var n = ((co.exists && co.data().jobSeq) || 0) + 1;
        payload.jobNumber = String(n);
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        payload.createdBy = uid();
        tx.set(coRef, { jobSeq: n }, { merge: true });
        tx.set(jobRef, payload);
      });
      openJobDetail(jobRef.id);
    } catch (e) { err.textContent = e.message || e; }
  };

  window.openJobDetail = async function (id) {
    if (!id) return;
    var j = jobs.find(function (x) { return x.id === id; });
    try {
      var d = await db.collection('jobs').doc(id).get();
      if (d.exists) j = Object.assign({ id: d.id }, d.data());
    } catch (_) {}
    if (!j) return;
    enterJobsView('view-job');
    var pane = $('jobPane');
    pane.dataset.jid = id;
    var moneyOk = canSeeMoney();
    var lines = jobLines(j);
    var billed = jobLineTotal(j);
    var spent = jobExpenseTotal(j);
    var phone = j.contactPhone || '';
    var phoneHtml = phone ? '<a class="phone" href="tel:' + esc(phone.replace(/[^\d+]/g, '')) + '">' + esc(phone) + '</a>' : '';
    var notes = (j.notesLog || []).map(function (n) {
      var when = n.at && n.at.toDate ? n.at.toDate() : (n.at ? new Date(n.at) : null);
      return '<div class="note-item"><div class="muted">' + esc(n.authorName || '') +
        (when && !isNaN(when) ? ' · ' + when.toLocaleString() : '') + '</div>' + esc(n.text || '') + '</div>';
    }).join('') || (j.notes ? '<div class="note-item">' + esc(j.notes) + '</div>' : '<p class="muted">' + esc(loginLang() === 'en' ? 'No notes' : 'Sin notas') + '</p>');
    var exps = jobExpenses(j).map(function (e) {
      var whoE = e.source === 'worker' ? (loginLang() === 'en' ? 'Field' : 'Campo') : (loginLang() === 'en' ? 'Office' : 'Oficina');
      return '<div class="muted">' + esc(whoE) + ' · ' + esc(e.vendor || '') + ' · ' + esc(e.items || '') + ' · ' + usd(e.total) +
        (e.po ? ' · PO ' + esc(e.po) : '') + (e.date ? ' · ' + esc(e.date) : '') + '</div>';
    }).join('') || '<p class="muted">' + esc(loginLang() === 'en' ? 'No expenses' : 'Sin gastos') + '</p>';
    var vis = jobVisits(j).map(function (v) {
      var tech = techs.find(function (t) { return t.uid === v.assignedUid; });
      var st = String(v.status || '').toLowerCase();
      var done = st === 'completed' || st === 'done';
      var vid = esc(v.id || 'primary');
      return '<div class="visit-row"><div><b>' + esc(v.scheduledDate || '') + ' ' + esc(loginLang() === 'en' ? 'window' : 'ventana') + ' ' +
        esc(v.startClock || '') + '–' + esc(v.endClock || '') +
        '</b><div class="muted">' + esc(v.instructions || '') + '<br>Arrival window: Arrive at start time<br>Checklists: ' +
        esc((v.checklists || []).join(', ') || 'Inspection Report, Job Report') + '</div>' +
        '<label class="muted">' + esc(loginLang() === 'en' ? 'Office hours (typed)' : 'Horas oficina (a mano)') + '</label>' +
        '<input type="time" data-os="' + vid + '" value="' + esc(v.officeStart || '') + '">' +
        '<input type="time" data-oe="' + vid + '" value="' + esc(v.officeEnd || '') + '">' +
        (canAssign() ? '<button type="button" class="btn ghost" onclick="saveVisitOfficeHours(\'' + j.id + '\',\'' + vid + '\')">' + esc(uiT('save')) + '</button>' : '') +
        '</div>' +
        '<div>' + esc((tech && tech.name) || '') + '<br><b class="' + (done ? 'st-done' : 'st-pend') + '">' +
        (done ? '✓ Completed' : statusWord({ status: v.status, scheduledDate: v.scheduledDate })) + '</b></div></div>';
    }).join('');
    pane.innerHTML =
      '<div class="job-actions">' +
        '<button class="btn ghost" onclick="openJobs()">← ' + esc(loginLang() === 'en' ? 'Jobs' : 'Trabajos') + '</button>' +
        (moneyOk && !jobArchived(j) && !j.invoiceId ? '<button class="btn" onclick="openInvoiceEditor(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Create Invoice' : 'Crear factura') + '</button>' : '') +
        (moneyOk && j.invoiceId ? '<button class="btn" onclick="openInvoice(\'' + esc(j.invoiceId) + '\')">' + esc(uiT('money')) + '</button>' : '') +
        (canAssign() && jobDone(j) && !jobArchived(j) ? '<button class="btn ghost" onclick="reopenJob(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Reopen' : 'Reabrir') + '</button>' : '') +
        (canAssign() && !jobArchived(j) ? '<button class="btn ghost" onclick="askArchiveJob(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Archive' : 'Archivar') + '</button>' : '') +
        (canAssign() && jobArchived(j) ? '<button class="btn ghost" onclick="unarchiveJob(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Unarchive' : 'Desarchivar') + '</button>' : '') +
      '</div>' +
      '<div class="job-sec"><h3>' + esc(j.title || j.kind || 'Job') + (j.jobNumber ? ' <span class="muted">#' + esc(j.jobNumber) + '</span>' : '') + '</h3>' +
      '<p>' + esc(j.clientName || j.contactName || '') + '<br>' + esc(j.address || '') + '<br>' + phoneHtml +
      ' · <a class="job-maps" target="_blank" rel="noopener" href="' + mapsUrl(j) + '">Directions</a></p>' +
      '<p class="' + statusClass(j) + '">' + esc(statusWord(j)) + ' · ' + esc(durationLabel(j)) + '</p></div>' +
      '<div class="job-sec"><h3>Product / Service</h3><div id="jdLines">' + (canAssign() ? lineEditorHtml(lines) : lines.map(function (l) {
        return '<p><b>' + esc(l.name) + '</b> × ' + esc(l.qty) + (moneyOk ? ' · ' + usd(l.unitPrice) + ' = ' + usd(l.total) : '') +
          '<div class="muted" style="white-space:pre-wrap">' + esc(l.description || '') + '</div></p>';
      }).join('')) + '</div>' +
      (canAssign() ? '<button class="btn ghost" onclick="saveJobLines(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Save lines' : 'Guardar líneas') + '</button> <button type="button" class="btn ghost" onclick="reorderJobLines(\'' + j.id + '\')">Reorder</button>' : '') +
      (j.quoteId ? '<p class="muted">Quote #' + esc(j.quoteNumber || j.quoteId) + '</p>' : '<p class="muted">' + esc(loginLang() === 'en' ? 'No quote — prices typed by hand ($0 until you enter them).' : 'Sin presupuesto — precio a mano ($0 hasta que lo pongas).') + '</p>') +
      (moneyOk ? '<p><b>Total ' + usd(billed) + '</b></p>' : '') + '</div>' +
      (moneyOk ? '<div class="job-sec"><h3>Expenses</h3><p class="muted">Track all expenses for this job in one place</p>' + exps +
        (canAssign() && !jobArchived(j) ? '<button class="btn" onclick="openExpenseForm(\'' + j.id + '\')">+</button>' : '') +
        '<div class="margin-box"><div><span class="muted">' + esc(loginLang() === 'en' ? 'Invoiced' : 'Facturado') + '</span><b>' + usd(billed) +
        '</b></div><div><span class="muted">' + esc(loginLang() === 'en' ? 'Expenses' : 'Gastos') + '</span><b>' + usd(spent) +
        '</b></div><div><span class="muted">' + esc(loginLang() === 'en' ? 'Margin' : 'Margen') + '</span><b>' + usd(billed - spent) + '</b></div></div></div>' : '') +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Scheduled visits' : 'Visitas') + '</h3>' + vis +
      (canAssign() && !jobArchived(j) ? '<button class="btn ghost" onclick="openAddVisit(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? '+ Visit' : '+ Visita') + '</button>' : '') + '</div>' +
      '<div class="job-sec"><h3>Notes</h3>' + notes +
      '<textarea id="jdNote" rows="2"></textarea><button class="btn ghost" onclick="addJobNote(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Add note' : 'Agregar nota') + '</button></div>';
  };

  window.saveJobLines = async function (id, preset) {
    if (!canAssign()) return;
    var lines = preset || readLinesFromForm();
    try {
      await db.collection('jobs').doc(id).set({
        lines: lines,
        kind: (lines[0] && lines[0].name) || '',
        description: (lines[0] && lines[0].description) || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      openJobDetail(id);
    } catch (e) { alert(e.message || e); }
  };
  window.reorderJobLines = function (id) {
    var lines = readLinesFromForm();
    if (lines.length < 2) return;
    var first = lines.shift();
    lines.push(first);
    saveJobLines(id, lines);
  };
  window.addJobNote = async function (id) {
    var text = ($('jdNote') && $('jdNote').value || '').trim();
    if (!text) return;
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    var log = (j.notesLog || []).slice();
    log.push({ text: text, authorName: who(), authorUid: uid(), at: new Date().toISOString() });
    try {
      await db.collection('jobs').doc(id).set({ notesLog: log, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      openJobDetail(id);
    } catch (e) { alert(e.message || e); }
  };
  window.openExpenseForm = function (id) {
    if (!canSeeMoney()) return;
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box"><h3>Expense</h3>' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Vendor' : 'Proveedor') + '</label><input id="exV" type="text">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Items' : 'Ítems') + '</label><textarea id="exI" rows="2"></textarea>' +
      '<label class="muted">Subtotal</label><input id="exS" type="number" min="0" step="0.01">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Shipping' : 'Envío') + '</label><input id="exH" type="number" min="0" step="0.01">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Tax' : 'Impuesto') + '</label><input id="exX" type="number" min="0" step="0.01">' +
      '<label class="muted">Total</label><input id="exT" type="number" min="0" step="0.01">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Payment method' : 'Método') + '</label><input id="exM" type="text">' +
      '<label class="muted">PO / Ref</label><input id="exP" type="text">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Date' : 'Fecha') + '</label><input id="exD" type="date" value="' + ymd(new Date()) + '">' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Vendor receipt' : 'Recibo del proveedor') + '</label><input id="exRec" type="file" accept="image/*">' +
      '<div class="err" id="exErr"></div>' +
      '<button class="btn" onclick="saveExpense(\'' + id + '\')">' + esc(uiT('save')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
  };
  window.saveExpense = async function (id) {
    if (!canSeeMoney()) return;
    var sub = Number($('exS').value || 0);
    var ship = Number($('exH').value || 0);
    var tax = Number($('exX').value || 0);
    var tot = Number($('exT').value);
    if (!(tot >= 0)) tot = +(sub + ship + tax).toFixed(2);
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    var list = jobExpenses(j).slice();
    var recUrl = '';
    try {
      var rf = $('exRec') && $('exRec').files && $('exRec').files[0];
      if (rf && typeof uploadJobFile === 'function') recUrl = await uploadJobFile(id, 'expense', rf);
    } catch (e) { $('exErr').textContent = e.message || e; return; }
    list.push({
      vendor: ($('exV').value || '').trim(),
      items: ($('exI').value || '').trim(),
      subtotal: sub, shipping: ship, tax: tax, total: tot,
      method: ($('exM').value || '').trim(),
      po: ($('exP').value || '').trim(),
      date: $('exD').value || ymd(new Date()),
      source: 'office',
      receiptPhoto: recUrl,
      createdBy: uid()
    });
    try {
      await db.collection('jobs').doc(id).set({ expenses: list, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      $('modal').classList.add('hidden');
      alert(loginLang() === 'en' ? 'Expense created' : 'Gasto creado');
      openJobDetail(id);
    } catch (e) { $('exErr').textContent = e.message || e; }
  };
  window.openAddVisit = function (id) {
    if (!canAssign()) return;
    var topts = techs.map(function (t) { return '<option value="' + t.uid + '">' + esc(t.name) + '</option>'; }).join('');
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box"><h3>' + esc(loginLang() === 'en' ? 'Add visit' : 'Agregar visita') + '</h3>' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Date' : 'Fecha') + '</label><input id="avDate" type="date" value="' + ymd(selectedDay) + '">' +
      '<label class="muted">' + esc(uiT('start')) + '</label><select id="avStart">' + clockChoices('09:00') + '</select>' +
      '<label class="muted">' + esc(uiT('end')) + '</label><select id="avEnd">' + clockChoices('11:00') + '</select>' +
      '<label class="muted">' + esc(uiT('worker')) + '</label><select id="avT">' + topts + '</select>' +
      '<p class="muted">Arrival window: Arrive at start time</p>' +
      '<label class="muted">' + esc(uiT('instructions')) + '</label><textarea id="avInstr" rows="3"></textarea>' +
      '<button class="btn" onclick="saveAddVisit(\'' + id + '\')">' + esc(uiT('save')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
  };
  window.saveAddVisit = async function (id) {
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    var vs = jobVisits(j).slice();
    var day = $('avDate').value;
    var start = clockToDate(snapClock($('avStart').value), new Date(day + 'T12:00:00'));
    var end = clockToDate(snapClock($('avEnd').value), start);
    vs.push({
      id: 'v' + (vs.length + 1),
      scheduledDate: day,
      startClock: toClock(start),
      endClock: toClock(end),
      hour: start.getHours(), minute: start.getMinutes(),
      endHour: end.getHours(), endMinute: end.getMinutes(),
      assignedUid: $('avT').value,
      status: 'open',
      instructions: ($('avInstr').value || '').trim(),
      arrivalWindow: 'start',
      checklists: ['inspection', 'jobReport']
    });
    try {
      await db.collection('jobs').doc(id).set({
        visits: vs,
        status: 'open',
        visitStatus: 'open',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      $('modal').classList.add('hidden');
      openJobDetail(id);
    } catch (e) { alert(e.message || e); }
  };

  window.saveVisitOfficeHours = async function (jobId, visitId) {
    if (!canAssign()) return;
    var j = jobs.find(function (x) { return x.id === jobId; }) || {};
    var vs = jobVisits(j).map(function (v) {
      if (String(v.id || 'primary') !== String(visitId)) return v;
      var os = document.querySelector('[data-os="' + visitId + '"]');
      var oe = document.querySelector('[data-oe="' + visitId + '"]');
      return Object.assign({}, v, { officeStart: (os && os.value) || '', officeEnd: (oe && oe.value) || '' });
    });
    try {
      await db.collection('jobs').doc(jobId).set({ visits: vs, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      openJobDetail(jobId);
    } catch (e) { alert(e.message || e); }
  };
  window.reopenJob = async function (id) {
    if (!canAssign()) return;
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    try {
      await db.collection('jobs').doc(id).set({
        status: 'open',
        visitStatus: 'open',
        reopenedAt: firebase.firestore.FieldValue.serverTimestamp(),
        reopenedBy: uid(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      openJobDetail(id);
    } catch (e) { alert(e.message || e); }
  };
  window.openJobView = function (id) { return openJobDetail(id); };
})();
