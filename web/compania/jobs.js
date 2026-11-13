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
          _jobStatus: j.status || '',
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
    if (j.needsReturn === true) return loginLang() === 'en' ? 'Needs return visit' : 'Necesita volver';
    if (jobDone(j)) return loginLang() === 'en' ? 'Completed' : 'Completado';
    if (jobIsLate(j)) return 'Late';
    return loginLang() === 'en' ? 'Pending' : 'Pendiente';
  }
  function statusClass(j) {
    if (j.needsReturn === true) return 'st-late';
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
    document.body.classList.remove('view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived', 'view-home', 'view-search', 'sites-open', 'view-jobs', 'view-job', 'view-payments', 'view-clients', 'view-requests', 'view-quotes');
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

  function jobDay(j) {
    return firstVisitDate(j) || '';
  }
  function jobUnscheduled(j) {
    return !jobArchived(j) && !jobDay(j);
  }
  function jobSoon(j) {
    if (jobArchived(j) || jobDone(j) || jobUnscheduled(j)) return false;
    var today = ymd(new Date());
    var end = ymd(new Date(Date.now() + 30 * 86400000));
    var d = jobDay(j);
    return d >= today && d <= end;
  }
  function jobAction(j) {
    if (jobArchived(j) || jobDone(j)) return false;
    if (j.needsReturn === true) return true;
    if (!accountUidOf(j)) return true;
    if (j.lastReschedule && j.lastReschedule.seen !== true) return true;
    return false;
  }
  function jobNeedsInvoice(j) {
    if (j && j.isTask === true) return false; // tasks are never invoiced
    return !jobArchived(j) && jobDone(j) && !j.invoiceId;
  }
  window.jobBuckets = function () {
    var live = (jobs || []).filter(function (j) { return !jobArchived(j); });
    return {
      all: live,
      soon: live.filter(jobSoon),
      late: live.filter(jobIsLate),
      invoice: live.filter(jobNeedsInvoice),
      action: live.filter(jobAction),
      open: live.filter(jobUnscheduled)
    };
  };
  window.jobUi = window.jobUi || { q: '', bucket: 'all', type: '', client: '' };
  function buildingName(j) {
    var b = (buildings || []).find(function (x) { return x.id === j.buildingId; });
    return (b && b.name) || j.buildingName || '';
  }
  function clientLabel(j) {
    return j.clientName || j.contactName || buildingName(j) || '';
  }
  window.openJobs = function () {
    if (isWorker()) return;
    enterJobsView('view-jobs');
    if (typeof markNav === 'function') markNav('jobs');
    var pane = $('jobsPane');
    if (!pane) return;
    var en = loginLang() === 'en';
    var ui = window.jobUi;
    var buckets = window.jobBuckets();
    var query = String(ui.q || '').toLowerCase();
    var list = (buckets[ui.bucket] || buckets.all).filter(function (j) {
      if (ui.type && String(j.kind || j.title || '') !== ui.type) return false;
      if (ui.client && clientLabel(j) !== ui.client) return false;
      if (!query) return true;
      var blob = [j.jobNumber, j.title, j.kind, clientLabel(j), j.address, cardAddr(j), buildingName(j)].join(' ').toLowerCase();
      return blob.indexOf(query) >= 0;
    }).sort(function (a, b) {
      return String(jobDay(b)).localeCompare(String(jobDay(a)));
    });
    var money = canSeeMoney();
    var chip = function (key, label) {
      return '<button type="button" class="btn ' + (ui.bucket === key ? '' : 'ghost') + '" onclick="jobUi.bucket=\'' + key + '\';openJobs()">' +
        esc(label) + ' (' + (buckets[key] || []).length + ')</button>';
    };
    var types = {};
    var clients = {};
    buckets.all.forEach(function (j) {
      var t = j.kind || j.title || '';
      if (t) types[t] = 1;
      var c = clientLabel(j);
      if (c) clients[c] = 1;
    });
    var typeOpts = '<option value="">' + esc(en ? 'Job type' : 'Tipo de trabajo') + '</option>' +
      Object.keys(types).sort().map(function (t) {
        return '<option' + (ui.type === t ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
    var clientOpts = '<option value="">' + esc(en ? 'Client' : 'Cliente') + '</option>' +
      Object.keys(clients).sort().map(function (c) {
        return '<option' + (ui.client === c ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
    var rows = list.map(function (j) {
      var when = jobDay(j);
      var clock = (jobVisits(j)[0] && (jobVisits(j)[0].startClock || '')) || j.startClock || '';
      return '<tr onclick="openJobView(\'' + j.id + '\')">' +
        '<td>' + esc(clientLabel(j) || '—') + '</td>' +
        '<td>' + esc(j.jobNumber ? '#' + j.jobNumber : '—') + '</td>' +
        '<td>' + esc(buildingName(j) || '—') + '</td>' +
        '<td>' + esc(when ? (when + (clock ? ' ' + clock : '')) : (en ? 'Unscheduled' : 'Sin programar')) + '</td>' +
        '<td class="' + statusClass(j) + '">' + esc(statusWord(j)) + '</td>' +
        '<td>' + (money ? usd(jobLineTotal(j)) : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">' + esc(en ? 'No jobs' : 'Sin trabajos') + '</td></tr>';
    pane.innerHTML =
      '<div class="jobs-toolbar"><h2>' + esc(en ? 'Jobs' : 'Trabajos') + '</h2>' +
        (canAssign() ? '<button class="btn" onclick="openCreateJob()">' + esc(uiT('createJob')) + '</button>' : '') +
        '<button class="btn ghost" onclick="openArchived()">' + esc(en ? 'Archived' : 'Archivados') + '</button></div>' +
      '<div class="chip-row">' +
        chip('soon', en ? 'Ending within 30 days' : 'Por vencer en 30 días') +
        chip('late', en ? 'Late' : 'Atrasados') +
        (money ? chip('invoice', en ? 'Requires invoicing' : 'Requiere facturación') : '') +
        chip('action', en ? 'Action required' : 'Requiere acción') +
        chip('open', en ? 'Unscheduled' : 'Sin programar') +
        chip('all', en ? 'All' : 'Todos') +
      '</div>' +
      '<div class="jobs-toolbar">' +
        '<select onchange="jobUi.type=this.value;openJobs()">' + typeOpts + '</select>' +
        '<select onchange="jobUi.client=this.value;openJobs()">' + clientOpts + '</select>' +
        '<input id="jobSearch" type="search" placeholder="' + esc(en ? 'Search jobs…' : 'Buscar trabajos…') + '" value="' + esc(ui.q || '') + '" oninput="jobUi.q=this.value;openJobs()">' +
      '</div>' +
      '<table class="jobs-table"><thead><tr>' +
        '<th>' + esc(en ? 'Client' : 'Cliente') + '</th>' +
        '<th>' + esc(en ? 'Job #' : 'N.º') + '</th>' +
        '<th>' + esc(en ? 'Building' : 'Edificio') + '</th>' +
        '<th>' + esc(en ? 'Date and time' : 'Fecha y hora') + '</th>' +
        '<th>' + esc(en ? 'Status' : 'Estado') + '</th>' +
        (money ? '<th>Total</th>' : '<th></th>') +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
    var box = $('jobSearch');
    if (box && document.activeElement && document.activeElement.id === 'jobSearch') {
      var pos = ui.q.length;
      box.focus();
      try { box.setSelectionRange(pos, pos); } catch (_) {}
    }
  };

  window.openCreateJob = async function () {
    if (!canAssign()) return;
    await refreshClients();
    enterJobsView('view-job');
    var pane = $('jobPane');
    var bopts = '<option value="">' + esc(uiT('siteOrAddr')) + '</option>' +
      buildings.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    // A job can be created without a tech; "Asignar trabajo" picks it later.
    var topts = '<option value="">' + esc(loginLang() === 'en' ? '— Not assigned yet —' : '— Sin asignar todavía —') + '</option>' +
      techs.map(function (t) { return '<option value="' + t.uid + '">' + esc(t.name) + '</option>'; }).join('');
    pane.innerHTML =
      '<div class="job-actions"><button class="btn ghost" onclick="openJobs()">← ' + esc(loginLang() === 'en' ? 'Jobs' : 'Trabajos') + '</button></div>' +
      '<div class="job-sec"><h3>' + esc(uiT('createJob')) + '</h3>' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Title' : 'Título') + '</label><input id="njTitle" type="text">' +
      '</div>' +
      partiesFormHtml('nj', {}) +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Product / Service' : 'Producto / Servicio') + '</h3><p class="muted">' +
        esc(loginLang() === 'en' ? 'Lines inherit from an approved quote. Without a quote they start at $0 — type the price.' : 'Las líneas se heredan de un presupuesto aprobado. Sin quote salen en $0: pon el precio a mano.') +
        '</p><div id="njLines">' + lineEditorHtml([{ name: '', description: '', qty: 1, unitPrice: 0, total: 0 }]) + '</div></div>' +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'First visit' : 'Primera visita') + '</h3>' +
      '<label class="muted">' + esc(loginLang() === 'en' ? 'Date' : 'Fecha') + '</label><input id="njDate" type="date" value="' + ymd(selectedDay) + '">' +
      '<label class="muted">' + esc(uiT('start')) + '</label><input id="njStart" type="time" step="60" value="' + snapClock('09:00') + '">' +
      '<label class="muted">' + esc(uiT('end')) + '</label><input id="njEnd" type="time" step="60" value="' + snapClock('11:00') + '">' +
      '<label class="muted">' + esc(uiT('worker')) + '</label><select id="njT">' + topts + '</select>' +
      '<p class="muted">' + esc(loginLang() === 'en' ? 'Arrival window: arrive at start time' : 'Llegada: a la hora de inicio') + '</p>' +
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
    var parties = readPartiesForm('nj', b);
    if (parties.error) { err.textContent = parties.error; return; }
    var payload = Object.assign({
      companyId: cid(), companyName: companyName,
      buildingId: bid || '',
      title: title,
      address: ($('njAddr').value || '').trim() || (b && (b.address || b.name)) || title,
      kind: (lines[0] && lines[0].name) || title,
      unit: parties.data.unit, payerSet: parties.data.payerSet, billClientId: parties.data.billClientId,
      clientName: parties.data.clientName, clientEmail: parties.data.clientEmail, clientAddress: parties.data.clientAddress,
      tenantName: parties.data.tenantName, tenantPhone: parties.data.tenantPhone, tenantEmail: parties.data.tenantEmail,
      contactName: parties.data.tenantName, contactPhone: parties.data.tenantPhone, contactEmail: parties.data.tenantEmail,
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
    }, uidW ? assignmentPatch(uidW) : { assignedUid: '', workerId: '', assignedName: '', unassigned: true });
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

  /* ===== Tasks (like Jobber): something quick to do — pick up a part, a
     run to the office, a call. Title, when, who, optional place/client.
     No forms, no invoice; the worker just taps "Completar tarea". ===== */
  window.openCreateTask = async function () {
    if (!canAssign()) return;
    if (typeof closeMore === 'function') closeMore();
    await refreshClients();
    var en = loginLang() === 'en';
    var L = function (es, e) { return en ? e : es; };
    var topts = '<option value="">' + esc(L('— Sin asignar todavía —', '— Not assigned yet —')) + '</option>' +
      techs.map(function (t) { return '<option value="' + t.uid + '">' + esc(t.name) + '</option>'; }).join('');
    var copts = '<option value="">' + esc(L('— Ninguno —', '— None —')) + '</option>' +
      CLIENTS.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name || c.email || c.id) + '</option>'; }).join('');
    var bopts = '<option value="">' + esc(L('— Ninguno —', '— None —')) + '</option>' +
      buildings.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    var day = ymd(typeof selectedDay !== 'undefined' ? selectedDay : new Date());
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:520px;max-width:96vw;max-height:90vh;overflow:auto">' +
      '<h3>📋 ' + esc(L('Nueva tarea', 'New task')) + '</h3>' +
      '<p class="muted">' + esc(L('Algo rápido para hacer: recoger material, una vuelta, una llamada. Sin formularios ni factura.', 'Something quick to do: pick up material, a run, a call. No forms, no invoice.')) + '</p>' +
      '<label class="muted">' + esc(L('¿Qué hay que hacer? *', 'What needs to be done? *')) + '</label><input id="tkTitle" type="text" placeholder="' + esc(L('Ej. Recoger disposal en oficina downtown', 'e.g. Pick up disposal at downtown office')) + '">' +
      '<label class="muted">' + esc(L('Fecha', 'Date')) + '</label><input id="tkDay" type="date" value="' + esc(day) + '">' +
      '<label class="muted">' + esc(uiT('start')) + '</label><input id="tkStart" type="time" step="60" value="' + snapClock('09:00') + '">' +
      '<label class="muted">' + esc(uiT('end')) + '</label><input id="tkEnd" type="time" step="60" value="' + snapClock('09:30') + '">' +
      '<label class="muted">' + esc(uiT('worker')) + '</label><select id="tkWho">' + topts + '</select>' +
      '<label class="muted">' + esc(L('Edificio (opcional)', 'Building (optional)')) + '</label><select id="tkB">' + bopts + '</select>' +
      '<label class="muted">' + esc(L('Dirección (opcional)', 'Address (optional)')) + '</label><input id="tkAddr" type="text">' +
      '<label class="muted">' + esc(L('Cliente (opcional)', 'Client (optional)')) + '</label><select id="tkClient">' + copts + '</select>' +
      '<label class="muted">' + esc(uiT('instructions')) + '</label><textarea id="tkInstr" rows="3"></textarea>' +
      '<div class="err" id="tkErr"></div>' +
      '<button class="btn" id="tkGo" onclick="saveCreateTask()">' + esc(L('Crear tarea', 'Create task')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
    setTimeout(function () { if ($('tkTitle')) $('tkTitle').focus(); }, 50);
  };
  window.saveCreateTask = async function () {
    if (!canAssign()) return;
    var en = loginLang() === 'en';
    var err = $('tkErr');
    var title = ($('tkTitle').value || '').trim();
    if (!title) { err.textContent = en ? 'Write what needs to be done.' : 'Escribe qué hay que hacer.'; return; }
    var day = $('tkDay').value;
    var base = new Date(day + 'T12:00:00');
    var start = clockToDate(snapClock($('tkStart').value), base);
    var end = clockToDate(snapClock($('tkEnd').value), base);
    if (!day || !start || !end || !(end > start)) { err.textContent = en ? 'Check the date and times (end after start).' : 'Revisa la fecha y las horas (la de fin va después).'; return; }
    var who = $('tkWho').value;
    var b = buildings.find(function (x) { return x.id === $('tkB').value; });
    var cl = CLIENTS.find(function (x) { return x.id === $('tkClient').value; });
    var addr = ($('tkAddr').value || '').trim() || (b && (b.address || b.name)) || '';
    var visit = {
      id: 'v1', scheduledDate: day, startClock: toClock(start), endClock: toClock(end),
      hour: start.getHours(), minute: start.getMinutes(), endHour: end.getHours(), endMinute: end.getMinutes(),
      assignedUid: who, status: 'open', instructions: ($('tkInstr').value || '').trim(),
      arrivalWindow: 'start', checklists: [], title: title
    };
    var payload = Object.assign({
      isTask: true,
      companyId: cid(), companyName: companyName,
      buildingId: b ? b.id : '',
      title: title, kind: '📋 ' + title, address: addr,
      clientName: cl ? (cl.name || '') : '', clientEmail: cl ? (cl.email || '') : '', billClientId: cl ? cl.id : '', payerSet: !!cl,
      instructions: visit.instructions, description: '',
      lines: [], visits: [visit], expenses: [], notesLog: [],
      arrivalWindow: 'start', companyType: companyType, status: 'open',
      scheduledDate: day, startClock: visit.startClock, endClock: visit.endClock,
      hour: visit.hour, minute: visit.minute, endHour: visit.endHour, endMinute: visit.endMinute,
      startTime: fmt(start), time: fmt(start), endTime: fmt(end),
      appointment_start: firebase.firestore.Timestamp.fromDate(start),
      appointment_end: firebase.firestore.Timestamp.fromDate(end),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid()
    }, who ? assignmentPatch(who) : { assignedUid: '', workerId: '', assignedName: '', unassigned: true });
    $('tkGo').disabled = true;
    try {
      await db.collection('jobs').add(payload);
      $('modal').classList.add('hidden');
      if (typeof selectedDay !== 'undefined') { selectedDay = new Date(day + 'T12:00:00'); }
      if (typeof loadBoard === 'function') loadBoard();
    } catch (e) { err.textContent = jobSaveError ? jobSaveError(e) : (e.message || e); $('tkGo').disabled = false; }
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
        '</b><div class="muted">' + esc(v.instructions || '') + '<br>' + esc(loginLang() === 'en' ? 'Arrival window: arrive at start time' : 'Llegada: a la hora de inicio') + '<br>' + esc(loginLang() === 'en' ? 'Checklists: ' : 'Formularios: ') + '' +
        esc((v.checklists || []).join(', ') || 'Inspection Report, Job Report') + '</div>' +
        '<label class="muted">' + esc(loginLang() === 'en' ? 'Office hours (typed)' : 'Horas oficina (a mano)') + '</label>' +
        '<input type="time" data-os="' + vid + '" value="' + esc(v.officeStart || '') + '">' +
        '<input type="time" data-oe="' + vid + '" value="' + esc(v.officeEnd || '') + '">' +
        (canAssign() ? '<button type="button" class="btn ghost" onclick="saveVisitOfficeHours(\'' + j.id + '\',\'' + vid + '\')">' + esc(uiT('save')) + '</button>' : '') +
        (canAssign() && !jobArchived(j) ? '<button type="button" class="btn" style="margin-top:6px" onclick="openVisitDate(\'' + j.id + '\',\'' + vid + '\')">📅 ' + esc(loginLang() === 'en' ? 'Change date / time' : 'Cambiar fecha y hora') + '</button>' : '') +
        '</div>' +
        '<div>' + esc((tech && tech.name) || '') + '<br><b class="' + (done ? 'st-done' : 'st-pend') + '">' +
        (done ? '✓ ' + (loginLang() === 'en' ? 'Completed' : 'Completada') : statusWord({ status: v.status, scheduledDate: v.scheduledDate })) + '</b></div></div>';
    }).join('');
    pane.innerHTML =
      '<div class="job-actions">' +
        '<button class="btn ghost" onclick="openJobs()">← ' + esc(loginLang() === 'en' ? 'Jobs' : 'Trabajos') + '</button>' +
        (moneyOk && !jobArchived(j) && !j.invoiceId ? '<button class="btn" onclick="openInvoiceEditor(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Create Invoice' : 'Crear factura') + '</button>' : '') +
        (moneyOk && j.invoiceId ? '<button class="btn" onclick="openInvoice(\'' + esc(j.invoiceId) + '\')">' + esc(uiT('money')) + '</button>' : '') +
        (canAssign() && jobDone(j) && !jobArchived(j) ? '<button class="btn ghost" onclick="reopenJob(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Reopen job' : 'Reabrir trabajo') + '</button>' : '') +
        (canAssign() && !jobArchived(j) ? '<button class="btn ghost" onclick="openVisitDate(\'' + j.id + '\')">📅 ' + esc(loginLang() === 'en' ? 'Change date' : 'Cambiar fecha') + '</button>' : '') +
        (canAssign() && !jobDone(j) && !jobArchived(j) ? '<button class="btn" onclick="closeJob(\'' + j.id + '\')">✓ ' + esc(loginLang() === 'en' ? 'Complete job' : 'Completar trabajo') + '</button>' : '') +
        (canAssign() && !jobArchived(j) ? '<button class="btn ghost" onclick="askArchiveJob(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Archive' : 'Archivar') + '</button>' : '') +
        (canAssign() && jobArchived(j) ? '<button class="btn ghost" onclick="unarchiveJob(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Unarchive' : 'Desarchivar') + '</button>' : '') +
      '</div>' +
      '<div class="job-sec"><h3>' + esc(j.title || j.kind || 'Job') + (j.jobNumber ? ' <span class="muted">#' + esc(j.jobNumber) + '</span>' : '') + '</h3>' +
      partiesViewHtml(j, phoneHtml) +
      '<p><a class="job-maps" target="_blank" rel="noopener" href="' + mapsUrl(j) + '">' + esc(loginLang() === 'en' ? 'Directions' : 'Cómo llegar') + '</a>' +
      (canAssign() && !jobArchived(j) ? ' · <a href="#" onclick="openPartiesEditor(\'' + j.id + '\');return false">' + esc(loginLang() === 'en' ? 'Edit client / tenant' : 'Editar cliente / inquilino') + '</a>' : '') + '</p>' +
      '<p class="' + statusClass(j) + '">' + esc(statusWord(j)) + ' · ' + esc(durationLabel(j)) + '</p>' +
      jobTechRowHtml(j) + '</div>' +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Product / Service' : 'Producto / Servicio') + '</h3><div id="jdLines">' + (canAssign() ? lineEditorHtml(lines) : lines.map(function (l) {
        return '<p><b>' + esc(l.name) + '</b> × ' + esc(l.qty) + (moneyOk ? ' · ' + usd(l.unitPrice) + ' = ' + usd(l.total) : '') +
          '<div class="muted" style="white-space:pre-wrap">' + esc(l.description || '') + '</div></p>';
      }).join('')) + '</div>' +
      (canAssign() ? '<button class="btn ghost" onclick="saveJobLines(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Save lines' : 'Guardar líneas') + '</button> <button type="button" class="btn ghost" onclick="reorderJobLines(\'' + j.id + '\')">Reorder</button>' : '') +
      (j.quoteId ? '<p class="muted">' + esc(loginLang() === 'en' ? 'Quote #' : 'Cotización #') + esc(j.quoteNumber || j.quoteId) + '</p>' : '<p class="muted">' + esc(loginLang() === 'en' ? 'No quote — prices typed by hand ($0 until you enter them).' : 'Sin presupuesto — precio a mano ($0 hasta que lo pongas).') + '</p>') +
      (moneyOk ? '<p><b>Total ' + usd(billed) + '</b></p>' : '') + '</div>' +
      (moneyOk ? '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Expenses' : 'Gastos') + '</h3><p class="muted">' + esc(loginLang() === 'en' ? 'Track all expenses for this job in one place' : 'Todos los gastos de este trabajo en un solo lugar') + '</p>' + exps +
        (canAssign() && !jobArchived(j) ? '<button class="btn" onclick="openExpenseForm(\'' + j.id + '\')">+</button>' : '') +
        '<div class="margin-box"><div><span class="muted">' + esc(loginLang() === 'en' ? 'Invoiced' : 'Facturado') + '</span><b>' + usd(billed) +
        '</b></div><div><span class="muted">' + esc(loginLang() === 'en' ? 'Expenses' : 'Gastos') + '</span><b>' + usd(spent) +
        '</b></div><div><span class="muted">' + esc(loginLang() === 'en' ? 'Margin' : 'Margen') + '</span><b>' + usd(billed - spent) + '</b></div></div></div>' : '') +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Scheduled visits' : 'Visitas') + '</h3>' + vis +
      (canAssign() && !jobArchived(j) ? '<button class="btn ghost" onclick="openAddVisit(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? '+ Visit' : '+ Visita') + '</button>' : '') + '</div>' +
      (typeof tradeStepsOfficeHtml === 'function' ? tradeStepsOfficeHtml(j).replace('<div class="card">', '<div class="job-sec">') : '') +
      '<div class="job-sec"><h3>' + esc(loginLang() === 'en' ? 'Notes' : 'Notas') + '</h3>' + notes +
      '<textarea id="jdNote" rows="2"></textarea><button class="btn ghost" onclick="addJobNote(\'' + j.id + '\')">' + esc(loginLang() === 'en' ? 'Add note' : 'Agregar nota') + '</button></div>';
  };

  /* ===== Who pays vs. who is at the place =====
     Cliente que paga = the company billed (e.g. the property manager).
     Inquilino = the person living there; the worker calls them to get in. */
  var CLIENTS = [];
  async function refreshClients() {
    try { CLIENTS = typeof loadClientsList === 'function' ? await loadClientsList() : []; } catch (_) { CLIENTS = []; }
    return CLIENTS;
  }
  function payerForBuilding(b) {
    if (!b) return null;
    var c = CLIENTS.find(function (x) { return (x.buildingIds || []).indexOf(b.id) >= 0; });
    if (c) return { id: c.id, name: c.name || '', email: c.email || '', address: c.address || '' };
    if (b.clientName || b.clientEmail) return { id: '', name: b.clientName || '', email: b.clientEmail || '', address: b.clientAddress || '' };
    return null;
  }
  function partiesFormHtml(p, j) {
    var en = loginLang() === 'en';
    var L = function (es, e) { return en ? e : es; };
    var cur = j.billClientId || '';
    var opts = '<option value="">' + esc(L('— Elige quién paga —', '— Pick who pays —')) + '</option>' +
      CLIENTS.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === cur ? ' selected' : '') + '>' + esc(c.name || c.email || c.id) + '</option>'; }).join('') +
      '<option value="__new"' + (!cur && j.payerSet ? ' selected' : '') + '>' + esc(L('+ Otro (escribir)', '+ Other (type it)')) + '</option>';
    var other = !cur && j.payerSet;
    return '<div class="job-sec"><h3>💵 ' + esc(L('Cliente que paga', 'Client who pays')) + '</h3>' +
      '<p class="muted">' + esc(L('La compañía o persona a la que le cobras. A ella va la factura.', 'The company or person you charge. The invoice goes to them.')) + '</p>' +
      '<select id="' + p + 'Payer" onchange="document.getElementById(\'' + p + 'PayerNew\').classList.toggle(\'hidden\', this.value!==\'__new\')">' + opts + '</select>' +
      '<div id="' + p + 'PayerNew" class="' + (other ? '' : 'hidden') + '">' +
        '<label class="muted">' + esc(L('Nombre de quien paga', 'Name of who pays')) + '</label><input id="' + p + 'PayName" type="text" value="' + esc(other ? j.clientName : '') + '">' +
        '<label class="muted">' + esc(L('Correo para la factura', 'Invoice email')) + '</label><input id="' + p + 'PayMail" type="email" value="' + esc(other ? j.clientEmail : '') + '">' +
      '</div>' +
      '<p class="muted" style="margin-top:6px">' + esc(L('Si eliges un edificio que ya tiene cliente, se usa ese.', 'If you pick a building that already has a client, that one is used.')) + '</p></div>' +
      '<div class="job-sec"><h3>🏠 ' + esc(L('Lugar e inquilino', 'Place and tenant')) + '</h3>' +
      (p === 'nj' ? '<label class="muted">' + esc(L('Edificio', 'Building')) + '</label><select id="njB">' +
        '<option value="">' + esc(uiT('siteOrAddr')) + '</option>' + buildings.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('') + '</select>' +
        '<label class="muted">' + esc(uiT('address')) + '</label><input id="njAddr" type="text">' : '') +
      '<label class="muted">' + esc(L('Unidad / apartamento', 'Unit / apartment')) + '</label><input id="' + p + 'Unit" type="text" value="' + esc(j.unit || '') + '">' +
      '<label class="muted">' + esc(L('Inquilino / contacto en el lugar', 'Tenant / on-site contact')) + '</label><input id="' + p + 'Ten" type="text" value="' + esc(j.tenantName || (j.payerSet ? j.contactName : '') || '') + '">' +
      '<label class="muted">' + esc(L('Teléfono del inquilino', 'Tenant phone')) + '</label><input id="' + p + 'TenPh" type="tel" value="' + esc(j.tenantPhone || (j.payerSet ? j.contactPhone : '') || '') + '">' +
      '<label class="muted">' + esc(L('Correo del inquilino (opcional)', 'Tenant email (optional)')) + '</label><input id="' + p + 'TenMail" type="email" value="' + esc(j.tenantEmail || '') + '">' +
      '<p class="muted" style="margin-top:6px">' + esc(L('El trabajador ve al inquilino para llamarlo y entrar. No recibe la factura.', 'The worker sees the tenant to call and get in. They do not get the invoice.')) + '</p></div>';
  }
  function readPartiesForm(p, b) {
    var en = loginLang() === 'en';
    var v = function (id) { return (($(p + id) && $(p + id).value) || '').trim(); };
    var sel = v('Payer');
    var payer = null, billClientId = '';
    if (sel && sel !== '__new') {
      var c = CLIENTS.find(function (x) { return x.id === sel; });
      if (c) { payer = { name: c.name || '', email: c.email || '', address: c.address || '' }; billClientId = c.id; }
    } else if (sel === '__new') {
      payer = { name: v('PayName'), email: v('PayMail').toLowerCase(), address: '' };
      if (!payer.name) return { error: en ? 'Type the name of who pays.' : 'Escribe el nombre de quien paga.' };
      if (payer.email && !/.+@.+\..+/.test(payer.email)) return { error: en ? 'Check the invoice email.' : 'Revisa el correo para la factura.' };
    } else if (b) {
      var fromB = payerForBuilding(b);
      if (fromB) { payer = fromB; billClientId = fromB.id || ''; }
    }
    return { data: {
      payerSet: !!payer, billClientId: billClientId,
      clientName: payer ? payer.name : '', clientEmail: payer ? payer.email : '', clientAddress: payer ? payer.address : '',
      unit: v('Unit'), tenantName: v('Ten'), tenantPhone: v('TenPh'), tenantEmail: v('TenMail').toLowerCase()
    } };
  }
  function jobTechUid(j) {
    return (typeof accountUidOf === 'function' ? accountUidOf(j) : '') || j.assignedUid || j.workerId || '';
  }
  function jobTechRowHtml(j) {
    var en = loginLang() === 'en';
    var cur = jobTechUid(j);
    var t = techs.find(function (x) { return x.uid === cur; });
    var name = (t && t.name) || j.assignedName || (en ? 'Nobody yet' : 'Sin asignar');
    var canMove = canAssign() && !jobArchived(j) && !jobDone(j);
    return '<div class="job-tech"><span class="muted">👷 ' + esc(en ? 'Technician' : 'Técnico') + '</span><b>' + esc(name) + '</b>' +
      (canMove ? '<button type="button" class="btn job-move-btn" onclick="openMoveJob(\'' + j.id + '\')">⇄ ' +
        esc(en ? 'Move to another technician' : 'Mover a otro técnico') + '</button>' : '') + '</div>';
  }
  // Move the job: the window says what stays and what changes, then every field that names the tech changes.
  window.openMoveJob = async function (id) {
    if (!canAssign()) return;
    var en = loginLang() === 'en';
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    try { var d = await db.collection('jobs').doc(id).get(); if (d.exists) j = Object.assign({ id: d.id }, d.data()); } catch (_) {}
    var cur = jobTechUid(j);
    var curName = ((techs.find(function (x) { return x.uid === cur; }) || {}).name) || j.assignedName || (en ? 'nobody' : 'nadie');
    var others = techs.filter(function (t) { return t.uid && t.uid !== cur; });
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box move-box"><h3>⇄ ' + esc(en ? 'Move to another technician' : 'Mover a otro técnico') + '</h3>' +
      '<p class="muted">' + esc(en ? 'Now: ' : 'Ahora: ') + '<b>' + esc(curName) + '</b></p>' +
      (others.length
        ? '<label class="muted" for="mvTo">' + esc(en ? 'Move it to' : 'Pasarlo a') + '</label><select id="mvTo"><option value="">' + esc(en ? 'Pick a technician…' : 'Escoge un técnico…') + '</option>' +
          others.map(function (t) { return '<option value="' + esc(t.uid) + '">' + esc(t.name || t.email || t.uid) + '</option>'; }).join('') + '</select>'
        : '<p>' + esc(en ? 'There is no other technician in your company yet.' : 'Todavía no hay otro técnico en tu compañía.') + '</p>') +
      '<div class="move-keep">✓ ' + esc(en ? 'Photos, notes and history stay with the job.' : 'Fotos, notas e historial se quedan en el trabajo.') + '<br>✓ ' +
        esc(en ? 'Same date and time. Only the technician changes.' : 'Misma fecha y hora. Solo cambia el técnico.') + '</div>' +
      '<div class="err" id="mvErr"></div>' +
      (others.length ? '<button class="btn" id="mvGo" onclick="saveMoveJob(\'' + id + '\')">' + esc(en ? 'Move job' : 'Mover trabajo') + '</button>' : '') +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
  };
  window.saveMoveJob = async function (id) {
    var en = loginLang() === 'en';
    var to = ($('mvTo') && $('mvTo').value) || '';
    var err = $('mvErr');
    if (!to) { err.textContent = en ? 'Pick who gets it.' : 'Escoge a quién se lo pasas.'; return; }
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    try { var d = await db.collection('jobs').doc(id).get(); if (d.exists) j = Object.assign({ id: d.id }, d.data()); } catch (_) {}
    var from = jobTechUid(j);
    var u = techs.find(function (x) { return x.uid === to; }) || {};
    var visits = (Array.isArray(j.visits) ? j.visits : []).map(function (v) {
      var x = Object.assign({}, v);
      var s = String(x.status || '').toLowerCase();
      var closed = ['completed', 'closed', 'done'].indexOf(s) >= 0;
      if (!closed && (!x.assignedUid || x.assignedUid === from)) x.assignedUid = to;
      return x;
    });
    var patch = Object.assign({}, assignmentPatch(to), {
      unassigned: false,
      assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reassignLog: firebase.firestore.FieldValue.arrayUnion({ fromUid: from, fromName: j.assignedName || '', toUid: to, toName: u.name || '', byName: who(), at: new Date().toISOString() }),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (visits.length) patch.visits = visits;
    if (j.lv && ['enroute', 'arrived', 'started'].indexOf(j.lv.stage) >= 0) patch['lv.stage'] = 'dispatched';
    $('mvGo').disabled = true;
    try {
      await db.collection('jobs').doc(id).update(patch);
      $('modal').classList.add('hidden');
      openJobDetail(id);
    } catch (e) { err.textContent = e.message || e; $('mvGo').disabled = false; }
  };
  function partiesViewHtml(j, phoneHtml) {
    var en = loginLang() === 'en';
    var c = typeof invoiceClientOf === 'function' ? invoiceClientOf(j) : { name: j.clientName || '' };
    var ten = j.tenantName || (j.payerSet ? j.contactName : '');
    var tenPh = j.tenantPhone || j.contactPhone || '';
    var tel = tenPh ? '<a class="phone" href="tel:' + esc(tenPh.replace(/[^\d+]/g, '')) + '">' + esc(tenPh) + '</a>' : (phoneHtml || '');
    return '<div class="party-grid">' +
      '<div><span class="muted">💵 ' + esc(en ? 'Client who pays' : 'Cliente que paga') + '</span><b>' + esc(c.name || (en ? 'Not set' : 'Sin poner')) + '</b>' +
        (c.email ? '<span class="muted">' + esc(c.email) + '</span>' : '') + '</div>' +
      '<div><span class="muted">🏠 ' + esc(en ? 'Place / tenant' : 'Lugar / inquilino') + '</span><b>' + esc((j.unit ? (en ? 'Unit ' : 'Unidad ') + j.unit + ' · ' : '') + (j.address || '')) + '</b>' +
        (ten || tel ? '<span>' + esc(ten || '') + (ten && tel ? ' · ' : '') + tel + '</span>' : (!j.payerSet && j.contactName ? '<span>' + esc(j.contactName) + (tel ? ' · ' + tel : '') + '</span>' : '')) + '</div>' +
      '</div>';
  }
  window.openPartiesEditor = async function (id) {
    if (!canAssign()) return;
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    try { var d = await db.collection('jobs').doc(id).get(); if (d.exists) j = Object.assign({ id: d.id }, d.data()); } catch (_) {}
    await refreshClients();
    var en = loginLang() === 'en';
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box" style="width:520px;max-width:96vw;max-height:90vh;overflow:auto">' +
      partiesFormHtml('pe', j) + '<div class="err" id="peErr"></div>' +
      '<button class="btn" onclick="savePartiesEditor(\'' + id + '\')">' + esc(uiT('save')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('close')) + '</button></div>';
  };
  window.savePartiesEditor = async function (id) {
    var j = jobs.find(function (x) { return x.id === id; }) || {};
    var b = buildings.find(function (x) { return x.id === j.buildingId; });
    var r = readPartiesForm('pe', b);
    if (r.error) { $('peErr').textContent = r.error; return; }
    var d = r.data;
    var patch = {
      payerSet: d.payerSet, billClientId: d.billClientId, unit: d.unit,
      tenantName: d.tenantName, tenantPhone: d.tenantPhone, tenantEmail: d.tenantEmail,
      contactName: d.tenantName, contactPhone: d.tenantPhone, contactEmail: d.tenantEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (d.payerSet) { patch.clientName = d.clientName; patch.clientEmail = d.clientEmail; patch.clientAddress = d.clientAddress; }
    try {
      await db.collection('jobs').doc(id).set(patch, { merge: true });
      Object.assign(j, patch);
      $('modal').classList.add('hidden');
      openJobDetail(id);
    } catch (e) { $('peErr').textContent = e.message || e; }
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
    $('modal').innerHTML = '<div class="box"><h3>' + esc(loginLang() === 'en' ? 'Expense' : 'Gasto') + '</h3>' +
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
      '<label class="muted">' + esc(uiT('start')) + '</label><input id="avStart" type="time" step="60" value="' + snapClock('09:00') + '">' +
      '<label class="muted">' + esc(uiT('end')) + '</label><input id="avEnd" type="time" step="60" value="' + snapClock('11:00') + '">' +
      '<label class="muted">' + esc(uiT('worker')) + '</label><select id="avT">' + topts + '</select>' +
      '<p class="muted">' + esc(loginLang() === 'en' ? 'Arrival window: arrive at start time' : 'Llegada: a la hora de inicio') + '</p>' +
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
  function jobSaveError(e) {
    var en = loginLang() === 'en';
    if (e && e.code === 'permission-denied') return en ? 'Your account does not have permission to change this job. Check your role in Team (owner, admin or manager).' : 'Tu cuenta no tiene permiso para cambiar este trabajo. Revisa tu rol en Equipo (dueño, admin o manager).';
    return (en ? 'Could not save: ' : 'No se pudo guardar: ') + ((e && e.message) || e);
  }
  // The job's saved visits list (null when the job has none of its own).
  async function savedVisits(id) {
    try {
      var d = await db.collection('jobs').doc(id).get();
      var v = d.exists && d.data().visits;
      return Array.isArray(v) && v.length ? v : null;
    } catch (_) { return null; }
  }
  // In-page confirm box. The browser's native confirm() can be silently blocked
  // on desktop (e.g. "prevent this page from creating more dialogs" or an embedded
  // browser), which made "Completar trabajo" do nothing. This one always shows.
  function wkConfirm(msg, okLabel, cancelLabel) {
    return new Promise(function (resolve) {
      var old = document.getElementById('wkConfirm'); if (old) old.remove();
      var bg = document.createElement('div');
      bg.id = 'wkConfirm';
      bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true');
      bg.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.5);display:flex;align-items:center;justify-content:center;padding:20px';
      bg.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:400px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-size:16px;color:#111827">' +
        '<p style="margin:0 0 18px;line-height:1.45">' + esc(msg) + '</p>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
          '<button type="button" class="btn ghost" data-a="no">' + esc(cancelLabel) + '</button>' +
          '<button type="button" class="btn" data-a="yes">' + esc(okLabel) + '</button>' +
        '</div></div>';
      function done(v) { document.removeEventListener('keydown', key, true); bg.remove(); resolve(v); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); done(false); } }
      bg.addEventListener('click', function (e) {
        if (e.target === bg) return done(false);
        var a = e.target.closest && e.target.closest('[data-a]');
        if (a) done(a.getAttribute('data-a') === 'yes');
      });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(bg);
      var y = bg.querySelector('[data-a="yes"]'); if (y) y.focus();
    });
  }
  window.wkConfirm = wkConfirm;
  // Owner/office closes the whole job (same fields as the app's "Cerrar trabajo").
  window.closeJob = async function (id) {
    if (!canAssign()) { alert(loginLang() === 'en' ? 'Your account cannot close jobs. Check your role in Team (owner, admin or manager).' : 'Tu cuenta no puede cerrar trabajos. Revisa tu rol en Equipo (dueño, admin o manager).'); return; }
    var en = loginLang() === 'en';
    if (!(await wkConfirm(en ? 'Mark this job as completed now? You can reopen it anytime.' : '¿Marcar este trabajo como completado ahora? Lo puedes reabrir cuando quieras.', en ? 'Yes, complete' : 'Sí, completar', en ? 'Cancel' : 'Cancelar'))) return;
    try {
      var patch = {
        status: 'completed',
        visitStatus: 'completed',
        needsReturn: false,
        closedByOffice: true,
        closedAt: firebase.firestore.FieldValue.serverTimestamp(),
        closedBy: uid(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      // Every visit ends too, so the calendar does not keep showing "Pendiente".
      var vs = await savedVisits(id);
      if (vs) patch.visits = vs.map(function (v) { return Object.assign({}, v, { status: 'completed' }); });
      await db.collection('jobs').doc(id).set(patch, { merge: true });
      // Closed right now (no waiting for the end time): update the local copy so
      // the schedule and lists show it completed at once.
      var lj = (jobs || []).find(function (x) { return x.id === id; });
      if (lj) Object.assign(lj, { status: 'completed', visitStatus: 'completed', needsReturn: false, visits: patch.visits || lj.visits });
      if (typeof renderSchedule === 'function') renderSchedule();
      if (!(window.jvAfterJobChange && jvAfterJobChange(id))) openJobDetail(id);
    } catch (e) { alert(jobSaveError(e)); }
  };
  /* ===== Change the date / time of a visit (easy fix for a wrong date) ===== */
  window.openVisitDate = async function (id, vid) {
    if (!canAssign()) return;
    var en = loginLang() === 'en';
    var j = (jobs || []).find(function (x) { return x.id === id; }) || {};
    try { var d = await db.collection('jobs').doc(id).get(); if (d.exists) j = Object.assign({ id: d.id }, d.data()); } catch (_) {}
    var vs = jobVisits(j);
    var i = Math.max(0, vs.findIndex(function (v) { return (v.id || 'primary') === (vid || (vs[0] && vs[0].id) || 'primary'); }));
    var v = vs[i] || {};
    var day = v.scheduledDate || j.scheduledDate || ymd(new Date());
    var sc = snapClock(v.startClock || j.startClock || '09:00'), ec = snapClock(v.endClock || j.endClock || '11:00');
    var who = v.assignedUid || assignedOf(j) || '';
    var topts = '<option value="">' + esc(en ? '— Not assigned —' : '— Sin asignar —') + '</option>' +
      techs.map(function (t) { return '<option value="' + t.uid + '"' + (t.uid === who ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('');
    $('modal').classList.remove('hidden');
    $('modal').innerHTML = '<div class="box">' +
      '<h3>📅 ' + esc(en ? 'Change date and time' : 'Cambiar fecha y hora') + '</h3>' +
      '<p class="muted">' + esc((j.title || j.kind || '') + (vs.length > 1 ? ' · ' + (en ? 'visit ' : 'visita ') + (i + 1) + '/' + vs.length : '')) + '</p>' +
      '<label class="muted">' + esc(en ? 'Date' : 'Fecha') + '</label><input id="vdDay" type="date" value="' + esc(day) + '">' +
      '<label class="muted">' + esc(uiT('start')) + '</label><input id="vdStart" type="time" step="60" value="' + snapClock(sc) + '">' +
      '<label class="muted">' + esc(uiT('end')) + '</label><input id="vdEnd" type="time" step="60" value="' + snapClock(ec) + '">' +
      '<label class="muted">' + esc(uiT('worker')) + '</label><select id="vdWho">' + topts + '</select>' +
      '<div class="err" id="vdErr"></div>' +
      '<button class="btn" id="vdGo" onclick="saveVisitDate(\'' + id + '\',' + i + ')">' + esc(uiT('save')) + '</button>' +
      '<button class="btn ghost" onclick="$(\'modal\').classList.add(\'hidden\')">' + esc(uiT('cancel')) + '</button></div>';
  };
  window.saveVisitDate = async function (id, i) {
    var en = loginLang() === 'en';
    var day = $('vdDay').value;
    var base = new Date(day + 'T12:00:00');
    var start = clockToDate(snapClock($('vdStart').value), base);
    var end = clockToDate(snapClock($('vdEnd').value), base);
    if (!day || !start || !end) { $('vdErr').textContent = en ? 'Pick the date and times.' : 'Elige la fecha y las horas.'; return; }
    if (!(end > start)) { $('vdErr').textContent = en ? 'End after start.' : 'La hora de fin va después del inicio.'; return; }
    var who = $('vdWho').value;
    var j = (jobs || []).find(function (x) { return x.id === id; }) || {};
    try { var d = await db.collection('jobs').doc(id).get(); if (d.exists) j = Object.assign({ id: d.id }, d.data()); } catch (_) {}
    var vs = jobVisits(j).map(function (v) { return Object.assign({}, v); });
    if (!vs.length) vs = [{ id: 'primary', status: 'open' }];
    vs[i] = Object.assign({}, vs[i], { scheduledDate: day, startClock: toClock(start), endClock: toClock(end), assignedUid: who });
    var patch = { visits: vs, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (i === 0) {
      Object.assign(patch, assignmentPatch(who), {
        scheduledDate: day, startClock: toClock(start), endClock: toClock(end),
        hour: start.getHours(), minute: start.getMinutes(), endHour: end.getHours(), endMinute: end.getMinutes(),
        startTime: fmt(start), time: fmt(start), endTime: fmt(end),
        appointment_start: firebase.firestore.Timestamp.fromDate(start),
        appointment_end: firebase.firestore.Timestamp.fromDate(end)
      });
    }
    $('vdGo').disabled = true;
    try {
      await db.collection('jobs').doc(id).set(patch, { merge: true });
      $('modal').classList.add('hidden');
      if (!(window.jvAfterJobChange && jvAfterJobChange(id))) openJobDetail(id);
    } catch (e) { $('vdErr').textContent = jobSaveError(e); $('vdGo').disabled = false; }
  };
  window.reopenJob = async function (id) {
    if (!canAssign()) return;
    var en = loginLang() === 'en';
    if (!(await wkConfirm(en ? 'Reopen this job?' : '¿Reabrir este trabajo?', en ? 'Yes, reopen' : 'Sí, reabrir', en ? 'Cancel' : 'Cancelar'))) return;
    try {
      var patch = {
        status: 'open',
        visitStatus: 'open',
        closedByOffice: false,
        reopenedAt: firebase.firestore.FieldValue.serverTimestamp(),
        reopenedBy: uid(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      // The last visit opens again; earlier visits keep their real status.
      var vs = await savedVisits(id);
      if (vs && vs.length) {
        var last = 0;
        vs.forEach(function (v, i) { if (String(v.scheduledDate || '') >= String(vs[last].scheduledDate || '')) last = i; });
        patch.visits = vs.map(function (v, i) { return i === last ? Object.assign({}, v, { status: 'open' }) : v; });
      }
      await db.collection('jobs').doc(id).set(patch, { merge: true });
      if (!(window.jvAfterJobChange && jvAfterJobChange(id))) openJobDetail(id);
    } catch (e) { alert(jobSaveError(e)); }
  };
  window.openJobView = function (id) { return openJobDetail(id); };
})();
