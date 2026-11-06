/* Company "Trabajos" page as a list of ALL jobs (Jobber style):
   overview counts, recent / scheduled visits, filters and a sortable table
   with every job, including completed and archived ones.
   Loaded after jobview.js; the previous card view stays as openJobCards().
   Company panel only — workers never load this file. */
(function () {
  // Card view from jobview.js. Its search box calls openJobs(text), so while it
  // is showing, openJobs(text) goes back to it; openJobs() opens the list.
  var cardsView = window.openJobs;
  window.jlMode = 'list';
  if (typeof cardsView === 'function') window.openJobCards = function (q) { window.jlMode = 'cards'; return cardsView(q); };

  function L(es, en) { return loginLang() === 'en' ? en : es; }
  function usd(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function firstDay(j) {
    var v = (typeof jobVisits === 'function' ? jobVisits(j) : [])[0] || {};
    return v.scheduledDate || j.scheduledDate || '';
  }
  function doneAt(j) {
    if (!jobDone(j)) return null;
    return toDate(j.completedAt) || toDate(j.closedAt) || toDate(j.report && j.report.updatedAt) || toDate(j.updatedAt);
  }
  function fmtDay(ymdStr) {
    var p = String(ymdStr || '').slice(0, 10).split('-');
    if (p.length < 3) return '';
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDate(d) {
    return d ? d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  function bName(j) {
    var b = (typeof buildings !== 'undefined' ? buildings : []).find(function (x) { return x.id === j.buildingId; });
    return (b && b.name) || j.buildingName || '';
  }
  function clientName(j) { return j.clientName || j.contactName || bName(j) || ''; }
  function addr(j) { return j.address || (typeof cardAddr === 'function' ? cardAddr(j) : '') || bName(j) || ''; }

  // Same rules as the old chips in jobs.js.
  function isLate(j) { var d = firstDay(j); return !jobArchived(j) && !jobDone(j) && !!d && d < ymd(new Date()); }
  function isUnsched(j) { return !jobArchived(j) && !jobDone(j) && !firstDay(j); }
  function isSoon(j) {
    if (jobArchived(j) || jobDone(j)) return false;
    var d = firstDay(j); if (!d) return false;
    return d >= ymd(new Date()) && d <= ymd(new Date(Date.now() + 30 * 86400000));
  }
  function needsInvoice(j) { return !j.isTask && !jobArchived(j) && jobDone(j) && !j.invoiceId; }
  function needsAction(j) {
    if (jobArchived(j) || jobDone(j)) return false;
    if (j.needsReturn === true) return true;
    if (typeof accountUidOf === 'function' && !accountUidOf(j)) return true;
    return !!(j.lastReschedule && j.lastReschedule.seen !== true);
  }
  // One status per job, like Jobber's pill.
  function status(j) {
    if (jobArchived(j)) return { k: 'arch', t: L('Archivado', 'Archived'), c: 'gray' };
    if (j.needsReturn === true) return { k: 'action', t: L('Necesita volver', 'Needs return'), c: 'amber' };
    if (jobDone(j)) return needsInvoice(j) && canSeeMoney()
      ? { k: 'invoice', t: L('Requiere factura', 'Requires invoicing'), c: 'gold' }
      : { k: 'done', t: L('Completado', 'Completed'), c: 'green' };
    if (isLate(j)) return { k: 'late', t: L('Atrasado', 'Late'), c: 'red' };
    if (needsAction(j)) return { k: 'action', t: L('Requiere acción', 'Action required'), c: 'amber' };
    if (isUnsched(j)) return { k: 'open', t: L('Sin programar', 'Unscheduled'), c: 'amber' };
    return { k: 'up', t: L('Próximo', 'Upcoming'), c: 'blue' };
  }

  window.jlUi = window.jlUi || { f: 'all', type: '', q: '', sort: 'date', dir: -1, show: 100 };
  var FILTERS = {
    all: function (j) { return !jobArchived(j); },
    soon: isSoon, late: isLate, invoice: needsInvoice, action: needsAction, open: isUnsched,
    done: function (j) { return !jobArchived(j) && jobDone(j); },
    arch: function (j) { return jobArchived(j); }
  };
  function sortKey(j, k) {
    if (k === 'client') return clientName(j).toLowerCase();
    if (k === 'num') return Number(j.jobNumber || 0);
    if (k === 'addr') return addr(j).toLowerCase();
    if (k === 'status') return status(j).t;
    if (k === 'total') return jobLineTotal(j);
    var d = doneAt(j); return d ? ymd(d) : firstDay(j) || '';
  }

  window.openJobs = function (q) {
    if (isWorker()) return;
    if (window.jlMode === 'cards' && q !== undefined && window.openJobCards) return openJobCards(q);
    window.jlMode = 'list';
    document.body.classList.remove('view-hours', 'view-roles', 'view-reports', 'view-worker', 'view-companies', 'view-billing', 'view-archived', 'view-home', 'view-search', 'sites-open', 'view-job', 'view-payments', 'view-clients', 'view-requests', 'view-quotes');
    document.body.classList.add('view-jobs');
    if (typeof closeMore === 'function') closeMore();
    if (typeof markNav === 'function') markNav('jobs');
    var pane = $('jobsPane'); if (!pane) return;
    var ui = window.jlUi;
    if (typeof q === 'string') ui.q = q;
    var keepFocus = document.activeElement && document.activeElement.id === 'jobSearch';
    var money = canSeeMoney();
    var all = jobs || [];
    var live = all.filter(function (j) { return !jobArchived(j); });
    var cnt = function (k) { return all.filter(FILTERS[k]).length; };

    // Visits done in the last 30 days / scheduled in the next 30 days.
    var now = new Date(), past = new Date(now.getTime() - 30 * 86400000);
    var recent = live.filter(function (j) { var d = doneAt(j); return d && d >= past && d <= now; }).length;
    var nextN = live.filter(isSoon).length;

    var query = String(ui.q || '').toLowerCase();
    var list = all.filter(FILTERS[ui.f] || FILTERS.all).filter(function (j) {
      if (ui.type && String(j.kind || j.title || '') !== ui.type) return false;
      if (!query) return true;
      return [j.jobNumber, j.title, j.kind, clientName(j), addr(j), bName(j)].join(' ').toLowerCase().indexOf(query) >= 0;
    });
    list.sort(function (a, b) {
      var x = sortKey(a, ui.sort), y = sortKey(b, ui.sort);
      return (x < y ? -1 : x > y ? 1 : 0) * ui.dir;
    });

    var types = {};
    all.forEach(function (j) { var t = j.kind || j.title || ''; if (t) types[t] = 1; });
    var dot = function (k, color, label) {
      return '<button type="button" class="jl-ov-item' + (ui.f === k ? ' on' : '') + '" onclick="jlUi.f=\'' + k + '\';jlUi.show=100;openJobs()">' +
        '<i style="background:' + color + '"></i>' + esc(label) + ' <span>(' + cnt(k) + ')</span></button>';
    };
    var fOpt = function (k, label) { return '<option value="' + k + '"' + (ui.f === k ? ' selected' : '') + '>' + esc(label) + '</option>'; };
    var th = function (k, label) {
      var on = ui.sort === k;
      return '<th><button type="button" class="jl-sort' + (on ? ' on' : '') + '" onclick="jlSort(\'' + k + '\')">' + esc(label) +
        ' <span>' + (on ? (ui.dir > 0 ? '▲' : '▼') : '⇅') + '</span></button></th>';
    };
    var rows = list.slice(0, ui.show).map(function (j) {
      var st = status(j), d = doneAt(j), day = firstDay(j);
      var when = d
        ? '<span class="jl-done">' + esc(L('COMPLETADO', 'COMPLETED')) + '</span><br>' + esc(fmtDate(d))
        : (day ? esc(fmtDay(day)) : '<span class="muted">' + esc(L('Sin programar', 'Unscheduled')) + '</span>');
      return '<tr onclick="openJobView(\'' + j.id + '\')">' +
        '<td data-l="' + esc(L('Cliente', 'Client')) + '"><b>' + esc(clientName(j) || '—') + '</b></td>' +
        '<td data-l="' + esc(L('Trabajo', 'Job')) + '"><b>' + esc(j.jobNumber ? '#' + j.jobNumber : '—') + '</b><div class="muted">' + esc(j.title || j.kind || '') + '</div></td>' +
        '<td data-l="' + esc(L('Dirección', 'Property')) + '">' + esc(addr(j) || '—') + '</td>' +
        '<td data-l="' + esc(L('Fecha', 'Schedule')) + '">' + when + '</td>' +
        '<td data-l="' + esc(L('Estado', 'Status')) + '"><span class="jl-pill ' + st.c + '"><i></i>' + esc(st.t) + '</span></td>' +
        (money ? '<td data-l="Total" class="jl-tot">' + usd(jobLineTotal(j)) + '</td>' : '') + '</tr>';
    }).join('') || '<tr><td colspan="6" class="muted">' + esc(L('Sin trabajos', 'No jobs')) + '</td></tr>';

    pane.innerHTML =
      '<div class="jobs-toolbar"><h2>' + esc(L('Trabajos', 'Jobs')) + '</h2>' +
        (canAssign() ? '<button class="btn" onclick="openCreateJob()">' + esc(uiT('createJob')) + '</button>' : '') +
        (typeof openJobCards === 'function' ? '<button class="btn ghost" onclick="openJobCards()">' + esc(L('Ver asignaciones', 'Assignments')) + '</button>' : '') + '</div>' +
      '<div class="jl-top">' +
        '<div class="jl-card jl-ov"><h3>' + esc(L('Resumen', 'Overview')) + '</h3>' +
          dot('soon', '#DC2626', L('Por vencer en 30 días', 'Ending within 30 days')) +
          dot('late', '#DC2626', L('Atrasados', 'Late')) +
          (money ? dot('invoice', '#CA8A04', L('Requieren factura', 'Requires invoicing')) : '') +
          dot('action', '#CA8A04', L('Requieren acción', 'Action required')) +
          dot('open', '#CA8A04', L('Sin programar', 'Unscheduled')) +
        '</div>' +
        '<div class="jl-card"><h3>' + esc(L('Visitas recientes', 'Recent visits')) + '</h3><div class="muted">' + esc(L('Últimos 30 días', 'Past 30 days')) + '</div><b class="jl-big">' + recent + '</b></div>' +
        '<div class="jl-card"><h3>' + esc(L('Visitas programadas', 'Visits scheduled')) + '</h3><div class="muted">' + esc(L('Próximos 30 días', 'Next 30 days')) + '</div><b class="jl-big">' + nextN + '</b></div>' +
      '</div>' +
      '<div class="jl-head"><h3>' + esc(ui.f === 'arch' ? L('Trabajos archivados', 'Archived jobs') : L('Todos los trabajos', 'All jobs')) +
        ' <span class="muted">(' + list.length + ' ' + esc(L('resultados', 'results')) + ')</span></h3>' +
        '<input id="jobSearch" type="search" aria-label="' + esc(L('Buscar trabajos', 'Search jobs')) + '" placeholder="' + esc(L('Buscar trabajos…', 'Search jobs…')) + '" value="' + esc(ui.q || '') + '" oninput="openJobs(this.value)"></div>' +
      '<div class="jl-filters">' +
        '<label class="jl-fpill">' + esc(L('Estado', 'Status')) + ' |<select onchange="jlUi.f=this.value;jlUi.show=100;openJobs()">' +
          fOpt('all', L('Todos', 'All')) + fOpt('done', L('Completados', 'Completed')) + fOpt('late', L('Atrasados', 'Late')) +
          (money ? fOpt('invoice', L('Requieren factura', 'Requires invoicing')) : '') + fOpt('action', L('Requieren acción', 'Action required')) +
          fOpt('open', L('Sin programar', 'Unscheduled')) + fOpt('soon', L('Por vencer en 30 días', 'Ending within 30 days')) + fOpt('arch', L('Archivados', 'Archived')) +
        '</select></label>' +
        '<label class="jl-fpill">' + esc(L('Tipo de trabajo', 'Job type')) + ' |<select onchange="jlUi.type=this.value;openJobs()"><option value="">' + esc(L('Todos', 'All')) + '</option>' +
          Object.keys(types).sort().map(function (t) { return '<option' + (ui.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') +
        '</select></label>' +
      '</div>' +
      '<table class="jobs-table jl-table"><thead><tr>' +
        th('client', L('Cliente', 'Client')) + th('num', L('Trabajo', 'Job number')) + th('addr', L('Dirección', 'Property')) +
        th('date', L('Fecha', 'Schedule')) + th('status', L('Estado', 'Status')) + (money ? th('total', 'Total') : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      (list.length > ui.show ? '<button type="button" class="btn ghost jl-more" onclick="jlUi.show+=100;openJobs()">' + esc(L('Ver más', 'Show more')) + ' (' + (list.length - ui.show) + ')</button>' : '');
    if (keepFocus) { var s = $('jobSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  };
  window.jlSort = function (k) {
    var ui = window.jlUi;
    if (ui.sort === k) ui.dir = -ui.dir; else { ui.sort = k; ui.dir = (k === 'date' || k === 'num' || k === 'total') ? -1 : 1; }
    openJobs();
  };
})();
