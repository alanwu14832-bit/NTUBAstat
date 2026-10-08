# NTUBAstat — notes for Claude

The 臺大棒球隊 (NTU varsity baseball) stats site: live pitch-by-pitch recording, live score, game logs, player and team stats.
Forked from NTU BaFiN's `alanwu14832-bit/bafinstat`; the two repos are independent now. The people who maintain this one
are not developers: talk to them in Traditional Chinese, plainly, and tell them exactly what to click when something
needs doing outside the code (Supabase, Cloudflare, GitHub settings). Setup and operations are in docs/SETUP.md and
docs/HANDOVER.md; keep those in step with what you change.

## Two sites, one change (the user's standing rule)
The same code also runs NTU BaFiN 系隊's site, `alanwu14832-bit/bafinstat` (Vercel, its own Supabase).
**Every feature, fix or layout change goes into both repos unless the user says only one.** Add the other repo to the
session, port the change (`web/src` is shared code; team-specific parts are `web/src/config/teamDefaults.ts`, docs,
hosting and workflows), run `npm test` in each `web/`, push each through its `claude/...` branch, and check both deploys.
A database change needs a migration in both repos, and the user must run it in both Supabase projects — say so.

## Layout
- `web/` — the site (Vite + React 19 + TypeScript + Tailwind 4 + zustand). `npm ci`, `npm test`, `npm run build` from `web/`.
- `supabase/schema.sql` — the whole database, idempotent. `supabase/migrations/` — changes after the first setup.
- `tools/build_workbook.py` — the Excel 總表. `BLANK=1 TEAM_NAME=NTUBT TEAM_INNINGS=9 python3 tools/build_workbook.py`
  writes the blank template the site hands out (`data/棒球數據總表.xlsx`, copied into `web/public` by the prebuild).
- `data/` (`games/`, `legacy/`, `BAFIN_棒球數據總表.xlsx`) and `web/src/data/seed/` — BaFiN's sample games, **test
  fixtures only**. The site never ships them (`__TEAM_SEED__` is false outside `vite test`).

## Rules
- Team identity (name as written in games, display names, innings, file prefix) lives in `web/src/config/teamDefaults.ts`.
  Tests run as BaFiN with its 7 innings (`test.env` in `web/vite.config.ts`) because the fixtures are BaFiN's games.
- Ship through a `claude/...` branch: `.github/workflows/auto-deploy.yml` runs tests + build and merges into `main`;
  Cloudflare deploys `main`. Run `npm test` and `npm run build` in `web/` before pushing.
- Database change: add an idempotent `supabase/migrations/<yyyy-mm-dd>_<what>.sql`, apply the same change to
  `schema.sql`, and tell the maintainer to run the migration in Supabase → SQL Editor. The site must keep working before
  it is run (see how `runner` / `errors` / `day_roster` fall back and warn in `web/src/data/supabase.ts`).
- Never put the Supabase service_role key (or any secret) in the site; everything the browser does uses the anon key and
  row-level security. Writes are allowed only for the account bound to an `editors` row (`is_bound_editor()` checks
  `user_id = auth.uid()`; binding is by 邀請碼, email code or the admin — see `supabase/migrations/2026-10-08_security.sql`
  and docs/SECURITY.md), or for a live 快速登入 session (anonymous sign-in + the shared password checked in the database,
  `quick_sessions`; `supabase/migrations/2026-10-10_quick_login.sql`). `is_editor()` = either; the 紀錄員名單,
  `audit_log` and the quick password itself stay with `is_bound_editor()`. Never check that password in the site. Never write an email into a public table (`updated_by`/`created_by` are stamped by a trigger),
  and keep the Content-Security-Policy (`web/src/config/security.ts`) and `web/public/_headers` when adding features.
- Hosting is Cloudflare Workers static assets (`web/wrangler.jsonc`, root directory `web`, deploy command
  `npx wrangler deploy`; the maintainer is paid, so Vercel Hobby is not allowed). SPA routing comes from
  `not_found_handling: single-page-application`; do not add a `404.html`.
- `record/sim.test.ts` plays 150 random games through the recording model: keep it green when touching recording or the
  runner timeline.
- 網站版本: `auto-deploy.yml` builds each live version as a read-only copy (VITE_ARCHIVE_ID, base /v/<id>/) into the
  `site-archive` branch (last 30); `web/scripts/archive.mjs` (postbuild) serves them at /v/<id>/; `public/boot.js` hands
  deep links into a copy over to it. Archived copies never sign in (config/archive.ts).
