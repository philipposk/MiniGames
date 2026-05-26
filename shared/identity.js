(function () {
  const KEY_UUID = 'minigames:v1:player-uuid';
  const KEY_NAME = 'minigames:v1:player-name';
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx').replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function get(key, fb) { try { return localStorage.getItem(key) || fb; } catch (e) { return fb; } }
  function set(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function ensureUuid() {
    let u = get(KEY_UUID, null);
    if (!u) { u = uuid(); set(KEY_UUID, u); }
    return u;
  }
  function readName() { return get(KEY_NAME, ''); }
  function writeName(name) {
    const clean = (name || '').toString().slice(0, 24).replace(/[\x00-\x1f\x7f]/g, '').trim();
    set(KEY_NAME, clean);
    return clean;
  }
  function suggestedName() {
    const adjs = ['Quick','Brave','Calm','Sly','Bold','Wild','Lucky','Sharp','Witty','Sunny'];
    const nouns = ['Falcon','Otter','Comet','Phoenix','Lynx','Yeti','Sparrow','Panda','Wolf','Ember'];
    return adjs[Math.floor(Math.random()*adjs.length)] + nouns[Math.floor(Math.random()*nouns.length)];
  }
  window.MGIdentity = { uuid: ensureUuid, name: readName, setName: writeName, suggest: suggestedName };
})();
