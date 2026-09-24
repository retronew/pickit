# PickIt

[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

Cloudflare Workers + D1 だけで動く、セルフホスト型のシングルユーザー向けブックマークマネージャーです。リンクを保存し、カテゴリとタグで整理し、全文検索やセマンティック検索で探せます。AI に整理を手伝わせることもできます。

## 機能

- **ブックマーク管理**：追加、編集、ピン留め、ゴミ箱への移動と復元、重複の検出と統合
- **一括編集**：選択した項目のピン留め、カテゴリ移動、削除、タグの追加 / 削除。AI にカテゴリとタグを提案させ、表で確認して選んだものだけ適用することも可能
- **整理**：カテゴリ、タグ（名前変更 / 削除）、アクセス回数、統計ページ
- **検索**：SQLite FTS5 による全文検索と、embedding によるセマンティック検索。類似度計算は 512 次元の圧縮ベクトルで候補を絞り込み、完全なベクトルで再ランキングするため、4096 次元のモデルでも無料プランの CPU 制限（10 ms）に収まります
- **AI**（任意、OpenAI・Anthropic・Gemini と OpenAI 互換 API に対応）：新しいリンクの名前・カテゴリ・タグの自動入力、要約、ライブラリを対象にしたチャット、一括整理、メモと要約のワンクリック翻訳。AI の出力言語は設定可能（デフォルトは表示言語）で、スマート検索は言語をまたいで動作します。チャットモデルと埋め込みモデルは独立して設定でき、別々のプロバイダーを使えます
- **インポート / エクスポート**：Markdown テーブル、JSON、ブラウザのブックマーク HTML
- **共有**：公開の読み取り専用リンク（`/s/:slug`）。単一のブックマークのほか、カテゴリ（サブカテゴリ含む）やタグのリストも共有でき、リストは自動更新され RSS も提供
- **クイック保存**：表示中のページを `/add?url=...` で開くブックマークレット。PWA としてインストール（ホーム画面に追加）でき、Android ではシステムの「共有」メニューから直接 PickIt に送れます
- **ログイン**：[Better Auth](https://better-auth.com) による Google / GitHub ログイン。許可リストのメールアドレスに限定、リストは設定画面で編集可能（パスワードなし）
- **多言語**：中文・English・日本語の画面（ヘッダーのメニューで切り替え）。選択は保存され、API のエラーや監査ログの説明にも反映されます
- **テーマ**：デフォルトでシステムのライト / ダークに追従。ヘッダーのボタンで「システム → ライト → ダーク」を切り替え
- **監査ログ**：すべての変更操作、エクスポート、ログイン / ログアウト、cron 実行を記録（操作者、アクション、対象、結果、IP、機密情報をマスクしたリクエスト詳細）し、デフォルトで 180 日間保持（監査ページで 1 日〜10 年または無期限に変更でき、ログの推定サイズも表示）。**監査**ページでカテゴリ、アクション、操作者、結果、日付範囲（プリセットあり）、キーワードで絞り込み、リアルタイム更新と手動更新に対応
- **API アクセス**：スクリプトや外部連携用の Bearer API トークン。AI アシスタントが検索・追加できる MCP サーバーも提供
- **バッチジョブ**：埋め込みの再生成と AI 一括整理は小さなステップに分けて実行され、一時停止 / 再開、失敗項目の再試行、項目ごとのエラー詳細に対応。設定ページの該当タブを開いている間はページが処理を進め、閉じた後は毎分の cron がバックグラウンドで続行します
- **バックアップと復元**：毎日 R2 へ JSON バックアップ（30 日保持）、手動バックアップも可能。設定画面の表からダウンロード・削除・復元ができ、復元は「統合」（未登録の URL のみ追加）と「置換」（現在の項目はゴミ箱へ）の 2 種類。復元前に現在のデータを自動バックアップするので取り消せます
- **定期メンテナンス**：リンク切れチェックと監査ログの整理

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
    src/mcp/           MCP サーバー：JSON-RPC 処理とブックマーク用ツール
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
# OAuth を設定しない場合はログインを省略（BETTER_AUTH_URL が localhost の場合のみ有効）
# DEV_AUTH_BYPASS=1
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

### 多言語対応

画面は中文・English・日本語に対応しています。文言は `packages/shared/messages/{zh,en,ja}.json`（zh が原文）にあり、`pnpm install` 時に [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) で `packages/shared/src/paraglide` にコンパイルされます（`pnpm --filter @pickit/shared i18n` でも可）。Web アプリと API は同じメッセージ関数を使います。

- 文言の追加：3 つのファイルに同じキーで追加し、コードでは `m.your_key()` を使います。いずれかの言語でキーが欠けている、文言が空、プレースホルダーが一致しない、ICU の複数形構文を使っている（Paraglide の形式は非対応。件数はどの数でも自然に読める表現にします）場合はテストが失敗します。

### テスト

- **API ルートテスト**（`*.int.test.ts`）は本物の Worker（ルート、認証・監査ミドルウェア）を、実際のマイグレーションで作ったインメモリ SQLite 上で実行します（`apps/api/src/test/`、Node 組み込みの `node:sqlite` を使うため Node 22.13 以上が必要）。ブックマーク、ゴミ箱、一括操作、インポート / エクスポート、検索、タグ、共有、設定、認証、監査ログ、バックアップと復元、一括編集（AI モデルはモック）、MCP をカバーします。
- **ユニットテスト**はベクトル、ジョブ、AI 設定とリクエスト URL、インポーター、監査の説明とマスク処理、Web 側の API クライアント・保存フロー・絞り込み・フォーマットをカバーします。
- API が記録する監査アクションに表示名がない場合、テストが失敗します。

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

API のエラーメッセージの言語は、Web アプリの `pickit_locale` Cookie、ヘッダー `X-PickIt-Locale: zh | en | ja`、保存された表示言語の順で決まります。

### MCP（AI アシスタント）

`/api/mcp` は [Model Context Protocol](https://modelcontextprotocol.io) サーバー（Streamable HTTP、ステートレス）で、Claude などの AI アシスタントからブックマークの検索・参照・追加ができます。認証は同じ API トークンです。ツールは `search_bookmarks`、`get_bookmark`、`list_bookmarks`、`list_categories`、`list_tags`、`add_bookmark` で、呼び出しは監査ログに記録されます。**設定 → アクセスと共有 → MCP** にコピーできる設定があります。

```bash
claude mcp add --transport http pickit https://your-domain/api/mcp \
  --header "Authorization: Bearer <token>"
```
