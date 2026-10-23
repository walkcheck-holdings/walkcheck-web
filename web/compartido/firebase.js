(function (w) {
  w.WK_FIREBASE = {
    apiKey: 'AIzaSyAnAsnPirqkN-fRIx-9aQzuwLBoFaHggrU',
    authDomain: 'walkcheck-a4f1e.firebaseapp.com',
    projectId: 'walkcheck-a4f1e',
    storageBucket: 'walkcheck-a4f1e.firebasestorage.app',
    messagingSenderId: '827762473021',
    appId: '1:827762473021:web:ff71afbe72df3a96ad5254'
  };
  if (!firebase.apps.length) firebase.initializeApp(w.WK_FIREBASE);
  w.auth = firebase.auth();
  w.db = firebase.firestore();
  w.storage = firebase.storage();
  w.$ = function (id) { return document.getElementById(id); };
  w.esc = function (s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
})(window);
