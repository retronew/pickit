# pickit

**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

A self-hosted, single-user bookmark manager that runs entirely on Cloudflare Workers + D1. Save links, organize them with categories and tags, search them with full-text or semantic search, and let an AI model help you tidy things up.

## Features

- **Bookmarks**: add, edit, pin, soft-delete to trash, restore, bulk actions, duplicate detection and merging
- **Organize**: categories, tags (rename / delete), visit counts, stats dashboard
- **Search**: SQLite FTS5 full-text search, plus semantic search via embeddings
- **AI** (optional, any OpenAI-compatible API): auto-fill name/category/tags for new links, per-item summaries, chat over your library, batch re-organize
- **Import / export**: Markdown tables, JSON, browser bookmark HTML
- **Sharing**: public read-only share links (`/s/:slug`)
- **Capture**: bookmarklet that opens `/add?url=...` for the current page
- **API access**: Bearer API token for scripts and integrations
- **Maintenance cron**: daily JSON backup to R2 and dead-link checks

## Tech stack

| Layer | Stack |
| --- | --- |
| API | [Hono](https://hono.dev) on Cloudflare Workers, D1 (SQLite), R2 |
| Web | React 19, React Router, Vite, Tailwind CSS v4, Base UI |
| AI | [AI SDK](https://ai-sdk.dev) with OpenAI-compatible providers |
| Tooling | pnpm workspaces, TypeScript, Vitest, GitHub Actions |

```
apps/
  api/        Worker: API routes, D1 migrations, cron jobs (wrangler.jsonc)
  web/        React SPA, built into apps/api/dist and served as Worker assets
packages/
  shared/     Types and helpers shared by api and web (URL normalization, importers)
scripts/
  import.mjs  Bulk-import a Markdown bookmark table into D1
```

## Local development

Requirements: Node.js 24+, pnpm 11+.

```bash
pnpm install

# Local secrets (git-ignored)
cat > apps/api/.dev.vars <<'EOF'
APP_PASSWORD=your-login-password
JWT_SECRET=any-long-random-string
EOF

pnpm db:migrate   # apply migrations to the local D1 database
pnpm dev          # web on http://localhost:5173, API on :8787
```

Optionally import an existing Markdown table of bookmarks:

```bash
pnpm import -- --file path/to/bookmarks.md
```

| Script | Description |
| --- | --- |
| `pnpm dev` | Run web and API together |
| `pnpm typecheck` / `pnpm test` | Type-check and run tests in all packages |
| `pnpm build` | Build the web app into `apps/api/dist` |
| `pnpm db:migrate` / `pnpm db:migrate:remote` | Apply D1 migrations locally / remotely |
| `pnpm deploy` | Build and deploy the Worker |

## Deploy to Cloudflare

Workers and D1 both fit comfortably in the free tier for a personal library.

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create pickit-db          # put the printed database_id into wrangler.jsonc
pnpm db:migrate:remote
npx wrangler secret put APP_PASSWORD
npx wrangler secret put JWT_SECRET        # e.g. openssl rand -base64 32
cd ../.. && pnpm deploy
```

- **R2 backups (optional):** run `npx wrangler r2 bucket create pickit-backups`. If you don't want R2, remove the `r2_buckets` block from `wrangler.jsonc` and the cron will skip backups.
- **Custom domain (optional):** add `"routes": [{ "pattern": "pickit.example.com", "custom_domain": true }]` to `wrangler.jsonc`. The domain must be a zone in your Cloudflare account.
- **AI (optional):** after logging in, open **Settings** and fill in the Base URL, API key and model names. Without it, all non-AI features still work.

### Continuous deployment

`.github/workflows/ci.yml` runs typecheck, tests and build on every push and PR. On pushes to `main` it also applies remote D1 migrations and deploys. Add these repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token from the "Edit Cloudflare Workers" template, plus **Account → D1 → Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

Because migrations run before the new code goes live, keep them backward-compatible (add columns or tables rather than dropping or renaming them).

## API

The web app authenticates with a cookie session. Scripts can use an API token generated in **Settings**:

```bash
curl -H "Authorization: Bearer <token>" https://your-domain/api/items
```
