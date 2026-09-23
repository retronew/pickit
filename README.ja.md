# pickit

[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

Cloudflare Workers + D1 だけで動く、セルフホスト型のシングルユーザー向けブックマークマネージャーです。リンクを保存し、カテゴリとタグで整理し、全文検索やセマンティック検索で探せます。AI に整理を手伝わせることもできます。

## 機能

- **ブックマーク管理**：追加、編集、ピン留め、ゴミ箱への移動と復元、一括操作、重複の検出と統合
- **整理**：カテゴリ、タグ（名前変更 / 削除）、アクセス回数、統計ページ
- **検索**：SQLite FTS5 による全文検索と、embedding によるセマンティック検索
- **AI**（任意、OpenAI 互換 API ならどれでも可）：新しいリンクの名前・カテゴリ・タグの自動入力、要約、ライブラリを対象にしたチャット、一括整理
- **インポート / エクスポート**：Markdown テーブル、JSON、ブラウザのブックマーク HTML
- **共有**：公開の読み取り専用共有リンク（`/s/:slug`）
- **クイック保存**：表示中のページを `/add?url=...` で開くブックマークレット
- **API アクセス**：スクリプトや外部連携用の Bearer API トークン
- **定期メンテナンス**：毎日 R2 への JSON バックアップとリンク切れチェック

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| API | Cloudflare Workers 上の [Hono](https://hono.dev)、D1（SQLite）、R2 |
| Web | React 19、React Router、Vite、Tailwind CSS v4、Base UI |
| AI | [AI SDK](https://ai-sdk.dev)（OpenAI 互換プロバイダー） |
| ツール | pnpm workspaces、TypeScript、Vitest、GitHub Actions |

```
apps/
  api/        Worker：API ルート、D1 マイグレーション、cron ジョブ（wrangler.jsonc）
  web/        React SPA。apps/api/dist にビルドされ、Worker のアセットとして配信
packages/
  shared/     api と web で共有する型とヘルパー（URL 正規化、インポーター）
scripts/
  import.mjs  Markdown のブックマーク表を D1 に一括インポート
```

## ローカル開発

必要環境：Node.js 24 以上、pnpm 11 以上。

```bash
pnpm install

# ローカル用シークレット（git 管理対象外）
cat > apps/api/.dev.vars <<'EOF'
APP_PASSWORD=ログイン用パスワード
JWT_SECRET=十分に長いランダム文字列
EOF

pnpm db:migrate   # ローカルの D1 データベースにマイグレーションを適用
pnpm dev          # Web は http://localhost:5173、API は :8787
```

既存の Markdown 形式のブックマーク表をインポートする場合：

```bash
pnpm import -- --file path/to/bookmarks.md
```

| コマンド | 説明 |
| --- | --- |
| `pnpm dev` | Web と API を同時に起動 |
| `pnpm typecheck` / `pnpm test` | 全パッケージの型チェック / テスト |
| `pnpm build` | Web アプリを `apps/api/dist` にビルド |
| `pnpm db:migrate` / `pnpm db:migrate:remote` | D1 マイグレーションをローカル / リモートに適用 |
| `pnpm deploy` | ビルドして Worker をデプロイ |

## Cloudflare へのデプロイ

個人用のブックマーク量であれば、Workers と D1 の無料枠で十分に収まります。

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create pickit-db          # 表示された database_id を wrangler.jsonc に記入
pnpm db:migrate:remote
npx wrangler secret put APP_PASSWORD
npx wrangler secret put JWT_SECRET        # 例：openssl rand -base64 32
cd ../.. && pnpm deploy
```

- **R2 バックアップ（任意）**：`npx wrangler r2 bucket create pickit-backups` を実行します。R2 を使わない場合は `wrangler.jsonc` の `r2_buckets` ブロックを削除すれば、cron はバックアップをスキップします。
- **カスタムドメイン（任意）**：`wrangler.jsonc` に `"routes": [{ "pattern": "pickit.example.com", "custom_domain": true }]` を追加します。ドメインは Cloudflare アカウントのゾーンである必要があります。
- **AI（任意）**：ログイン後、**設定** ページで Base URL、API キー、モデル名を入力します。未設定でも AI 以外の機能はすべて使えます。

### 継続的デプロイ

`.github/workflows/ci.yml` は push と PR のたびに型チェック、テスト、ビルドを実行します。`main` への push では、リモート D1 へのマイグレーション適用とデプロイも行います。リポジトリに次のシークレットを追加してください：

| シークレット | 値 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 「Edit Cloudflare Workers」テンプレートで作成し、**Account → D1 → Edit** を追加した API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |

マイグレーションは新しいコードの公開前に実行されるため、後方互換を保ってください（列やテーブルの削除・名前変更ではなく、追加にとどめる）。

## API

Web アプリは Cookie セッションで認証します。スクリプトからは **設定** ページで発行した API トークンを使えます：

```bash
curl -H "Authorization: Bearer <token>" https://your-domain/api/items
```
