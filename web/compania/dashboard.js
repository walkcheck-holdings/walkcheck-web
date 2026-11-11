/* Company dashboard on Inicio: money in vs money out for one month.
   Entradas = payments recorded on invoices. Gastos = expenses logged on jobs
   plus the material cost (report.expensesTotal) from each Job Report.
   Owner / office only (canSeeMoney). Workers never load this file. */
(function () {
  var month = null; // 'YYYY-MM'
  var invCache = null;

  function T(es, en) { return loginLang() === 'en' ? en : es; }
  function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function thisMonth() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function shiftMonth(m, k) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + k;
    var d = new Date(y, mo, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function monthLabel(m) {
    var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1);
    var s = d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dayLabel(ymdStr) {
    var p = String(ymdStr || '').slice(0, 10).split('-');
    if (p.length < 3) return '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(loginLang() === 'en' ? 'en-US' : 'es-US', { day: 'numeric', month: 'short' });
  }

  async function loadInvoices(force) {
    if (invCache && !force) return invCache;
    var snap = await db.collection('companies').doc(cid()).collection('invoices').limit(1000).get();
    invCache = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    return invCache;
  }

  function localYmd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function tsDay(t) {
    if (!t) return '';
    var d = typeof t.toDate === 'function' ? t.toDate() : new Date(t);
    return isNaN(d) ? '' : localYmd(d);
  }
  // Day of a Job Report expense: the day the report was completed (that is when the
  // material was bought), else the job's visit day, else when the report was last saved.
  function reportDay(j) {
    var r = j.report || {};
    return tsDay(r.completedAt) || String(j.scheduledDate || j.date || '').slice(0, 10) || tsDay(r.updatedAt);
  }

  function movesFor(m, invoices) {
    var moves = [];
    invoices.forEach(function (inv) {
      (inv.payments || []).forEach(function (p) {
        if (String(p.date || '').slice(0, 7) !== m) return;
        moves.push({
          date: String(p.date).slice(0, 10), kind: 'in', amount: Number(p.amount || 0),
          label: T('Pago', 'Payment') + ' · ' + (inv.client || (T('Factura #', 'Invoice #') + (inv.number || ''))),
          open: function () { if (typeof openInvoice === 'function') openInvoice(inv.id); }
        });
      });
    });
    (typeof jobs !== 'undefined' ? jobs : []).forEach(function (j) {
      // Archived jobs (e.g. a duplicate) do not count as expenses.
      if (typeof jobArchived === 'function' && jobArchived(j)) return;
      var jobName = j.number ? T('Trabajo #', 'Job #') + j.number : (j.title || T('Trabajo', 'Job'));
      var openJob = function () { if (typeof openJobDetail === 'function') openJobDetail(j.id); };
      (Array.isArray(j.expenses) ? j.expenses : []).forEach(function (e) {
        if (String(e.date || '').slice(0, 7) !== m) return;
        moves.push({
          date: String(e.date).slice(0, 10), kind: 'out', amount: Number(e.total || 0),
          label: (e.vendor || e.items || T('Gasto', 'Expense')) + ' · ' + jobName,
          open: openJob
        });
      });
      // Material cost the worker typed in the Job Report (app or worker web),
      // e.g. a Home Depot receipt. It lives in report.expensesTotal, not in expenses[].
      var r = j.report;
      var cost = r ? Number(r.expensesTotal) : 0;
      if (cost > 0) {
        var day = reportDay(j);
        if (day.slice(0, 7) === m) {
          moves.push({
            date: day, kind: 'out', amount: cost,
            label: ((r.supplier && String(r.supplier).trim()) || T('Materiales', 'Materials')) + ' · ' + jobName,
            open: openJob
          });
        }
      }
    });
    moves.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return moves;
  }

  // Donut: green arc = entradas, red arc = gastos, net balance in the middle.
  function donut(inSum, outSum) {
    var r = 70, c = 2 * Math.PI * r, tot = inSum + outSum;
    var inLen = tot > 0 ? c * inSum / tot : 0;
    var ring = tot > 0
      ? '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#DC2626" stroke-width="22"/>' +
        '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#16A34A" stroke-width="22" stroke-dasharray="' + inLen.toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 90 90)"/>'
      : '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#E5E7EB" stroke-width="22"/>';
    var net = inSum - outSum;
    return '<svg viewBox="0 0 180 180" class="dash-donut" role="img" aria-label="' + esc(T('Entradas y gastos', 'Money in and out')) + '">' + ring +
      '<text x="90" y="78" text-anchor="middle" class="dash-dl">' + esc(T('Saldo neto', 'Net balance')) + '</text>' +
      '<text x="90" y="102" text-anchor="middle" class="dash-dv" fill="' + (net < 0 ? '#DC2626' : '#14532D') + '">' + esc((net < 0 ? '-' : '') + money(Math.abs(net))) + '</text>' +
      '</svg>';
  }

  window.renderHomeDash = async function (force) {
    var box = $('homeDash');
    if (!box) return;
    if (typeof canSeeMoney !== 'function' || !canSeeMoney()) { box.innerHTML = ''; return; }
    month = month || thisMonth();
    if (!box.innerHTML) box.innerHTML = '<div class="dash-card muted">' + esc(T('Cargando…', 'Loading…')) + '</div>';
    var invoices;
    try { invoices = await loadInvoices(force); }
    catch (e) { box.innerHTML = '<div class="dash-card err">' + esc(e.message || e) + '</div>'; return; }
    box = $('homeDash'); if (!box) return;
    var moves = movesFor(month, invoices);
    var inSum = moves.filter(function (m) { return m.kind === 'in'; }).reduce(function (s, m) { return s + m.amount; }, 0);
    var outSum = moves.filter(function (m) { return m.kind === 'out'; }).reduce(function (s, m) { return s + m.amount; }, 0);
    var tot = inSum + outSum;
    var pct = function (v) { return tot > 0 ? Math.round(v * 100 / tot) : 0; };
    window._dashMoves = moves;
    var rows = moves.slice(0, 6).map(function (m, i) {
      return '<button type="button" class="dash-row" onclick="_dashMoves[' + i + '].open()">' +
        '<span class="dash-d">' + esc(dayLabel(m.date)) + '</span>' +
        '<span class="dash-c">' + esc(m.label) + '</span>' +
        '<span class="dash-a ' + m.kind + '">' + (m.kind === 'in' ? '+' : '-') + esc(money(m.amount)) + '</span></button>';
    }).join('') || '<p class="muted" style="padding:12px 0">' + esc(T('Sin movimientos este mes.', 'No activity this month.')) + '</p>';
    var isNow = month === thisMonth();
    box.innerHTML =
      '<div class="dash-card">' +
        '<div class="dash-head"><div><h3>Dashboard</h3><div class="muted">' + esc(T('Resumen del mes', 'Month summary')) + ' · ' + esc(monthLabel(month)) + '</div></div>' +
          '<div class="dash-nav"><button type="button" class="btn ghost" aria-label="' + esc(T('Mes anterior', 'Previous month')) + '" onclick="dashMonth(-1)">‹</button>' +
          '<button type="button" class="btn ghost" aria-label="' + esc(T('Mes siguiente', 'Next month')) + '" onclick="dashMonth(1)"' + (isNow ? ' disabled' : '') + '>›</button></div></div>' +
        '<div class="dash-grid">' +
          '<div class="dash-left">' + donut(inSum, outSum) +
            '<div class="dash-legend"><span><i style="background:#DC2626"></i>' + esc(T('Gastos', 'Expenses')) + '</span><span><i style="background:#16A34A"></i>' + esc(T('Entradas', 'Money in')) + '</span></div>' +
            '<div class="dash-tiles">' +
              '<div class="dash-tile"><div class="muted"><i style="background:#DC2626"></i>' + esc(T('Gastos', 'Expenses')) + '</div><b>' + esc(money(outSum)) + '</b><div class="muted">' + pct(outSum) + '% ' + esc(T('del total', 'of total')) + '</div></div>' +
              '<div class="dash-tile"><div class="muted"><i style="background:#16A34A"></i>' + esc(T('Entradas', 'Money in')) + '</div><b>' + esc(money(inSum)) + '</b><div class="muted">' + pct(inSum) + '% ' + esc(T('del total', 'of total')) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="dash-right"><div class="dash-th"><h4>' + esc(T('Últimos movimientos', 'Latest activity')) + '</h4>' +
            (typeof openPayments === 'function' ? '<a href="#" onclick="openPayments();return false">' + esc(T('Ver todo', 'See all')) + ' ›</a>' : '') + '</div>' +
            '<div class="dash-row dash-hdr"><span class="dash-d">' + esc(T('Fecha', 'Date')) + '</span><span class="dash-c">' + esc(T('Concepto', 'Item')) + '</span><span class="dash-a">' + esc(T('Importe', 'Amount')) + '</span></div>' +
            rows + '</div>' +
        '</div>' +
        '<p class="muted dash-foot">' + esc(T('Entradas = pagos registrados en facturas. Gastos = gastos anotados en los trabajos y costo de materiales de los Job Reports.', 'Money in = payments recorded on invoices. Expenses = expenses logged on jobs and material cost from Job Reports.')) + '</p>' +
      '</div>';
  };
  window.dashMonth = function (k) {
    month = shiftMonth(month || thisMonth(), k);
    if (month > thisMonth()) month = thisMonth();
    renderHomeDash();
  };
})();
