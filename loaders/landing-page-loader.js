/**
 * landing-page-loader.js — https://schema.alanranger.com/loaders/landing-page-loader.js
 * One-line page-header loader. Manifest path only. After inject, strip in-body
 * FAQPage / core duplicates (same idea as product arStripOtherFaqPages).
 */
(function () {
  'use strict';
  function inEditor() {
    try {
      return window.self !== window.top ||
        /[?&](config|edit|fullSiteEdit)=/.test(location.search) ||
        document.body.classList.contains('sqs-edit-mode') ||
        document.body.classList.contains('sqs-edit-mode-active');
    } catch (e) { return true; }
  }
  if (inEditor()) return;

  function normPath(p) {
    var path = String(p || '/').replace(/\/+$/, '') || '/';
    if (path === '/') return '/home';
    return path;
  }

  var path = normPath(location.pathname);
  var BASE = 'https://schema.alanranger.com/';
  var CORE = { Article: 1, Organization: 1, LocalBusiness: 1, WebSite: 1, WebPage: 1, BreadcrumbList: 1, SearchAction: 1, Place: 1, Service: 1, Country: 1 };
  var HOST_ID = 'arp-landing-schema';
  var originalSchema = null;

  function getTypes(node) {
    if (!node) return [];
    return Array.isArray(node['@type']) ? node['@type'] : [node['@type']].filter(Boolean);
  }
  function visText() {
    if (!document.body) return '';
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,img,video,iframe,svg,picture,source').forEach(function (el) { el.remove(); });
    return String(clone.textContent || '').replace(/['’]/g, "'").toLowerCase();
  }
  function qVisible(q, text) {
    var name = String((q && q.name) || '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
    return name.length > 8 && text.indexOf(name) !== -1;
  }
  function isFaq(n) { return getTypes(n).indexOf('FAQPage') !== -1; }
  function nodesOf(json) {
    return Array.isArray(json && json['@graph']) ? json['@graph'] : (json ? [json] : []);
  }
  function isFooterTxt(txt) {
    return txt.indexOf('#photography-services') !== -1 && txt.indexOf('#website') !== -1;
  }
  function keepFaq(n, text) {
    if (!isFaq(n)) return n;
    var me = n.mainEntity;
    var qs = Array.isArray(me) ? me : (me ? [me] : []);
    var vis = qs.filter(function (q) { return qVisible(q, text); });
    window.__AR_FAQ_DROP = {
      url: location.href.split('#')[0],
      before: qs.length,
      after: vis.length,
      reason: vis.length ? (vis.length < qs.length ? 'hidden-questions-removed' : 'all-visible') : 'no-visible-questions'
    };
    if (!vis.length) return null;
    n.mainEntity = vis;
    return n;
  }
  var cleaning = false;
  function inject(data) {
    if (!data || typeof data !== 'object') return;
    var next = JSON.stringify(data);
    var old = document.getElementById(HOST_ID);
    if (old && (old.textContent || '') === next) return;
    if (old) old.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = HOST_ID;
    s.textContent = next;
    document.head.appendChild(s);
  }
  function readHosted() {
    var el = document.getElementById(HOST_ID);
    if (!el) return null;
    try { return JSON.parse(el.textContent || ''); } catch (e) { return null; }
  }
  function eachLd(fn) {
    document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(fn);
  }
  function hostedIds(schema) {
    var set = {};
    nodesOf(schema).forEach(function (n) {
      if (n && n['@id']) set[n['@id']] = 1;
    });
    return set;
  }
  function visibleBodyFaqs(text) {
    var qs = [];
    var seen = {};
    eachLd(function (el) {
      if (el.id === HOST_ID) return;
      var txt = (el.textContent || '').trim();
      if (!txt || isFooterTxt(txt)) return;
      try {
        nodesOf(JSON.parse(txt)).forEach(function (n) {
          if (!isFaq(n)) return;
          var me = Array.isArray(n.mainEntity) ? n.mainEntity : (n.mainEntity ? [n.mainEntity] : []);
          me.forEach(function (q) {
            if (!qVisible(q, text)) return;
            var k = String((q && q.name) || '').toLowerCase();
            if (!k || seen[k]) return;
            seen[k] = 1;
            qs.push(q);
          });
        });
      } catch (e) {}
    });
    return qs;
  }
  function mergeBodyFaq(schema, text) {
    var hasFaq = nodesOf(schema).some(function (n) { return isFaq(n) && Array.isArray(n.mainEntity) && n.mainEntity.length; });
    if (hasFaq) return schema;
    var qs = visibleBodyFaqs(text);
    if (!qs.length) return schema;
    var graph = nodesOf(schema).filter(function (n) { return !isFaq(n); });
    var pageUrl = (location.origin + location.pathname).replace(/\/+$/, '');
    graph.push({ '@type': 'FAQPage', '@id': pageUrl + '#faq', mainEntity: qs });
    return { '@context': 'https://schema.org', '@graph': graph };
  }
  function stripOthers(ids) {
    eachLd(function (el) {
      if (el.id === HOST_ID) return;
      var txt = (el.textContent || '').trim();
      if (!txt) { el.remove(); return; }
      if (isFooterTxt(txt)) return;
      try {
        var json = JSON.parse(txt);
        var nodes = nodesOf(json);
        var kept = nodes.filter(function (n) {
          if (isFaq(n)) return false;
          var types = getTypes(n);
          var id = String((n && n['@id']) || '');
          if (types.some(function (t) { return CORE[t]; }) && (!id || ids[id])) return false;
          return true;
        });
        if (!kept.length) { el.remove(); return; }
        if (kept.length === nodes.length) return;
        if (Array.isArray(json['@graph'])) {
          json['@graph'] = kept;
          el.textContent = JSON.stringify(json);
        } else {
          el.textContent = JSON.stringify(kept[0]);
        }
      } catch (e) {}
    });
  }
  function clean() {
    if (cleaning) return;
    cleaning = true;
    try {
    if (!originalSchema) return;
    var schema = JSON.parse(JSON.stringify(originalSchema));
    var text = visText();
    var nodes = nodesOf(schema).map(function (n) { return keepFaq(n, text); }).filter(Boolean);
    if (Array.isArray(schema['@graph'])) schema['@graph'] = nodes;
    else schema = nodes[0] || schema;
    schema = mergeBodyFaq(schema, text);
    inject(schema);
    stripOthers(hostedIds(schema));
    } finally {
      cleaning = false;
    }
  }
  var cleanTimer = null;
  function scheduleClean() {
    if (cleanTimer) return;
    cleanTimer = setTimeout(function () {
      cleanTimer = null;
      clean();
    }, 250);
  }
  function startClean() {
    if (window.__AR_LANDING_CLEAN_BOUND) {
      clean();
      return;
    }
    window.__AR_LANDING_CLEAN_BOUND = true;
    clean();
    document.addEventListener('DOMContentLoaded', clean);
    window.addEventListener('load', function () { setTimeout(clean, 800); });
    [1200, 3500].forEach(function (ms) { setTimeout(clean, ms); });
    try {
      new MutationObserver(scheduleClean).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function boot(schema) {
    if (!schema) return;
    originalSchema = JSON.parse(JSON.stringify(schema));
    inject(originalSchema);
    startClean();
  }
  if (window.__AR_LANDING_SCHEMA_INLINE) {
    boot(window.__AR_LANDING_SCHEMA_INLINE);
  } else {
    fetchJson(BASE + 'landings-manifest.json').then(function (manifest) {
      var pages = (manifest && manifest.pages) || {};
      var entry = pages[path];
      if (!entry || !entry.file) return;
      return fetchJson(BASE + entry.file).then(boot);
    }).catch(function () {});
  }
})();
