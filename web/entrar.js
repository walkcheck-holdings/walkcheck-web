/** Only place that picks a role folder. Shared UI must not import this. */
(function () {
  var SUPER = {
    'pegao.app@gmail.com': 1,
    'pegoa.app@gmail.com': 1,
    'maikelramirez55@gmail.com': 1,
    'maikel@walkcheck.app': 1,
    'info@walkcheck.app': 1,
    'soporte@walkcheck.app': 1
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
