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
  // A signed-in account may enter only if it is the app owner, or it has a
  // profile in /users that belongs to a company. Accounts created outside our
  // sign-up flows (no profile, no company) are signed out.
  window.WK_hasAccess = function (email, profileDoc) {
    if (SUPER[String(email || '').toLowerCase()]) return true;
    if (!profileDoc || !profileDoc.exists) return false;
    var p = profileDoc.data() || {};
    return !!String(p.companyId || '').trim();
  };
  // No panel access until Stripe confirms payment (company status 'pending').
  // Returns true when it redirected to the pay page. The app owner is exempt.
  window.WK_paymentGate = function (email, profile) {
    if (SUPER[String(email || '').toLowerCase()]) return Promise.resolve(false);
    var cid = profile && profile.companyId;
    if (!cid) return Promise.resolve(false);
    return db.collection('companies').doc(cid).get().then(function (co) {
      var st = String(((co.exists && co.data()) || {}).status || '').toLowerCase();
      if (st !== 'pending') return false;
      location.replace('/web/compartido/pago-pendiente.html');
      return true;
    }).catch(function () { return false; });
  };
  window.WK_denyAccess = function () {
    return auth.signOut().catch(function () {}).then(function () {
      location.replace('/web/compartido/login.html?e=noaccess');
    });
  };
})();
