# Global Leaderboard Setup

The arcade ships with **local-only** leaderboards by default. Every game
also has an *opt-in* global leaderboard that talks to a free
[Supabase](https://supabase.com) project. Until you set it up, the
GLOBAL toggle simply never appears.

This file explains:

1. What you're signing up for in plain language
2. Creating a free Supabase project
3. The full SQL schema (paste & run)
4. Turning the feature on for yourself or your players
5. (Optional) HMAC signing to make the API harder to spam
6. Rotating the HMAC secret
7. Caveats — what you cannot prevent

---

## 1. What this actually does

When enabled, after a player saves a local high score the game also
fires one HTTP POST to your Supabase `scores` table. The GLOBAL tab
reads the top 10 from that table.

What gets sent:

- `game_id` (e.g. `bounce-ball`)
- `mode` (e.g. `level-3`, `daily-2026-05-26`)
- `player_id` — the anonymous UUID stored in the player's browser
- `display_name` — whatever they typed in (or auto-suggested)
- `score`
- `detail` — small text like `"L3 • 42s"`
- `payload` — small JSON blob for game-specific extras

No emails, no accounts, no real names. The UUID lives in `localStorage`
and never leaves their device unless they post a score.

---

## 2. Create a free Supabase project

1. Go to https://supabase.com and sign up (GitHub auth is fine).
2. Create a new project. Pick the free tier region closest to your
   players.
3. Wait ~2 minutes for it to provision.
4. Go to **Project Settings → API**. You will need two values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key** (a long `eyJhbGc…` JWT)

These are both safe-by-design to ship publicly. Real protection comes
from Row Level Security (next step).

---

## 3. SQL schema (run once)

Open **SQL Editor** in the Supabase dashboard and paste the entire
block below, then click *Run*.

```sql
-- Allowed game IDs (lowercase, hyphenated, must match the games' folders)
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id text not null,
  mode text not null,
  player_id uuid not null,
  display_name text,
  score int4 not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  signature text,

  -- Sanity checks. These are enforced by Postgres, not by your client.
  constraint score_range check (score >= 0 and score <= 1000000000),
  constraint name_length check (display_name is null or length(display_name) <= 24),
  constraint detail_length check (detail is null or length(detail) <= 80),
  constraint game_id_allowed check (game_id in (
    'bounce-ball','color-clash','crossy-hop','helix-drop',
    'piano-tap','stick-runner','the-rising'
  ))
);

-- Indexes so the "top N for this game+mode" query is cheap.
create index if not exists scores_game_mode_score_idx
  on scores (game_id, mode, score desc, created_at desc);
create index if not exists scores_created_at_idx
  on scores (created_at desc);

-- Row Level Security
alter table scores enable row level security;

-- Anyone may READ scores (the whole point of a public leaderboard).
drop policy if exists "scores_select_public" on scores;
create policy "scores_select_public"
  on scores for select
  using (true);

-- Anyone may INSERT a score, subject to the check constraints above.
drop policy if exists "scores_insert_public" on scores;
create policy "scores_insert_public"
  on scores for insert
  with check (true);

-- Nobody (including anon) can UPDATE or DELETE. No policies = no access.
```

That's it for the minimum viable setup. The leaderboard now works.

---

## 4. Turn it on (browser-side)

The feature ships disabled. To enable it, set a config blob in
`localStorage` on each device where you want global scores. There are
three ways:

### Option A — One-off bookmarklet (easiest for end users)

Drag this link to your bookmarks bar, edit the URL fields, then click
it once on `philipposk.github.io/MiniGames/`:

```js
javascript:(function(){const cfg={url:'https://YOURPROJECT.supabase.co',anonKey:'YOUR_ANON_KEY'};localStorage.setItem('minigames:v1:remote-lb-config',JSON.stringify(cfg));alert('Global leaderboard enabled. Refresh the page.');})();
```

To disable: `localStorage.removeItem('minigames:v1:remote-lb-config')`.

### Option B — Devtools paste

```js
localStorage.setItem('minigames:v1:remote-lb-config', JSON.stringify({
  url: 'https://YOURPROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY'
  // hmac: 'optional-shared-secret'   // see step 5
}));
location.reload();
```

### Option C — Hard-coded global (for native shells / forks)

Set `window.MGLeaderboardConfig` *before* `leaderboard-remote.js`
loads, e.g. in `index.html`:

```html
<script>
  window.MGLeaderboardConfig = {
    url: 'https://YOURPROJECT.supabase.co',
    anonKey: 'YOUR_ANON_KEY'
  };
</script>
```

Reload the page. You should now see a `LOCAL / GLOBAL` toggle in every
leaderboard screen.

---

## 5. (Optional) HMAC signing

The anon key is public. Anyone with curl can spam your `scores` table.
Row-level constraints stop the worst abuse (score ≤ 1B, name ≤ 24
chars, only valid game IDs), but a determined troll can still flood
the table.

If you want to require a shared secret before a score sticks, add the
trigger below. Then put the *same* secret in your client config:

```js
{ url: '…', anonKey: '…', hmac: 'long-random-string-min-32-chars' }
```

### 5a. Store the secret in Supabase Vault

In the dashboard → **Settings → Vault**, add a new secret named
`scores_hmac` with the value of your shared secret.

### 5b. Verify-on-insert trigger

```sql
create extension if not exists pgcrypto with schema extensions;

create or replace function verify_score_signature()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_canonical text;
  v_expected text;
begin
  -- Read the shared secret from Vault.
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'scores_hmac' limit 1;

  if v_secret is null then
    -- Vault not configured → fail closed.
    raise exception 'HMAC secret not configured';
  end if;

  -- Canonical JSON: keys alphabetically sorted, no whitespace.
  -- Must EXACTLY match shared/leaderboard-remote.js canonical().
  v_canonical := jsonb_build_object(
    'detail',       coalesce(new.detail, ''),
    'display_name', coalesce(new.display_name, ''),
    'game_id',      new.game_id,
    'mode',         new.mode,
    'payload',      new.payload,
    'player_id',    new.player_id::text,
    'score',        new.score
  )::text;

  v_expected := encode(
    extensions.hmac(v_canonical::bytea, v_secret::bytea, 'sha256'),
    'hex'
  );

  if new.signature is null or new.signature <> v_expected then
    raise exception 'invalid signature';
  end if;

  return new;
end;
$$;

drop trigger if exists scores_verify_signature on scores;
create trigger scores_verify_signature
  before insert on scores
  for each row
  execute function verify_score_signature();
```

Once this trigger is live, every insert without a matching `signature`
column is rejected. A casual `curl` attacker who only has the anon key
can no longer write rows.

**Note:** the canonical JSON ordering must be byte-for-byte identical
on client and server. The client (`shared/leaderboard-remote.js`)
sorts keys alphabetically and emits compact JSON with `JSON.stringify`.
The Postgres helper above builds the equivalent string in the same
key order.

---

## 6. Rotating the HMAC secret

1. Generate a new random string (≥ 32 chars).
2. In Supabase Vault → update `scores_hmac` to the new value.
3. Push a new client config containing the new `hmac` value.
4. Existing players will need to refresh `localStorage` (bookmarklet
   again, or wait until they auto-update via the deployed `index.html`).

Old signatures stop validating the moment you change the secret, so
plan a brief window where some scores fail to post.

---

## 7. Caveats — read this before turning it on

- **The anon key is public by design.** Anyone who views your site
  source can see it. Your *only* real defences are:
  - The Postgres CHECK constraints (score range, name length, allowed
    game IDs).
  - The HMAC trigger above (if you set one up).
  - Supabase rate limits (free tier: 60 req/min/IP by default).
- **Player IDs are not authenticated.** Two devices can submit under
  the same `player_id` if the user manually pastes a UUID. Treat the
  leaderboard as social/fun, not authoritative.
- **Display names can collide.** The client clips to 24 chars; there
  is no uniqueness check.
- **iOS Safari quirks.**
  - `localStorage` is cleared after ~7 days of inactivity (ITP). A
    fresh `player_id` will be generated next visit and old scores will
    show up under a "new" player.
  - The `crypto.subtle` HMAC requires HTTPS in Safari. On `file://`
    or `http://`, signing silently no-ops and the score will be
    rejected by your trigger.
- **No DELETE for users.** Players cannot delete their own scores by
  default. Add an `authenticated` policy if you want self-delete.
- **GDPR / Privacy.** The UUID is "online identifier" data under GDPR.
  Mention the global leaderboard in `PRIVACY.md` if you ship this on.
  Players who never tap GLOBAL never have a row written.

If any of the above is a dealbreaker, just don't set
`MGLeaderboardConfig` and the feature stays invisible.
