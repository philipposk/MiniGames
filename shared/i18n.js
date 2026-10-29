/* MiniGames i18n: EL / EN / TR.
 * Language comes from ?lang=, then localStorage, then the browser.
 * Games are written in English; this file swaps visible text (DOM text,
 * aria-label/title/placeholder, and canvas fillText) through a dictionary,
 * so a game only has to load this script and its own dictionary file.
 */
(function () {
  'use strict';
  var LANGS = ['el', 'en', 'tr'];
  var KEY = 'mg_lang';
  function pick() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && LANGS.indexOf(q) >= 0) { localStorage.setItem(KEY, q); return q; }
      var s = localStorage.getItem(KEY);
      if (s && LANGS.indexOf(s) >= 0) return s;
    } catch (e) {}
    var n = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS.indexOf(n) >= 0 ? n : 'en';
  }
  var lang = pick();
  var DEBUG = /[?&]i18n_debug=1/.test(location.search), MISSING = window.__i18nMissing = {};
  document.documentElement.lang = lang;

  var COMMON = {"Settings":{"el":"Ρυθμίσεις","tr":"Ayarlar"},"Leaderboard":{"el":"Κατάταξη","tr":"Sıralama"},"How to play":{"el":"Πώς παίζεται","tr":"Nasıl oynanır"},"Credits":{"el":"Συντελεστές","tr":"Emeği geçenler"},"Achievements":{"el":"Επιτεύγματα","tr":"Başarımlar"},"Achievement":{"el":"Επίτευγμα","tr":"Başarım"},"Play":{"el":"Παίξε","tr":"Oyna"},"Play again":{"el":"Παίξε ξανά","tr":"Tekrar oyna"},"Menu":{"el":"Μενού","tr":"Menü"},"Main menu":{"el":"Κύριο μενού","tr":"Ana menü"},"Back to menu":{"el":"Πίσω στο μενού","tr":"Menüye dön"},"Quit to menu":{"el":"Έξοδος στο μενού","tr":"Menüye çık"},"Back":{"el":"Πίσω","tr":"Geri"},"‹ Back":{"el":"‹ Πίσω","tr":"‹ Geri"},"Resume":{"el":"Συνέχεια","tr":"Devam"},"Paused":{"el":"Παύση","tr":"Duraklatıldı"},"Pause":{"el":"Παύση","tr":"Duraklat"},"Quit":{"el":"Έξοδος","tr":"Çık"},"Restart":{"el":"Από την αρχή","tr":"Yeniden başlat"},"Retry":{"el":"Ξανά","tr":"Tekrar dene"},"Try again!":{"el":"Ξαναπροσπάθησε!","tr":"Tekrar dene!"},"Next":{"el":"Επόμενο","tr":"Sonraki"},"Continue":{"el":"Συνέχεια","tr":"Devam"},"Game over":{"el":"Τέλος παιχνιδιού","tr":"Oyun bitti"},"Score":{"el":"Σκορ","tr":"Skor"},"Final score":{"el":"Τελικό σκορ","tr":"Son skor"},"Best":{"el":"Ρεκόρ","tr":"En iyi"},"High score":{"el":"Ρεκόρ","tr":"Rekor"},"New high score":{"el":"Νέο ρεκόρ","tr":"Yeni rekor"},"New record!":{"el":"Νέο ρεκόρ!","tr":"Yeni rekor!"},"New best!":{"el":"Νέο ρεκόρ!","tr":"Yeni rekor!"},"Level":{"el":"Επίπεδο","tr":"Seviye"},"Levels":{"el":"Επίπεδα","tr":"Seviyeler"},"Lives":{"el":"Ζωές","tr":"Can"},"Coins":{"el":"Νομίσματα","tr":"Jeton"},"Time":{"el":"Χρόνος","tr":"Süre"},"Distance":{"el":"Απόσταση","tr":"Mesafe"},"Speed":{"el":"Ταχύτητα","tr":"Hız"},"Combo":{"el":"Σερί","tr":"Kombo"},"Daily":{"el":"Ημερήσιο","tr":"Günlük"},"Daily challenge":{"el":"Ημερήσια πρόκληση","tr":"Günlük meydan okuma"},"Shop":{"el":"Κατάστημα","tr":"Mağaza"},"Share":{"el":"Κοινοποίηση","tr":"Paylaş"},"Save":{"el":"Αποθήκευση","tr":"Kaydet"},"Copy":{"el":"Αντιγραφή","tr":"Kopyala"},"Suggest":{"el":"Πρόταση","tr":"Öner"},"Owned":{"el":"Το έχεις","tr":"Sahipsin"},"Equipped":{"el":"Σε χρήση","tr":"Kuşanıldı"},"Selected":{"el":"Επιλεγμένο","tr":"Seçili"},"Unlocked":{"el":"Ξεκλείδωτο","tr":"Kilidi açıldı"},"Locked":{"el":"Κλειδωμένο","tr":"Kilitli"},"Need":{"el":"Χρειάζεσαι","tr":"Gerekli"},"Max":{"el":"Μέγιστο","tr":"Maks"},"On":{"el":"Ναι","tr":"Açık"},"Off":{"el":"Όχι","tr":"Kapalı"},"Auto":{"el":"Αυτόματο","tr":"Otomatik"},"Theme":{"el":"Θέμα","tr":"Tema"},"Light":{"el":"Φωτεινό","tr":"Açık"},"Dark":{"el":"Σκούρο","tr":"Koyu"},"Haptics":{"el":"Δόνηση","tr":"Titreşim"},"Sound":{"el":"Ήχος","tr":"Ses"},"Sound on":{"el":"Ήχος: ναι","tr":"Ses açık"},"Sound off":{"el":"Ήχος: όχι","tr":"Ses kapalı"},"Toggle sound":{"el":"Ήχος ναι/όχι","tr":"Sesi aç/kapat"},"SFX volume":{"el":"Ένταση εφέ","tr":"Efekt sesi"},"Music volume":{"el":"Ένταση μουσικής","tr":"Müzik sesi"},"Ambience volume":{"el":"Ένταση ατμόσφαιρας","tr":"Ortam sesi"},"Reduced motion":{"el":"Λιγότερη κίνηση","tr":"Azaltılmış hareket"},"Colorblind mode":{"el":"Λειτουργία αχρωματοψίας","tr":"Renk körlüğü modu"},"Color-blind mode":{"el":"Λειτουργία αχρωματοψίας","tr":"Renk körlüğü modu"},"Colorblind palette":{"el":"Παλέτα αχρωματοψίας","tr":"Renk körü paleti"},"Language":{"el":"Γλώσσα","tr":"Dil"},"Difficulty":{"el":"Δυσκολία","tr":"Zorluk"},"Easy":{"el":"Εύκολο","tr":"Kolay"},"Normal":{"el":"Κανονικό","tr":"Normal"},"Hard":{"el":"Δύσκολο","tr":"Zor"},"Slow":{"el":"Αργά","tr":"Yavaş"},"Fast":{"el":"Γρήγορα","tr":"Hızlı"},"Turbo":{"el":"Τούρμπο","tr":"Turbo"},"Classic":{"el":"Κλασικό","tr":"Klasik"},"Local":{"el":"Τοπικά","tr":"Yerel"},"Global":{"el":"Παγκόσμια","tr":"Küresel"},"You":{"el":"Εσύ","tr":"Sen"},"Anonymous":{"el":"Ανώνυμος","tr":"Anonim"},"Your name":{"el":"Το όνομά σου","tr":"Adın"},"Player":{"el":"Παίκτης","tr":"Oyuncu"},"Player name":{"el":"Όνομα παίκτη","tr":"Oyuncu adı"},"Player ID":{"el":"Κωδικός παίκτη","tr":"Oyuncu kimliği"},"Player ID copied":{"el":"Ο κωδικός αντιγράφηκε","tr":"Kimlik kopyalandı"},"Suggest a name":{"el":"Πρότεινε όνομα","tr":"Bir ad öner"},"3-letter name":{"el":"Όνομα 3 γραμμάτων","tr":"3 harfli ad"},"3 letter name":{"el":"Όνομα 3 γραμμάτων","tr":"3 harfli ad"},"Loading…":{"el":"Φόρτωση…","tr":"Yükleniyor…"},"Reset progress":{"el":"Μηδενισμός προόδου","tr":"İlerlemeyi sıfırla"},"Reset all data":{"el":"Διαγραφή όλων","tr":"Tüm verileri sıfırla"},"Progress reset.":{"el":"Η πρόοδος μηδενίστηκε.","tr":"İlerleme sıfırlandı."},"Reset.":{"el":"Μηδενίστηκε.","tr":"Sıfırlandı."},"Sharing unavailable":{"el":"Η κοινοποίηση δεν είναι διαθέσιμη","tr":"Paylaşım kullanılamıyor"},"No scores yet.":{"el":"Δεν υπάρχουν σκορ ακόμα.","tr":"Henüz skor yok."},"No scores yet":{"el":"Δεν υπάρχουν σκορ ακόμα","tr":"Henüz skor yok"},"No global scores":{"el":"Κανένα παγκόσμιο σκορ","tr":"Küresel skor yok"},"No global scores yet.":{"el":"Κανένα παγκόσμιο σκορ ακόμα.","tr":"Henüz küresel skor yok."},"No scores yet. Be the first.":{"el":"Κανένα σκορ ακόμα. Γίνε ο πρώτος.","tr":"Henüz skor yok. İlk sen ol."},"Today":{"el":"Σήμερα","tr":"Bugün"},"Hello":{"el":"Γεια","tr":"Merhaba"},"Mono":{"el":"Μονόχρωμο","tr":"Tek renk"},"Neon":{"el":"Νέον","tr":"Neon"},"Pastel":{"el":"Παστέλ","tr":"Pastel"},"Gold":{"el":"Χρυσό","tr":"Altın"},"Marathon":{"el":"Μαραθώνιος","tr":"Maraton"},"Keyboard":{"el":"Πληκτρολόγιο","tr":"Klavye"},"Mouse":{"el":"Ποντίκι","tr":"Fare"},"Touch":{"el":"Αφή","tr":"Dokunma"},"Game":{"el":"Παιχνίδι","tr":"Oyun"},"Games":{"el":"Παιχνίδια","tr":"Oyunlar"},"‹ Games":{"el":"‹ Παιχνίδια","tr":"‹ Oyunlar"},"Back to games":{"el":"Πίσω στα παιχνίδια","tr":"Oyunlara dön"},"← Back to the arcade":{"el":"← Πίσω στα παιχνίδια","tr":"← Oyunlara dön"},"Perfect":{"el":"Τέλειο","tr":"Mükemmel"},"Perfect!":{"el":"Τέλειο!","tr":"Mükemmel!"},"Great":{"el":"Πολύ καλό","tr":"Harika"},"Great!":{"el":"Πολύ καλό!","tr":"Harika!"},"Good":{"el":"Καλό","tr":"İyi"},"Good!":{"el":"Καλό!","tr":"İyi!"},"Okay":{"el":"Οκ","tr":"Tamam"},"Okay!":{"el":"Οκ!","tr":"Tamam!"},"OK":{"el":"Οκ","tr":"Tamam"},"Miss":{"el":"Άστοχο","tr":"Iska"},"Miss!":{"el":"Άστοχο!","tr":"Iska!"},"Missed":{"el":"Χάθηκε","tr":"Kaçtı"},"Late":{"el":"Αργά","tr":"Geç"},"Nice":{"el":"Ωραία","tr":"Güzel"},"Time up":{"el":"Τέλος χρόνου","tr":"Süre doldu"}};
  // dict: { "English text": { el: "...", tr: "..." } }, case-insensitive fallback
  var dict = Object.create(null);
  var lower = Object.create(null);
  var RULES = [
    [/^Level (\d+) locked$/i, { el: 'Επίπεδο $1, κλειδωμένο', tr: 'Seviye $1 kilitli' }],
    [/^Level (\d+) \((\d+) stars?\)$/i, { el: 'Επίπεδο $1 ($2 αστέρια)', tr: 'Seviye $1 ($2 yıldız)' }],
    [/^Locked — clear level (\d+) first\.$/, { el: 'Κλειδωμένο — πέρασε πρώτα το επίπεδο $1.', tr: 'Kilitli — önce $1. seviyeyi geç.' }],
    [/^Need ([\d.,]+) total score$/i, { el: 'Χρειάζεσαι συνολικό σκορ $1', tr: 'Toplam $1 skor gerekli' }],
    [/^(.+) costs ([\d.,]+) coins$/, { el: '$1: $2 νομίσματα', tr: '$1: $2 jeton' }],
    [/^([\d.,]+[KMBT]?) lifetime grit$/i, { el: '$1 συνολική άμμος', tr: '$1 toplam kum' }],
    [/^NEED ([\d.,]+[KMBT]?) LIFETIME GRIT$/, { el: 'ΧΡΕΙΑΖΕΣΑΙ $1 ΣΥΝΟΛΙΚΗ ΑΜΜΟ', tr: '$1 TOPLAM KUM GEREKLİ' }],
    [/^lvl (\d+)\/(\d+)$/, { el: 'επ. $1/$2', tr: 'sv. $1/$2' }],
    [/^Preview (.+)$/, { el: 'Προεπισκόπηση: $1', tr: 'Önizleme: $1' }],
    [/^(\d+) BPM · (.+)$/, { el: '$1 BPM · $2', tr: '$1 BPM · $2' }],
  ];
  function add(d) {
    for (var k in d) { dict[k] = d[k]; lower[k.toLowerCase()] = d[k]; }
  }
  function isUpper(s) { return /[A-Z]/.test(s) && s === s.toUpperCase(); }
  function up(s) { return lang === 'tr' ? s.toLocaleUpperCase('tr') : s.toLocaleUpperCase(lang); }
  function lookup(s) {
    var e = dict[s];
    if (e && e[lang] != null) return e[lang];
    e = lower[s.toLowerCase()];
    if (e && e[lang] != null) return isUpper(s) ? up(e[lang]) : e[lang];
    return null;
  }
  // "Score: 12", "BEST 40", "Level 3", "12 grit" style strings.
  var NUM = /^(.*?)([\s:·]*)([-+]?[\d.,]+\s*(?:m|s|x|%|ms)?)$/;
  var LEAD = /^([-+]?[\d.,]+\s*)(.+)$/;
  function t(s) {
    if (lang === 'en' || s == null) return s;
    var str = String(s);
    var m = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var core = m[2];
    if (!core || !/[A-Za-z]/.test(core)) return str;
    var r = lookup(core);
    if (r == null) for (var ri = 0; ri < RULES.length; ri++) {
      var mm = core.match(RULES[ri][0]);
      if (mm && RULES[ri][1][lang] != null) {
        r = RULES[ri][1][lang].replace(/\$(\d)/g, function (_, n) { var v = mm[+n] || ''; var tv = lookup(v); return tv == null ? v : tv; });
        break;
      }
    }
    if (r == null) {
      var a = core.match(NUM);
      if (a && a[1] && /[A-Za-z]/.test(a[1])) {
        var lab = lookup(a[1].trim());
        if (lab != null) r = lab + a[2] + a[3];
      }
    }
    if (r == null) {
      var b = core.match(LEAD);
      if (b) { var tail = lookup(b[2].trim()); if (tail != null) r = b[1] + tail; }
    }
    if (r == null) {
      // trailing punctuation / emoji kept as is
      var c = core.match(/^([^A-Za-z]*)(.*?[A-Za-z.!?])([^A-Za-z]*)$/);
      if (c && (c[1] || c[3])) { var mid = lookup(c[2]); if (mid != null) r = c[1] + mid + c[3]; }
    }
    if (r == null && DEBUG) MISSING[core] = 1;
    return r == null ? str : m[1] + r + m[3];
  }

  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  var done = new WeakMap();
  function tNode(n) {
    var v = n.nodeValue;
    if (done.get(n) === v) return;
    var r = t(v);
    if (r !== v) n.nodeValue = r;
    done.set(n, n.nodeValue);
  }
  function tEl(el) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || el.hasAttribute('data-no-i18n')) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a) { var r = t(a); if (r !== a) el.setAttribute(ATTRS[i], r); }
    }
    if ((tag === 'INPUT') && (el.type === 'button' || el.type === 'submit') && el.value) {
      var rv = t(el.value); if (rv !== el.value) el.value = rv;
    }
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        var p = n.parentNode;
        if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || (p.closest && p.closest('[data-no-i18n]')))) continue;
        tNode(n);
      } else {
        for (var j = 0; j < ATTRS.length; j++) {
          var av = n.getAttribute(ATTRS[j]);
          if (av) { var ar = t(av); if (ar !== av) n.setAttribute(ATTRS[j], ar); }
        }
      }
    }
  }
  function run() {
    if (lang === 'en') return;
    tEl(document.body);
    if (document.title) document.title = t(document.title);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') tNode(m.target);
        else if (m.type === 'attributes') tEl(m.target);
        else for (var k = 0; k < m.addedNodes.length; k++) {
          var a = m.addedNodes[k];
          if (a.nodeType === 3) tNode(a); else tEl(a);
        }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Canvas text
  if (window.CanvasRenderingContext2D) {
    var P = CanvasRenderingContext2D.prototype;
    ['fillText', 'strokeText', 'measureText'].forEach(function (fn) {
      var orig = P[fn];
      P[fn] = function (text) {
        var args = Array.prototype.slice.call(arguments);
        if (lang !== 'en' && typeof text === 'string') args[0] = t(text);
        return orig.apply(this, args);
      };
    });
  }

  // Native dialogs used by some games
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var o = window[fn];
    if (!o) return;
    window[fn] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === 'string') args[0] = t(msg);
      return o.apply(window, args);
    };
  });

  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    var u = new URL(location.href);
    u.searchParams.set('lang', l);
    location.replace(u.toString());
  }

  window.MGI18n = { lang: lang, langs: LANGS, t: t, add: add, setLang: setLang, apply: function (el) { tEl(el || document.body); } };
  add(COMMON);
  if (window.MG_DICT) add(window.MG_DICT);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
