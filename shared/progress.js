/* MiniGames progress — local-only score/play tracking.
 * Usage:
 *   MGProgress.report('stick-runner', 128, { unit: 'm' });
 *   MGProgress.report('color-clash', 42, { unit: 'pts' });
 *   MGProgress.report('rock-simulator', 31, { unit: 'sec', higherIsBetter: false });
 */
(function () {
  'use strict';
  var KEY = 'minigames:v1:progress';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var value = raw ? JSON.parse(raw) : {};
      return value && typeof value === 'object' ? value : {};
    } catch (e) { return {}; }
  }

  function write(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (e) {}
    emit();
  }

  function emit() {
    try { window.dispatchEvent(new CustomEvent('minigames:progress')); } catch (e) {}
  }

  function get(slug) {
    var all = read();
    return all[slug] || { plays: 0, lastPlayed: 0, best: null, unit: '', higherIsBetter: true };
  }

  function report(slug, score, options) {
    if (!slug) return;
    options = options || {};
    var all = read();
    var item = all[slug] || { plays: 0, lastPlayed: 0, best: null, unit: '', higherIsBetter: true };
    item.plays = (item.plays || 0) + 1;
    item.lastPlayed = Date.now();
    if (typeof score === 'number' && isFinite(score)) {
      var higherIsBetter = options.higherIsBetter !== false;
      var current = item.best;
      var better = current === null || current === undefined ||
        (higherIsBetter ? score > current : score < current);
      if (better) {
        item.best = score;
        item.unit = options.unit || item.unit || '';
        item.higherIsBetter = higherIsBetter;
      }
    }
    all[slug] = item;
    write(all);
  }

  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    var handler = function () { callback(getAll()); };
    window.addEventListener('minigames:progress', handler);
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) handler();
    });
    return function () { window.removeEventListener('minigames:progress', handler); };
  }

  function getAll() { return read(); }

  /* Hub integration: fill any [data-stat="game-slug"] badge with local progress. */
  function renderHub() {
    var badges = document.querySelectorAll('[data-stat]');
    if (!badges.length) return;
    Array.prototype.forEach.call(badges, function (el) {
      var slug = el.getAttribute('data-stat');
      if (!slug) return;
      var item = get(slug);
      var bits = [];
      if (item.best !== null && item.best !== undefined) {
        bits.push('Best ' + item.best + (item.unit ? ' ' + item.unit : ''));
      }
      if (item.plays > 0) bits.push(item.plays + ' plays');
      el.textContent = bits.join(' · ');
    });
  }

  function initHub() {
    renderHub();
    onChange(renderHub);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }

  window.MGProgress = { report: report, get: get, getAll: getAll, onChange: onChange };
})();
