/**
 * First-touch ChatGPT ad visit, plus Academy trial and upgrade events.
 * https://schema.alanranger.com/loaders/visit-source.js
 * Loaded from the site header and the landing-page loader. Writes nothing until performance cookies are accepted.
 */
(function () {
  if (window.__arpVisitSource) return;
  window.__arpVisitSource = true;
  var KEY = 'arp_signup_source_v1';
  var API = 'https://alanranger-modules.vercel.app/api/academy/signup-source';
  var ORDER_API = 'https://ai-geo-audit.vercel.app/api/aigeo/order-visit';
  var TRIAL = 'pln_academy-trial-30-days--wb7v0hbh';

  function allowed() {
    try {
      var read = window.getSquarespaceCookies;
      if (read) {
        var cookies = read();
        return !!(cookies && cookies.performance === 'accepted');
      }
      return document.cookie.indexOf('ss_performanceCookiesAllowed=true') !== -1;
    } catch (e) {
      return false;
    }
  }

  function readStored() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  function writeStored(payload) {
    localStorage.setItem(KEY, JSON.stringify(payload));
    document.cookie = 'arp_signup_src=' + encodeURIComponent(payload.src) + '; path=/; max-age=2592000; SameSite=Lax';
  }

  function capture() {
    var qp = new URLSearchParams(location.search || '');
    var source = (qp.get('utm_source') || '').trim().toLowerCase();
    if (source !== 'chatgpt') return;
    if (readStored()) return;
    var medium = (qp.get('utm_medium') || '').trim().toLowerCase();
    writeStored({
      src: medium === 'cpc' ? 'chatgpt-ads' : 'chatgpt',
      utm_source: source,
      utm_medium: medium || null,
      utm_campaign: qp.get('utm_campaign') || null,
      utm_content: qp.get('utm_content') || null,
      landing_path: location.pathname || null,
      at: new Date().toISOString()
    });
  }

  function wait(ms) {
    return new Promise(function (done) { setTimeout(done, ms); });
  }

  function eventOnce(name, params, memberId) {
    var mark = 'arp_evt_' + name + (memberId ? '_' + memberId : '');
    try {
      if (localStorage.getItem(mark)) return;
      localStorage.setItem(mark, '1');
    } catch (e) {
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function checkoutTrial() {
    var path = location.pathname || '';
    var search = location.search || '';
    return path.indexOf('/academy/dashboard') !== -1 && /[?&]fromCheckout=true(?:&|$)/.test(search) && /trial/i.test(search);
  }

  async function member() {
    var ms = window.$memberstackDom;
    if (!ms || typeof ms.getCurrentMember !== 'function') return null;
    try {
      var res = await ms.getCurrentMember();
      return (res && (res.data || res)) || null;
    } catch (e) {
      return null;
    }
  }

  function onTrial(person) {
    var plans = (person && person.planConnections) || [];
    return plans.some(function (plan) { return plan && plan.planId === TRIAL && plan.status !== 'CANCELED'; });
  }

  async function flush(person) {
    var stored = readStored();
    var id = person && (person.id || person.memberId);
    if (!stored || !id) return;
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: id,
        signup_source: stored.src,
        utm_source: stored.utm_source,
        utm_medium: stored.utm_medium,
        utm_campaign: stored.utm_campaign,
        utm_content: stored.utm_content,
        landing_path: stored.landing_path
      }),
      keepalive: true
    });
  }

  async function memberReady() {
    var n = 0;
    while (n < 24) {
      var person = await member();
      if (person && (person.id || person.memberId)) return person;
      n += 1;
      await wait(500);
    }
    return null;
  }

  async function run() {
    if (!allowed()) return;
    capture();
    var person = await memberReady();
    var id = person && (person.id || person.memberId);
    var onLogin = onTrial(person) && /\/academy\/login/.test(location.pathname);
    if (checkoutTrial() || onLogin) eventOnce('trial_start', {}, id);
    if (/[?&]upgraded=1(?:&|$)/.test(location.search)) eventOnce('academy_upgrade', { value: 79, currency: 'GBP' }, id);
    await flush(person);
    await postOrder();
  }

  function readOrderNumber(doc) {
    var node = doc.querySelector('script#bootstrap-data');
    if (!node) return null;
    try {
      var data = JSON.parse(node.textContent || '');
      var raw = data && data.order && data.order.orderNumber;
      return raw == null ? null : String(raw);
    } catch (e) {
      return null;
    }
  }

  async function orderNumber() {
    var found = readOrderNumber(document);
    if (found) return found;
    try {
      var res = await fetch(location.href, { credentials: 'same-origin' });
      var html = await res.text();
      return readOrderNumber(new DOMParser().parseFromString(html, 'text/html'));
    } catch (e) {
      return null;
    }
  }

  async function postOrder() {
    if ((location.pathname || '').indexOf('/commerce/orders/') === -1) return;
    var stored = readStored();
    var number = await orderNumber();
    if (!stored || !number) return;
    var mark = 'arp_order_' + number;
    try { if (localStorage.getItem(mark)) return; } catch (e) { return; }
    try {
      var res = await fetch(ORDER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: number,
          signup_source: stored.src,
          utm_source: stored.utm_source,
          utm_medium: stored.utm_medium,
          utm_campaign: stored.utm_campaign,
          utm_content: stored.utm_content,
          landing_path: stored.landing_path,
          captured_at: stored.at
        }),
        keepalive: true
      });
      var json = await res.json();
      if (res.ok && json && json.ok) localStorage.setItem(mark, '1');
    } catch (e) {}
  }

  var tries = 0;
  (function tick() {
    if (allowed() || tries > 120) { run(); return; }
    tries += 1;
    setTimeout(tick, 500);
  })();
})();
