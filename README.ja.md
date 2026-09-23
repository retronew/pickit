# PickIt

[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

Cloudflare Workers + D1 だけで動く、セルフホスト型のシングルユーザー向けブックマークマネージャーです。リンクを保存し、カテゴリとタグで整理し、全文検索やセマンティック検索で探せます。AI に整理を手伝わせることもできます。

## 機能

- **ブックマーク管理**：追加、編集、ピン留め、ゴミ箱への移動と復元、一括操作、重複の検出と統合
- **整理**：カテゴリ、タグ（名前変更 / 削除）、アクセス回数、統計ページ
- **検索**：SQLite FTS5 による全文検索と、embedding によるセマンティック検索。類似度計算は 512 次元の圧縮ベクトルで候補を絞り込み、完全なベクトルで再ランキングするため、4096 次元のモデルでも無料プランの CPU 制限（10 ms）に収まります
- **AI**（任意、OpenAI・Anthropic・Gemini と OpenAI 互換 API に対応）：新しいリンクの名前・カテゴリ・タグの自動入力、要約、ライブラリを対象にしたチャット、一括整理。チャットモデルと埋め込みモデルは独立して設定でき、別々のプロバイダーを使えます
- **インポート / エクスポート**：Markdown テーブル、JSON、ブラウザのブックマーク HTML
- **共有**：公開の読み取り専用共有リンク（`/s/:slug`）
- **クイック保存**：表示中のページを `/add?url=...` で開くブックマークレット
- **ログイン**：[Better Auth](https://better-auth.com) による Google / GitHub ログイン。許可リストのメールアドレスに限定、リストは設定画面で編集可能（パスワードなし）
- **テーマ**：デフォルトでシステムのライト / ダークに追従。ヘッダーのボタンで「システム → ライト → ダーク」を切り替え
- **監査ログ**：すべての変更操作、エクスポート、ログイン / ログアウト、cron 実行を記録（操作者、アクション、対象、結果、IP、機密情報をマスクしたリクエスト詳細）し、180 日間保持。**監査**ページでカテゴリ、アクション、操作者、結果、日付範囲（プリセットあり）、キーワードで絞り込み、リアルタイム更新と手動更新に対応
- **API アクセス**：スクリプトや外部連携用の Bearer API トークン
- **バッチジョブ**：埋め込みの再生成と AI 一括整理は小さなステップに分けて実行され、一時停止 / 再開、失敗項目の再試行、項目ごとのエラー詳細に対応。設定ページを開いている間はページが処理を進め、閉じた後は毎分の cron がバックグラウンドで続行します
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
  api/                 Worker（wrangler.jsonc）、D1 マイグレーション
    src/index.ts       アプリの組み立て：ミドルウェアの順序とルートのマウント
    src/routes/        API 領域ごとに 1 モジュール。routes/items/ は責務ごとに分割
    src/audit/         監査ログ：保存、リクエストの説明、マスク処理、ミドルウェア
    src/scheduled.ts   cron のエントリ（ジョブ、バックアップ、リンク確認、監査ログ整理）
  web/                 React SPA。apps/api/dist にビルドされ、Worker のアセットとして配信
    src/pages/         ルートごとに 1 コンポーネント
    src/components/    機能別フォルダ：items/、settings/、audit/。ui/ は基本部品
    src/hooks/         ページが使うデータ・振る舞いの hook
packages/
  shared/              api と web で共有する型とヘルパー（ai/、インポーター、URL 正規化）
scripts/
  import.mjs  Markdown のブックマーク表を D1 に一括インポート
```

## ローカル開発

必要環境：Node.js 24 以上、pnpm 11 以上。

```bash
pnpm install

# ローカル用シークレット（git 管理対象外）
cat > apps/api/.dev.vars <<'EOF'
BETTER_AUTH_SECRET=十分に長いランダム文字列
BETTER_AUTH_URL=http://localhost:5173
ALLOWED_EMAILS=you@example.com
# ローカル開発用の OAuth アプリ（コールバック：http://localhost:5173/api/auth/callback/<provider>）
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
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
npx wrangler secret put BETTER_AUTH_SECRET   # 例：openssl rand -base64 32
npx wrangler secret put ALLOWED_EMAILS       # オーナーのメールアドレス（カンマ区切り、常にログイン可能）
npx wrangler secret put GOOGLE_CLIENT_ID     # GOOGLE_CLIENT_SECRET、GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET も同様
cd ../.. && pnpm deploy
```

### ログイン（Google / GitHub）

ログインは [Better Auth](https://better-auth.com) による Google と GitHub のみで、パスワードログインはありません。`wrangler.jsonc` の `vars` にある `BETTER_AUTH_URL` を公開 URL に変更し、次のコールバック URL で OAuth アプリを作成します：

| プロバイダー | 作成場所 | コールバック URL |
| --- | --- | --- |
| Google | Google Cloud Console → API とサービス → 認証情報 → OAuth クライアント ID（ウェブアプリケーション） | `https://your-domain/api/auth/callback/google` |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps | `https://your-domain/api/auth/callback/github` |

許可リストのメールアドレスだけがログインでき、それ以外の Google / GitHub アカウントは拒否されます。許可リストは 2 つから成ります：`ALLOWED_EMAILS` シークレットのオーナーのメールアドレスは常に許可され、画面からは削除できません（締め出し防止）。それ以外のアドレスは **設定 → アクセスと共有 → ログインを許可するメールアドレス** で追加・削除できます。削除すると既存のセッションもすぐに無効になります。client id と secret の両方が設定されていないプロバイダーはログイン画面に表示されません。同じメールアドレスの Google と GitHub アカウントは同一ユーザーとしてログインします。

- **R2 バックアップ（任意）**：`npx wrangler r2 bucket create pickit-backups` を実行します。R2 を使わない場合は `wrangler.jsonc` の `r2_buckets` ブロックを削除すれば、cron はバックアップをスキップします。
- **カスタムドメイン（任意）**：`wrangler.jsonc` に `"routes": [{ "pattern": "pickit.example.com", "custom_domain": true }]` を追加します。ドメインは Cloudflare アカウントのゾーンである必要があります。
- **AI（任意）**：ログイン後、**設定** ページでプロバイダー（OpenAI、Anthropic、Gemini、DeepSeek、Qwen、OpenRouter など、または「カスタム」）を選び、API キーを入力して、取得したモデル一覧からモデルを選びます。チャットモデルと埋め込みモデルは別々に設定でき、異なるプロバイダーも使えます。カスタム URL では「検出してモデルを取得」が `/v1` の要否を自動判定し、実際にリクエストされる URL もページ上に表示されます。未設定でも AI 以外の機能はすべて使えます。

### 継続的デプロイ

`.github/workflows/ci.yml` は push と PR のたびに型チェック、テスト、ビルドを実行します。`main` への push では、リモート D1 へのマイグレーション適用とデプロイも行います。リポジトリに次のシークレットを追加してください：

| シークレット | 値 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 「Edit Cloudflare Workers」テンプレートで作成し、**Account → D1 → Edit** を追加した API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |

マイグレーションは新しいコードの公開前に実行されるため、後方互換を保ってください（列やテーブルの削除・名前変更ではなく、追加にとどめる）。

## API

Web アプリは Better Auth のセッション Cookie で認証します。スクリプトからは **設定** ページで発行した API トークンを使えます：

```bash
curl -H "Authorization: Bearer <token>" https://your-domain/api/items
```
