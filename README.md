# PickIt

**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

**Bookmarks you'll actually use.** A self-hosted, single-user bookmark manager that runs entirely on Cloudflare Workers + D1. Save links, organize them with categories and tags, search them with full-text or semantic search, and let an AI model help you tidy things up.

## Features

- **Bookmarks**: add, edit, pin, soft-delete to trash, restore, duplicate detection and merging
- **Bulk editing**: select items to pin, move, delete, add / remove tags, or let AI suggest categories and tags and apply only the ones you tick in a review table
- **Organize**: nested categories (`Frontend/React`) with a **Categories** page to rename, move (pick a new parent from the tree, or drag a category onto another), merge into another category or delete them (bookmarks and sub-categories move up a level; shares follow renames), tags (rename / delete), a **Manual** sort that lets you drag bookmarks into your own order within each category, visit counts, stats dashboard
- **Search**: SQLite FTS5 full-text search, plus semantic search via embeddings. Similarity scans use compact 512-dim vectors and re-rank a shortlist with the full ones, so even 4096-dim models stay within the free plan's 10 ms CPU limit. A query, category, tags and sort can be kept as a saved search, stored server-side and synced across devices
- **AI** (optional; OpenAI, Anthropic, Gemini and any OpenAI-compatible API): auto-fill name/category/tags for new links, per-item summaries, chat over your library, batch re-organize, one-click translation of notes and summaries. AI writes in a configurable output language (default: the interface language); semantic search works across languages. Chat and embedding models are configured independently, so they can come from different providers
- **Import / export**: Markdown tables, JSON, browser bookmark HTML
- **Sharing**: public read-only links (`/s/:slug`) for a single bookmark, a live list of one or more categories (with sub-categories) and tags, or a hand-picked collection (select bookmarks on the list page → Share; drag to reorder it later on the Shares page); lists come with an RSS feed, and visitors can view them all at once or grouped by category or tag. Every link has a custom title, an optional expiry (1 / 7 / 30 / 90 days) and an optional password (stored as a salted hash; entering it unlocks the page and its RSS feed, and changing it locks out old visitors), and the **Shares** page lists all links with visit stats (page views and RSS fetches per day, unique visitors, referrers, countries, and recent visits with browser, OS and device; crawlers are skipped, a visitor reopening the same link within 30 minutes counts once, no raw IPs are stored, and the visit log is kept for 180 days)
- **Capture**: bookmarklet that opens `/add?url=...` for the current page; PickIt also installs as a PWA (add to home screen), and on Android appears in the system share sheet
- **Sign-in**: Google / GitHub via [Better Auth](https://better-auth.com), restricted to an email allowlist that can be edited in Settings (no passwords)
- **Languages**: Chinese, English and Japanese interface (header menu); the choice is saved and also used for API errors and audit summaries
- **Keyboard shortcuts**: `/` search, `N` new, `J`/`K` move between cards, `Enter` details, `O` open link, `E` edit, `P` pin; `?` lists them all
- **Theme**: follows the system light / dark setting by default; the header button cycles System → Light → Dark
- **Audit log**: every write, export, sign-in / sign-out and cron run is recorded (actor, action, target, result, IP, request details with secrets redacted) and kept for 180 days by default (adjustable from 1 day up to 10 years, or forever, on the Audit page, which also shows the log's estimated size); the **Audit** page filters by category, action, actor, result, date range (with presets) and keyword, with live and manual refresh
- **API access**: Bearer API token for scripts and integrations, plus an MCP server so AI assistants can search and add bookmarks; **webhooks** (Settings → Access & sharing) POST signed JSON (`X-PickIt-Signature: sha256=<HMAC of the body>`) when a bookmark is added, edited or deleted, or a batch job finishes, with a test button and the last delivery result
- **Batch jobs**: re-embedding, AI re-organizing, AI summaries and project activity checks (paused automatically on GitHub's rate limit) run (selected bookmarks on the home page can also be summarized directly) in small resumable steps — pause / resume, retry failed items, per-item error details. The job's settings tab drives them while open; a per-minute cron keeps them going in the background
- **Backups**: daily JSON backups to R2 (kept 30 days) plus "back up now"; the settings table lets you download, delete or restore one — merge (only missing URLs) or replace (current items go to the trash). Every restore first snapshots the current data, so it can be undone
- **Maintenance cron**: dead-link checks (a dead link gets its closest Wayback Machine snapshot, shown as "View archive"), audit-log pruning, and preview images (og:image) fetched for older bookmarks a few at a time; new ones get theirs from "AI analyze". The **Settings → Scheduled tasks** tab lists every task with its schedule (shown in your time zone; the server runs on UTC), the last run's result and error, the next run, recent runs and a “Run now” button. Per-minute tasks are logged only when they did something or failed; logs are kept 30 days.
- **Page text snapshots** (needs the R2 bucket used for backups): PickIt saves the readable text of each page (article only, no scripts or page chrome, up to 200 KB) to R2 as `content/<id>.txt`, so a bookmark stays readable after the page changes or disappears. New bookmarks are captured in the background and older ones a few per minute; the detail panel shows when it was captured, opens a reader view and can capture it again. A snapshot is never synced with the live page, and a failed refetch keeps the old text. Pages behind a login or rendered only by JavaScript may have no text.
- **Browser-rendered page text (optional)**: turn on Cloudflare Browser Rendering under Settings → Data (Account ID + an API token with the "Browser Rendering - Edit" permission) and snapshots are saved as Markdown with headings, lists, code and images, rendered in the reader view; pages built by JavaScript work too. Pages readable without JavaScript send only their article HTML to the browser, so each render stays short. Browser time is metered, so PickIt caps its own use: pick the Workers Free plan (10 min a day, 1 request per 10 s; the limit can't exceed 10 min) or Paid (10 h a month included; default limit 540 min so nothing extra is billed). Once the limit is reached, or on any error, it falls back to plain capture. The settings card shows the time used and when it resets.
- **Project activity**: GitHub repositories and npm packages show how active they are: last push / update, latest version and release date, stars or weekly downloads, and a level (active within 3 months, slowing within a year, inactive beyond, or archived / deprecated). Cards flag inactive and archived projects. New bookmarks are checked right away and all projects about weekly by the cron; the detail panel can refresh now. GitHub allows only 60 anonymous API requests an hour, so add a read-only token under **Settings → Access & sharing → GitHub Token** (or the `GITHUB_TOKEN` secret) for 5,000.

## Tech stack

| Layer | Stack |
| --- | --- |
| API | [Hono](https://hono.dev) on Cloudflare Workers, D1 (SQLite), R2 |
| Web | React 19, React Router, Vite, Tailwind CSS v4, Base UI |
| AI | [AI SDK](https://ai-sdk.dev) with OpenAI-compatible providers |
| Tooling | pnpm workspaces, TypeScript, Vitest, GitHub Actions |

```
apps/
  api/                 Worker (wrangler.jsonc), D1 migrations
    src/index.ts       App wiring: middleware order and route mounting
    src/routes/        One module per API area; routes/items/ is split by concern
    src/audit/         Audit log: storage, request description, redaction, middleware
    src/mcp/           MCP server: JSON-RPC handling and bookmark tools
    src/scheduled.ts   Cron entry (jobs, backups, link checks, audit pruning)
  web/                 React SPA, built into apps/api/dist and served as Worker assets
    src/pages/         One component per route
    src/components/    items/, settings/, audit/ feature folders; ui/ primitives
    src/hooks/         Data and behaviour hooks used by the pages
packages/
  shared/              Types and helpers shared by api and web (ai/, importers, URL normalization)
```

## Local development

Requirements: Node.js 24+, pnpm 11+.

```bash
pnpm install

# Local secrets (git-ignored)
cat > apps/api/.dev.vars <<'EOF'
BETTER_AUTH_SECRET=any-long-random-string
BETTER_AUTH_URL=http://localhost:5173
ALLOWED_EMAILS=you@example.com
# OAuth apps for local dev (callback: http://localhost:5173/api/auth/callback/<provider>)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
# Or skip OAuth and sign-in entirely (only works while BETTER_AUTH_URL is localhost)
# DEV_AUTH_BYPASS=1
EOF

pnpm db:migrate   # apply migrations to the local D1 database
pnpm dev          # web on http://localhost:5173, API on :8787
```

To import existing bookmarks, open Settings → Import / Export and upload a Markdown table, JSON file or browser bookmarks HTML file. Preview the results before importing.

| Script | Description |
| --- | --- |
| `pnpm dev` | Run web and API together |
| `pnpm typecheck` / `pnpm test` | Type-check and run tests in all packages |
| `pnpm build` | Build the web app into `apps/api/dist` |
| `pnpm db:migrate` / `pnpm db:migrate:remote` | Apply D1 migrations locally / remotely |
| `pnpm deploy` | Build and deploy the Worker |

### Translations

The interface is available in Chinese, English and Japanese. Strings live in `packages/shared/messages/{zh,en,ja}.json` (zh is the source) and are compiled by [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) into `packages/shared/src/paraglide` on `pnpm install` (or `pnpm --filter @pickit/shared i18n`). The same message functions are used by the web app and the API.

- Add a string: put it in all three files with the same key, then use `m.your_key()`. Tests fail if a language is missing a key, a message is empty, placeholders differ, or ICU plural syntax is used (Paraglide's format doesn't support it; word counts so they read correctly for any number).

### Tests

- **API route tests** (`*.int.test.ts`) run the real Worker — routes, auth and audit middleware — against an in-memory SQLite database built from the real migrations (`apps/api/src/test/`, using Node's built-in `node:sqlite`, so Node 22.13+ is required). They cover items, trash, bulk actions, import / export, search, tags, categories, shares (incl. expiry / passwords), settings, authentication, the audit log, backups / restore, bulk editing (with a stubbed AI model), webhooks (with a stubbed fetch) and MCP.
- **Unit tests** cover vectors, jobs, AI settings / URLs, importers, audit description and redaction, and the web app's API client, save flow, filters and formatting.
- A test fails if any audit action the API records has no display label.

## Deploy to Cloudflare

Workers and D1 both fit comfortably in the free tier for a personal library.

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create pickit-db          # put the printed database_id into wrangler.jsonc
pnpm db:migrate:remote
npx wrangler secret put BETTER_AUTH_SECRET   # e.g. openssl rand -base64 32
npx wrangler secret put ALLOWED_EMAILS       # owner emails, comma-separated (always allowed)
npx wrangler secret put GOOGLE_CLIENT_ID     # and GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
cd ../.. && pnpm deploy
```

### Sign-in (Google / GitHub)

Sign-in uses [Better Auth](https://better-auth.com) with Google and GitHub; there is no password login. Set `BETTER_AUTH_URL` in `wrangler.jsonc` `vars` to your public origin, then create the OAuth apps with these callback URLs:

| Provider | Where | Callback URL |
| --- | --- | --- |
| Google | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application) | `https://your-domain/api/auth/callback/google` |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps | `https://your-domain/api/auth/callback/github` |

Only allowed emails can sign in; every other Google / GitHub account is rejected. The allowlist has two parts: owner emails from the `ALLOWED_EMAILS` secret, which are always allowed and can't be removed from the UI (so you can't lock yourself out), and extra emails you add or remove in **Settings → Access & sharing → Allowed emails**. Removing an email revokes its existing sessions immediately. A provider without both its client id and secret is hidden on the login page. Google and GitHub accounts with the same email sign in as the same user.

- **R2 backups (optional):** run `npx wrangler r2 bucket create pickit-backups`. If you don't want R2, remove the `r2_buckets` block from `wrangler.jsonc` and the cron will skip backups.
- **Custom domain (optional):** add `"routes": [{ "pattern": "pickit.example.com", "custom_domain": true }]` to `wrangler.jsonc`. The domain must be a zone in your Cloudflare account.
- **AI (optional):** after logging in, open **Settings**, pick a provider (OpenAI, Anthropic, Gemini, DeepSeek, Qwen, OpenRouter, … or **Custom**), enter the API key and pick models from the fetched list. Chat and embedding models are configured separately and can use different providers. For custom endpoints, "Detect & fetch models" figures out whether `/v1` is needed, and the page shows the exact URLs that will be requested. Without AI, all other features still work.

### Continuous deployment

`.github/workflows/ci.yml` runs typecheck, tests and build on every push and PR. On pushes to `main` it also applies remote D1 migrations and deploys. Add these repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token from the "Edit Cloudflare Workers" template, plus **Account → D1 → Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

Because migrations run before the new code goes live, keep them backward-compatible (add columns or tables rather than dropping or renaming them).

## API

The web app uses the Better Auth session cookie. Scripts can use an API token generated in **Settings**:

```bash
curl -H "Authorization: Bearer <token>" https://your-domain/api/items
```

API errors use the language from the web app's `pickit_locale` cookie, an `X-PickIt-Locale: zh | en | ja` header, or the saved interface language.

### MCP (AI assistants)

`/api/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server (Streamable HTTP, stateless) so assistants such as Claude can search, read and add your bookmarks. It uses the same API token. Tools: `search_bookmarks`, `get_bookmark`, `list_bookmarks`, `list_categories`, `list_tags`, `add_bookmark`. Tool calls are recorded in the audit log. **Settings → Access & sharing → MCP** shows ready-to-copy config.

```bash
claude mcp add --transport http pickit https://your-domain/api/mcp \
  --header "Authorization: Bearer <token>"
```
