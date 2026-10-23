/** Only place that picks a role folder. Shared UI must not import this. */
(function () {
  // The ONLY list of app owners for the web. compania/ and empleado/ read it
  // through WK_isSuperEmail. Keep it in sync with isSuperAdmin() in firestore.rules.
  var SUPER = {
    'maikelramirez55@gmail.com': 1
  };
  function normRole(r) {
    r = String(r || '').toLowerCase();
    if (r === 'employee' || r === 'tech' || r === 'trabajador') return 'worker';
    if (r === 'editor') return 'manager';
    return r;
  }
  function folderFor(email, role) {
    if (SUPER[String(email || '').toLowerCase()]) return '/web/plataforma/';
    if (normRole(role) === 'worker') return '/web/empleado/';
    return '/web/compania/';
  }
  window.WK_folderFor = folderFor;
  window.WK_normRole = normRole;
  window.WK_isSuperEmail = function (email) {
    return !!SUPER[String(email || '').toLowerCase()];
  };
})();
