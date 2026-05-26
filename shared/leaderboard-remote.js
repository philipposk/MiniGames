/**
 * Opt-in global leaderboard backed by Supabase REST.
 * Disabled by default. To enable, set MGLeaderboardConfig BEFORE this script
 * loads OR set localStorage 'minigames:v1:remote-lb-config' to a JSON blob like:
 *   { url: "https://xxxxx.supabase.co", anonKey: "eyJhbG...", hmac: "<server-shared-secret>" }
 * The HMAC secret is only used to sign score submissions, not to identify the
 * player. If hmac is absent, submissions are still attempted (server-side row
 * level security must then enforce rate limits + sanity checks on its own).
 *
 * Public API:
 *   MGRemote.enabled()                       -> bool
 *   MGRemote.submit(gameId, mode, entry)     -> Promise<{ok, status, error?}>
 *   MGRemote.top(gameId, mode, opts)         -> Promise<Array<entry>>
 *
 * Schema (single table 'scores'):
 *   id uuid PK
 *   created_at timestamptz default now()
 *   game_id text not null
 *   mode text not null
 *   player_id uuid not null
 *   display_name text
 *   score int4 not null
 *   detail text
 *   payload jsonb default '{}'::jsonb
 *   signature text
 *
 * RLS:
 *   - SELECT: public
 *   - INSERT: public, but a CHECK constraint enforces:
 *       length(display_name) <= 24
 *       score >= 0 AND score <= 1e9
 *       game_id IN ('bounce-ball','color-clash',...,'piano-tap')
 *   - UPDATE/DELETE: none
 *   - A Postgres trigger may verify signature if you store the HMAC secret
 *     in a Vault.
 */
(function () {
  const KEY = 'minigames:v1:remote-lb-config';
  const NS = 'MGLeaderboardConfig';
  function getConfig() {
    if (typeof window !== 'undefined' && window[NS]) return window[NS];
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const cfg = JSON.parse(raw);
      if (cfg && cfg.url && cfg.anonKey) return cfg;
    } catch (e) {}
    return null;
  }
  function enabled() { return !!getConfig(); }

  async function hmacHex(key, msg) {
    try {
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
      return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return ''; }
  }

  function canonical(payload) {
    // Canonical JSON: keys sorted, no whitespace. Server must do the same.
    const keys = Object.keys(payload).sort();
    const out = {};
    for (const k of keys) out[k] = payload[k];
    return JSON.stringify(out);
  }

  async function submit(gameId, mode, entry) {
    const cfg = getConfig();
    if (!cfg) return { ok: false, status: 0, error: 'remote-disabled' };
    const playerId = (window.MGIdentity && MGIdentity.uuid()) || null;
    const displayName = (window.MGIdentity && MGIdentity.name()) || (entry && entry.name) || '';
    const score = (entry && entry.score) | 0;
    if (score < 0 || score > 1e9) return { ok: false, status: 0, error: 'score-out-of-range' };
    if (!playerId) return { ok: false, status: 0, error: 'no-player-id' };

    const payload = {
      game_id: gameId,
      mode: mode || 'default',
      player_id: playerId,
      display_name: (displayName || '').toString().slice(0, 24),
      score: score,
      detail: ((entry && entry.detail) || '').toString().slice(0, 80),
      payload: (entry && entry.payload) || {}
    };
    let signature = '';
    if (cfg.hmac) signature = await hmacHex(cfg.hmac, canonical(payload));

    try {
      const r = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/scores', {
        method: 'POST',
        headers: {
          'apikey': cfg.anonKey,
          'authorization': 'Bearer ' + cfg.anonKey,
          'content-type': 'application/json',
          'prefer': 'return=minimal'
        },
        body: JSON.stringify(Object.assign({}, payload, signature ? { signature } : {}))
      });
      return { ok: r.ok, status: r.status, error: r.ok ? undefined : await r.text().catch(() => '') };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  }

  async function top(gameId, mode, opts) {
    const cfg = getConfig();
    if (!cfg) return [];
    const limit = (opts && opts.limit) || 10;
    const filter = `game_id=eq.${encodeURIComponent(gameId)}&mode=eq.${encodeURIComponent(mode || 'default')}`;
    const url = cfg.url.replace(/\/$/, '') + `/rest/v1/scores?select=display_name,score,detail,created_at,player_id&${filter}&order=score.desc&limit=${limit}`;
    try {
      const r = await fetch(url, {
        headers: {
          'apikey': cfg.anonKey,
          'authorization': 'Bearer ' + cfg.anonKey
        }
      });
      if (!r.ok) return [];
      return await r.json();
    } catch (e) { return []; }
  }

  window.MGRemote = { enabled: enabled, submit: submit, top: top };
})();
