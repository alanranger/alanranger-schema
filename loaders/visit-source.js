/**
 * First-touch ChatGPT ad visit, plus Academy trial and upgrade events.
 * https://schema.alanranger.com/loaders/visit-source.js
 * Loaded from the site header and the landing-page loader. Writes nothing until performance cookies are accepted.
 * The OpenAI pixel is separate: it loads only after marketing cookies are accepted, and only on ad landings, order confirmations and the Academy trial return.
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

  function onGiftConfirm() {
    return (location.pathname || '').indexOf('/checkout/gift-card-order-confirmed') !== -1;
  }

  async function giftOrderNumber() {
    var n = 0;
    while (n < 20) {
      var text = document.body ? document.body.innerText : '';
      var match = text.match(/Order Number:?\s*#?\s*(\d{1,6})/i);
      if (match) return match[1];
      n += 1;
      await wait(500);
    }
    return null;
  }

  async function orderNumber() {
    if (onGiftConfirm()) return giftOrderNumber();
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
    var path = location.pathname || '';
    if (path.indexOf('/commerce/orders/') === -1 && !onGiftConfirm()) return;
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

  var PIXEL = 'BDexbNkWQFxbejp6FtADNR';
  var pixelReady = null;
  var pixelOn = false;
  var pixelBusy = false;

  function marketingAllowed() {
    try {
      var read = window.getSquarespaceCookies;
      if (read) {
        var cookies = read();
        return !!(cookies && cookies.marketing === 'accepted');
      }
      return document.cookie.indexOf('ss_marketingCookiesAllowed=true') !== -1;
    } catch (e) {
      return false;
    }
  }

  function pixelPage() {
    var path = location.pathname || '';
    var search = location.search || '';
    if (path.indexOf('/commerce/orders/') !== -1) return true;
    if (onGiftConfirm()) return true;
    if (path.indexOf('/academy/dashboard') !== -1) return true;
    if (path.indexOf('/academy/login') !== -1) return true;
    if (/[?&]oppref=/.test(search)) return true;
    return /[?&]utm_source=chatgpt(?:&|$)/i.test(search);
  }

  function loadPixel() {
    if (pixelReady) return pixelReady;
    pixelReady = new Promise(function (resolve) {
      var q = window.oaiq;
      if (!q) {
        q = function () { q.q.push(arguments); };
        q.q = [];
        window.oaiq = q;
      }
      q('consent', false);
      q('init', { pixelId: PIXEL });
      var js = document.createElement('script');
      js.async = true;
      js.src = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
      js.onload = function () { resolve(); };
      js.onerror = function () { pixelReady = null; resolve(); };
      document.head.appendChild(js);
    });
    return pixelReady;
  }

  function minorUnits(pounds) {
    var n = Number(String(pounds == null ? '' : pounds).replace(/,/g, ''));
    if (!isFinite(n)) return null;
    return Math.round(n * 100);
  }

  function paidFromText(text) {
    var yours = text.match(/Your order of £\s*([0-9]+(?:\.[0-9]{2})?)/i);
    if (yours) return yours[1];
    var total = text.match(/Total[^£]{0,40}£\s*([0-9]+(?:\.[0-9]{2})?)/i);
    if (total) return total[1];
    var all = text.match(/£\s*[0-9]+(?:\.[0-9]{2})?/g) || [];
    if (all.length === 1) return all[0].replace(/[^0-9.]/g, '');
    return null;
  }

  async function orderPaid() {
    if (onGiftConfirm()) {
      var n = 0;
      while (n < 20) {
        var text = document.body ? document.body.innerText : '';
        var num = (text.match(/Order Number:?\s*#?\s*(\d{1,6})/i) || [])[1];
        var pounds = paidFromText(text);
        if (num && pounds != null) return { number: num, pounds: pounds };
        n += 1;
        await wait(500);
      }
      return null;
    }
    var node = document.querySelector('script#bootstrap-data');
    if (!node) {
      try {
        var res = await fetch(location.href, { credentials: 'same-origin' });
        var html = await res.text();
        node = new DOMParser().parseFromString(html, 'text/html').querySelector('script#bootstrap-data');
      } catch (e) {
        return null;
      }
    }
    if (!node) return null;
    try {
      var data = JSON.parse(node.textContent || '');
      var order = data && data.order;
      var paid = order && order.grandTotal;
      if (!order || order.orderNumber == null || !paid) return null;
      return { number: String(order.orderNumber), pounds: paid.value };
    } catch (e) {
      return null;
    }
  }

  async function measureOrder() {
    var path = location.pathname || '';
    if (path.indexOf('/commerce/orders/') === -1 && !onGiftConfirm()) return;
    var found = await orderPaid();
    var amount = found ? minorUnits(found.pounds) : null;
    if (!found || amount == null || amount === 0) return;
    var eventId = 'sq-order-' + String(parseInt(found.number, 10));
    var mark = 'oaiq_order_' + eventId;
    try { if (localStorage.getItem(mark)) return; } catch (e) { return; }
    window.oaiq('measure', 'order_created', { type: 'contents', amount: amount, currency: 'GBP' }, { event_id: eventId });
    try { localStorage.setItem(mark, '1'); } catch (e) {}
  }

  async function trialEventId(memberId) {
    if (!window.crypto || !crypto.subtle) return null;
    var bytes = new TextEncoder().encode(String(memberId));
    var buf = await crypto.subtle.digest('SHA-256', bytes);
    var hex = '';
    var view = new Uint8Array(buf);
    for (var i = 0; i < view.length; i++) hex += ('0' + view[i].toString(16)).slice(-2);
    return 'sq-trial-' + hex.slice(0, 16);
  }

  async function measureTrial(person) {
    var id = person && (person.id || person.memberId);
    var onLogin = onTrial(person) && /\/academy\/login/.test(location.pathname);
    if (!id || !(checkoutTrial() || onLogin)) return;
    var eventId = await trialEventId(id);
    if (!eventId) return;
    var mark = 'oaiq_trial_' + eventId;
    try { if (localStorage.getItem(mark)) return; } catch (e) { return; }
    window.oaiq('measure', 'trial_started', { type: 'plan_enrollment', plan_id: TRIAL }, { event_id: eventId });
    try { localStorage.setItem(mark, '1'); } catch (e) {}
  }

  async function pixelTick() {
    if (pixelBusy) return;
    if (!pixelPage() || !marketingAllowed()) {
      if (pixelOn && window.oaiq) window.oaiq('consent', false);
      pixelOn = false;
      return;
    }
    pixelBusy = true;
    try {
      await loadPixel();
      if (!window.oaiq) return;
      window.oaiq('consent', true);
      pixelOn = true;
      await measureOrder();
      if (checkoutTrial() || /\/academy\/login/.test(location.pathname)) await measureTrial(await memberReady());
    } finally {
      pixelBusy = false;
    }
  }

  var tries = 0;
  (function tick() {
    if (allowed() || tries > 120) { run(); return; }
    tries += 1;
    setTimeout(tick, 500);
  })();
  if (pixelPage()) {
    setInterval(pixelTick, 2000);
    pixelTick();
  }
})();
