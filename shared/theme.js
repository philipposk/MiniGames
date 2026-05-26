/* MiniGames theme manager — vanilla, no deps.
 * Modes: 'light' | 'dark' | 'system' (default 'system' = follow prefers-color-scheme)
 * Persists per-game (and per-hub) under a caller-supplied key.
 * Apply order: caller MUST run an inline no-flash bootstrap in <head> too.
 */
(function () {
  const KEY_DEFAULT = 'minigames:v1:theme';
  function isValid(v) { return v === 'light' || v === 'dark' || v === 'system'; }
  function readPref(key) {
    try { const v = localStorage.getItem(key); return isValid(v) ? v : 'system'; }
    catch (e) { return 'system'; }
  }
  function effective(pref) {
    if (pref === 'system') {
      return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    return pref;
  }
  function setThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'light' ? '#f6f6fb' : '#0b1020');
  }
  function apply(pref) {
    const html = document.documentElement;
    if (pref === 'system') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', pref);
    setThemeColor(effective(pref));
  }
  function listenSystem(key) {
    if (!window.matchMedia) return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = function () {
      if (readPref(key) === 'system') setThemeColor(effective('system'));
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }
  window.MGTheme = {
    init: function (key) {
      key = key || KEY_DEFAULT;
      apply(readPref(key));
      listenSystem(key);
    },
    get: function (key) { return readPref(key || KEY_DEFAULT); },
    set: function (pref, key) {
      key = key || KEY_DEFAULT;
      if (!isValid(pref)) return;
      try { localStorage.setItem(key, pref); } catch (e) {}
      apply(pref);
    },
    effective: function (key) { return effective(readPref(key || KEY_DEFAULT)); }
  };
})();
