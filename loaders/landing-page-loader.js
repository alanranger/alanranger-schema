/**
 * landing-page-loader.js — https://schema.alanranger.com/loaders/landing-page-loader.js
 * One-line page-header loader. Reads landings-manifest.json and injects that
 * path's *_landing_schema.json. Does nothing on any path not in the manifest
 * (never blog / event / product pages, never product children of the shop).
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

  function getTypes(node) {
    if (!node) return [];
    return Array.isArray(node['@type']) ? node['@type'] : [node['@type']].filter(Boolean);
  }
  function visText() {
    if (!document.body) return '';
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach(function (el) { el.remove(); });
    return String(clone.textContent || '').replace(/['’]/g, "'").toLowerCase();
  }
  function qVisible(q, text) {
    var name = String((q && q.name) || '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
    return name.length > 8 && text.indexOf(name) !== -1;
  }
  function isFaq(n) { return getTypes(n).indexOf('FAQPage') !== -1; }
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
  function installSuppressor() {
    if (window.__AR_CORE_SUPPRESSOR_V22__) return;
    window.__AR_CORE_SUPPRESSOR_V22__ = true;
    var CORE = { Article: 1, Organization: 1, LocalBusiness: 1, WebSite: 1, WebPage: 1, BreadcrumbList: 1, SearchAction: 1, Place: 1, Service: 1, Country: 1 };
    var SUFFIX = ['#org', '#website', '#webpage', '#breadcrumbs', '#breadcrumb', '#service', '#person', '#place', '#primaryimage', '#faq'];
    function canonical(node) {
      var id = String((node && node['@id']) || '');
      return SUFFIX.some(function (s) { return id.indexOf(s) !== -1; });
    }
    function run() {
      var text = visText();
      document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(function (el) {
        var txt = (el.textContent || '').trim();
        if (!txt) { el.remove(); return; }
        try {
          var json = JSON.parse(txt);
          var nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
          var kept = nodes.filter(function (n) {
            var types = getTypes(n);
            if (types.some(function (t) { return CORE[t]; }) && !canonical(n)) return false;
            return true;
          }).map(function (n) { return keepFaq(n, text); }).filter(Boolean);
          var faqs = kept.filter(isFaq);
          var canonFaq = faqs.filter(function (n) { return String(n['@id'] || '').indexOf('#faq') !== -1; })[0];
          if (canonFaq) kept = kept.filter(function (n) { return !isFaq(n) || n === canonFaq; });
          else if (faqs.length > 1) kept = kept.filter(function (n) { return !isFaq(n) || n === faqs[0]; });
          if (!kept.length) { el.remove(); return; }
          if (Array.isArray(json['@graph'])) {
            json['@graph'] = kept;
            el.textContent = JSON.stringify(json);
          } else {
            el.textContent = JSON.stringify(kept[0]);
          }
        } catch (e) {}
      });
    }
    run();
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', function () { setTimeout(run, 800); });
  }
  function inject(id, data) {
    if (!data || typeof data !== 'object') return;
    var el = document.getElementById(id);
    if (el) el.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = id;
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  fetchJson(BASE + 'landings-manifest.json').then(function (manifest) {
    var pages = (manifest && manifest.pages) || {};
    var entry = pages[path];
    if (!entry || !entry.file) return;
    installSuppressor();
    return fetchJson(BASE + entry.file).then(function (schema) {
      if (!schema) return;
      var text = visText();
      var nodes = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
      var kept = nodes.map(function (n) { return keepFaq(n, text); }).filter(Boolean);
      if (Array.isArray(schema['@graph'])) schema['@graph'] = kept;
      else schema = kept[0] || null;
      if (schema) inject('arp-landing-schema', schema);
    });
  }).catch(function () {});
})();
