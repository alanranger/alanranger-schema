/**
 * First-touch ChatGPT ad visit, plus Academy trial and upgrade events.
 * https://schema.alanranger.com/loaders/visit-source.js
 * Loaded by the site-wide chat embed. Writes nothing until performance cookies are accepted.
 */
(function () {
  var KEY = 'arp_signup_source_v1';
  var API = 'https://alanranger-modules.vercel.app/api/academy/signup-source';
  var TRIAL = 'pln_academy-trial-30-days--wb7v0hbh';

  function allowed() {
    try {
      var read = window.getSquarespaceCookies;
      var cookies = read && read();
      return !!(cookies && cookies.performance === 'accepted');
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

  function eventOnce(name, params) {
    var mark = 'arp_evt_' + name;
    if (sessionStorage.getItem(mark)) return;
    sessionStorage.setItem(mark, '1');
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
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

  async function run() {
    if (!allowed()) return;
    capture();
    var person = await member();
    if (onTrial(person) && /\/academy\/login/.test(location.pathname)) eventOnce('trial_start');
    if (/[?&]upgraded=1(?:&|$)/.test(location.search)) eventOnce('academy_upgrade', { value: 79, currency: 'GBP' });
    await flush(person);
  }

  var tries = 0;
  (function tick() {
    if (allowed() || tries > 16) { run(); return; }
    tries += 1;
    setTimeout(tick, 500);
  })();
})();
