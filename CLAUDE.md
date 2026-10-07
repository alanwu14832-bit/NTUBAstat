# NTUBAstat — notes for Claude

The 臺大棒球隊 (NTU varsity baseball) stats site: live pitch-by-pitch recording, live score, game logs, player and team stats.
Forked from NTU BaFiN's `alanwu14832-bit/bafinstat`; the two repos are independent now. The people who maintain this one
are not developers: talk to them in Traditional Chinese, plainly, and tell them exactly what to click when something
needs doing outside the code (Supabase, Cloudflare, GitHub settings). Setup and operations are in docs/SETUP.md and
docs/HANDOVER.md; keep those in step with what you change.

## Layout
- `web/` — the site (Vite + React 19 + TypeScript + Tailwind 4 + zustand). `npm ci`, `npm test`, `npm run build` from `web/`.
- `supabase/schema.sql` — the whole database, idempotent. `supabase/migrations/` — changes after the first setup.
- `tools/build_workbook.py` — the Excel 總表. `BLANK=1 TEAM_NAME=臺大棒球隊 TEAM_INNINGS=9 python3 tools/build_workbook.py`
  writes the blank template the site hands out (`data/棒球數據總表.xlsx`, copied into `web/public` by the prebuild).
- `data/` (`games/`, `legacy/`, `BAFIN_棒球數據總表.xlsx`) and `web/src/data/seed/` — BaFiN's sample games, **test
  fixtures only**. The site never ships them (`__TEAM_SEED__` is false outside `vite test`).

## Rules
- Team identity (name as written in games, display names, innings, file prefix) lives in `web/src/config/teamDefaults.ts`.
  Tests run as BaFiN with its 7 innings (`test.env` in `web/vite.config.ts`) because the fixtures are BaFiN's games.
- Ship through a `claude/...` branch: `.github/workflows/auto-deploy.yml` runs tests + build and merges into `main`;
  Cloudflare Pages deploys `main`. Run `npm test` and `npm run build` in `web/` before pushing.
- Database change: add an idempotent `supabase/migrations/<yyyy-mm-dd>_<what>.sql`, apply the same change to
  `schema.sql`, and tell the maintainer to run the migration in Supabase → SQL Editor. The site must keep working before
  it is run (see how `runner` / `errors` / `day_roster` fall back and warn in `web/src/data/supabase.ts`).
- Never put the Supabase service_role key (or any secret) in the site; everything the browser does uses the anon key and
  row-level security. Writes are allowed only for emails in `editors` (`is_editor()`).
- Hosting is Cloudflare Pages (the maintainer is paid, so Vercel Hobby is not allowed). SPA routing works because
  `web/public` has no `404.html`; do not add one.
- `record/sim.test.ts` plays 150 random games through the recording model: keep it green when touching recording or the
  runner timeline.
