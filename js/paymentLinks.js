/** Stripe Payment Links — trial starts after register. */
window.PAYMENT_LINKS = {
  crew5:     'https://buy.stripe.com/00w8wP5Lo5qt3Ul3iO63K00',
  crew10:    'https://buy.stripe.com/dRm9AT7Twf134YpbPk63K01',
  unlimited: 'https://buy.stripe.com/3cI00jgq22eh1Md7z463K02'
};
/**
 * Stripe customer portal (Stripe → Settings → Billing → Customer portal →
 * "Login link"). The owner cancels, changes card or sees receipts there.
 * Cancelling during the 15-day trial means no charge. Empty = button hidden.
 */
window.BILLING_PORTAL_URL = 'https://billing.stripe.com/p/login/00w8wP5Lo5qt3Ul3iO63K00';
window.billingPortalHref = function (email) {
  var base = window.BILLING_PORTAL_URL || '';
  if (!base) return '';
  return email ? base + (base.indexOf('?') >= 0 ? '&' : '?') + 'prefilled_email=' + encodeURIComponent(email) : base;
};
window.PLAN_LABELS = {
  crew5: 'CREW 5 $99.99',
  crew10: 'CREW 10 $149.99',
  unlimited: 'UNLIMITED $299.99'
};
window.normalizePlan = function(raw){
  const p = String(raw||'').toLowerCase().replace(/[_-\s]/g,'');
  if (p === 'crew5' || p === 'crew05') return 'crew5';
  if (p === 'crew10') return 'crew10';
  if (p === 'unlimited' || p === 'unlimit') return 'unlimited';
  return '';
};
window.paymentHref = function(plan, extra){
  const id = window.normalizePlan(plan);
  const base = (window.PAYMENT_LINKS||{})[id] || '';
  if (!base) return '';
  const q = [];
  if (extra && extra.email) q.push('prefilled_email=' + encodeURIComponent(extra.email));
  if (extra && extra.clientRef) q.push('client_reference_id=' + encodeURIComponent(extra.clientRef));
  return q.length ? (base + (base.indexOf('?')>=0?'&':'?') + q.join('&')) : base;
};
window.fillPlanSelect = function(sel){
  if (!sel) return;
  const cur = window.normalizePlan(sel.value);
  sel.innerHTML = '';
  ['crew5','crew10','unlimited'].forEach(function(id){
    const o = document.createElement('option');
    o.value = id;
    o.textContent = (window.PLAN_LABELS||{})[id] || id;
    sel.appendChild(o);
  });
  sel.value = cur || 'crew10';
};
