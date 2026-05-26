/**
 * Capacitor bridge helpers. On the web these are no-ops. When the bundle
 * runs inside a Capacitor native shell, they call into the plugin layer.
 */
(function () {
  const cap = (typeof window !== 'undefined' && window.Capacitor) || null;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

  async function plugin(name) {
    if (!isNative) return null;
    try {
      if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
      const slug = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      const mod = await import(/* @vite-ignore */ `@capacitor/${slug}`).catch(() => null);
      return (mod && (mod[name] || mod.default)) || null;
    } catch (e) { return null; }
  }

  const Haptics = {
    async light()  { const p = await plugin('Haptics'); if (p && p.impact) await p.impact({ style: 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(8); },
    async medium() { const p = await plugin('Haptics'); if (p && p.impact) await p.impact({ style: 'MEDIUM' }); else if (navigator.vibrate) navigator.vibrate(15); },
    async heavy()  { const p = await plugin('Haptics'); if (p && p.impact) await p.impact({ style: 'HEAVY' }); else if (navigator.vibrate) navigator.vibrate([20, 40, 20]); },
    async select() { const p = await plugin('Haptics'); if (p && p.selectionStart) { await p.selectionStart(); await p.selectionEnd(); } }
  };

  const StatusBar = {
    async setStyle(style) { const p = await plugin('StatusBar'); if (p && p.setStyle) await p.setStyle({ style: style }); },
    async setBackgroundColor(color) { const p = await plugin('StatusBar'); if (p && p.setBackgroundColor) await p.setBackgroundColor({ color: color }); },
    async hide() { const p = await plugin('StatusBar'); if (p && p.hide) await p.hide(); },
    async show() { const p = await plugin('StatusBar'); if (p && p.show) await p.show(); }
  };

  const SplashScreen = {
    async hide() { const p = await plugin('SplashScreen'); if (p && p.hide) await p.hide(); }
  };

  const App = {
    onBackButton(fn) {
      // Android hardware back
      plugin('App').then(p => { if (p && p.addListener) p.addListener('backButton', fn); });
    },
    onResume(fn) { plugin('App').then(p => { if (p && p.addListener) p.addListener('resume', fn); }); },
    onPause(fn)  { plugin('App').then(p => { if (p && p.addListener) p.addListener('pause', fn); }); }
  };

  window.MGNative = { isNative: isNative, Haptics: Haptics, StatusBar: StatusBar, SplashScreen: SplashScreen, App: App };

  // Auto-hide splash a little after first paint on native shells.
  if (isNative) {
    setTimeout(() => SplashScreen.hide(), 800);
  }
})();
