# PickIt

[English](./README.md) | **简体中文** | [日本語](./README.ja.md)

**收藏，不再吃灰。** 一个自托管的单用户书签管理工具，完整运行在 Cloudflare Workers + D1 上。保存链接，用分类和标签整理，支持全文搜索和语义搜索，还可以让 AI 帮你整理收藏。

## 功能

- **收藏管理**：新增、编辑、置顶、删除到回收站、恢复、重复检测与合并
- **批量编辑**：选中多条后置顶、移动分类、删除、添加 / 移除标签；也可以让 AI 给出分类和标签建议，在表格里逐条勾选后再应用
- **整理**：分类、标签（重命名 / 删除）、访问次数统计、数据统计页
- **搜索**：基于 SQLite FTS5 的全文搜索，以及基于 embedding 的语义搜索。相似度计算先用 512 维压缩向量粗筛，再用完整向量精排候选，即使是 4096 维的模型也能控制在免费版 10 毫秒的 CPU 限制内。常用的搜索词、分类、标签和排序可以保存为「保存的搜索」，存在服务器上，多设备同步
- **AI**（可选，支持 OpenAI、Anthropic、Gemini 及任意 OpenAI 兼容接口）：新链接自动填写名称 / 分类 / 标签、单条摘要、基于收藏库的对话、批量整理、备注和摘要一键翻译。AI 的输出语言可以设置（默认跟随界面语言），智能搜索支持跨语言。对话模型和向量模型各自独立配置，可以来自不同的服务商
- **导入 / 导出**：Markdown 表格、JSON、浏览器书签 HTML
- **分享**：公开只读链接（`/s/:slug`），可以分享单条收藏、整个分类（含子分类）或标签下的收藏列表，也可以在收藏页多选后打包成合集分享；列表会自动更新并提供 RSS 订阅。分享标题可以自定义，**分享**页集中管理所有链接并提供访问统计（每日页面访问与 RSS 拉取、来源网站、地区、最近访问记录；忽略爬虫，访问明细保留 180 天）
- **快速收藏**：书签小工具（bookmarklet），一键打开当前页面的 `/add?url=...`；也可以安装为 PWA（添加到主屏幕），在 Android 上通过系统「分享」菜单直接发送到 PickIt
- **登录**：通过 [Better Auth](https://better-auth.com) 使用 Google / GitHub 登录，并限制为允许列表里的邮箱，列表可在设置页修改（不使用密码）
- **多语言**：界面支持中文、English、日本語（顶栏菜单切换），选择会保存下来，API 错误信息和审计描述也会跟着变
- **键盘快捷键**：`/` 搜索、`N` 新增、`J`/`K` 在卡片间移动、`Enter` 详情、`O` 打开链接、`E` 编辑、`P` 置顶，按 `?` 查看全部
- **主题**：默认跟随系统的浅色 / 深色，顶栏按钮可在「跟随系统 → 浅色 → 深色」之间切换
- **审计日志**：记录每一次修改操作、导出、登录 / 退出和定时任务（操作者、动作、对象、结果、IP、请求详情，敏感字段脱敏），默认保留 180 天（可在审计页改为 1 天到 10 年或永久保留，并显示日志的估算占用大小）；**审计**页面可按类别、动作、操作者、结果、日期范围（含快捷选项）和关键词筛选，支持实时刷新和手动刷新
- **API 访问**：Bearer API Token，方便脚本和第三方集成；另有 MCP 服务，AI 助手可以直接搜索和添加收藏
- **批量任务**：向量索引重建、AI 批量整理和 AI 补充摘要按小批次分步执行（首页多选后也可以直接为选中的收藏生成摘要），支持暂停 / 继续、重试失败项，并能查看每一条的失败原因。设置页对应的标签打开时由页面推进，关闭后由每分钟一次的定时任务在后台继续
- **备份与恢复**：每天自动备份 JSON 到 R2（保留 30 天），也可以立即备份；在设置页的表格里下载、删除或恢复备份，恢复分「合并」（只补没有的网址）和「覆盖」（现有收藏移到回收站）两种方式，恢复前会自动备份当前数据，恢复错了也能撤回
- **定时维护**：检查失效链接（失效时自动查找 Wayback Machine 上最近的存档，详情页可「查看存档」）、清理过期审计日志；为旧收藏逐步补抓预览图（og:image），新收藏在「AI 识别」时直接获取

## 技术栈

| 层 | 技术 |
| --- | --- |
| API | Cloudflare Workers 上的 [Hono](https://hono.dev)，D1（SQLite），R2 |
| 前端 | React 19、React Router、Vite、Tailwind CSS v4、Base UI |
| AI | [AI SDK](https://ai-sdk.dev)，对接 OpenAI 兼容服务 |
| 工程化 | pnpm workspaces、TypeScript、Vitest、GitHub Actions |

```
apps/
  api/                 Worker（wrangler.jsonc）、D1 迁移
    src/index.ts       应用装配：中间件顺序和路由挂载
    src/routes/        每个 API 领域一个模块，routes/items/ 按职责再拆分
    src/audit/         审计日志：存储、请求描述、脱敏、中间件
    src/mcp/           MCP 服务：JSON-RPC 处理和收藏相关工具
    src/scheduled.ts   定时任务入口（批量任务、备份、链接检查、审计清理）
  web/                 React 单页应用，构建到 apps/api/dist，作为 Worker 静态资源提供
    src/pages/         每个路由一个页面组件
    src/components/    按功能分目录：items/、settings/、audit/；ui/ 为基础组件
    src/hooks/         页面使用的数据和交互 hook
packages/
  shared/              api 和 web 共用的类型与工具函数（ai/、导入解析、URL 规范化）
scripts/
  import.mjs  把 Markdown 书签表格批量导入 D1
```

## 本地开发

环境要求：Node.js 24+、pnpm 11+。

```bash
pnpm install

# 本地密钥（已被 git 忽略）
cat > apps/api/.dev.vars <<'EOF'
BETTER_AUTH_SECRET=任意一段较长的随机字符串
BETTER_AUTH_URL=http://localhost:5173
ALLOWED_EMAILS=you@example.com
# 本地开发用的 OAuth 应用（回调地址：http://localhost:5173/api/auth/callback/<provider>）
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
# 或者完全不配 OAuth：跳过登录（仅当 BETTER_AUTH_URL 是 localhost 时生效）
# DEV_AUTH_BYPASS=1
EOF

pnpm db:migrate   # 在本地 D1 数据库执行迁移
pnpm dev          # 前端 http://localhost:5173，API 在 :8787
```

如果已有 Markdown 表格格式的书签，可以批量导入：

```bash
pnpm import -- --file path/to/bookmarks.md
```

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 同时启动前端和 API |
| `pnpm typecheck` / `pnpm test` | 对所有包做类型检查 / 运行测试 |
| `pnpm build` | 构建前端到 `apps/api/dist` |
| `pnpm db:migrate` / `pnpm db:migrate:remote` | 在本地 / 远程执行 D1 迁移 |
| `pnpm deploy` | 构建并部署 Worker |

### 多语言

界面支持中文、English、日本語。文案放在 `packages/shared/messages/{zh,en,ja}.json`（以 zh 为准），`pnpm install` 时由 [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) 编译到 `packages/shared/src/paraglide`（也可以运行 `pnpm --filter @pickit/shared i18n`）。网页端和 API 共用同一套文案函数。

- 新增文案：在三个文件里用同一个键添加，然后在代码里用 `m.your_key()`。如果某个语言缺键、文案为空、占位符不一致，或者用了 ICU 复数语法（Paraglide 的格式不支持；数量相关的文案要写成任何数字都通顺的说法），测试都会失败。

### 测试

- **API 路由测试**（`*.int.test.ts`）运行真实的 Worker（路由、登录校验和审计中间件），数据库是用真实迁移文件建出来的内存 SQLite（`apps/api/src/test/`，使用 Node 内置的 `node:sqlite`，需要 Node 22.13 以上）。覆盖收藏、回收站、批量操作、导入导出、搜索、标签、分享、设置、登录鉴权、审计日志、备份恢复、批量编辑（用模拟的 AI 模型）和 MCP。
- **单元测试**覆盖向量、批量任务、AI 配置与请求地址、导入解析、审计描述与脱敏，以及前端的请求封装、保存流程、筛选和格式化。
- 如果 API 记录的某个审计动作没有显示名称，测试会失败。

## 部署到 Cloudflare

个人书签库的量级，Workers 和 D1 的免费额度完全够用。

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create pickit-db          # 把输出的 database_id 填进 wrangler.jsonc
pnpm db:migrate:remote
npx wrangler secret put BETTER_AUTH_SECRET   # 例如 openssl rand -base64 32
npx wrangler secret put ALLOWED_EMAILS       # 所有者邮箱，多个用逗号分隔（始终允许登录）
npx wrangler secret put GOOGLE_CLIENT_ID     # 以及 GOOGLE_CLIENT_SECRET、GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET
cd ../.. && pnpm deploy
```

### 登录（Google / GitHub）

登录使用 [Better Auth](https://better-auth.com) 接入 Google 和 GitHub，不支持密码登录。先把 `wrangler.jsonc` 里 `vars` 的 `BETTER_AUTH_URL` 改成你的访问地址，再按下表创建 OAuth 应用：

| 服务商 | 在哪里创建 | 回调地址 |
| --- | --- | --- |
| Google | Google Cloud Console → API 和服务 → 凭据 → OAuth 客户端 ID（Web 应用） | `https://your-domain/api/auth/callback/google` |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps | `https://your-domain/api/auth/callback/github` |

只有允许列表里的邮箱能登录，其他 Google / GitHub 账号一律拒绝。允许列表分两部分：`ALLOWED_EMAILS` 密钥里的所有者邮箱始终允许登录，且不能在页面上移除（避免把自己锁在外面）；其余邮箱可以在 **设置 → 访问与分享 → 允许登录的邮箱** 里添加或移除。移除某个邮箱后，它已有的登录态会立即失效。没配齐 client id 和 secret 的服务商不会出现在登录页。邮箱相同的 Google 和 GitHub 账号会登录为同一个用户。

- **R2 备份（可选）**：运行 `npx wrangler r2 bucket create pickit-backups`。不需要 R2 的话，删掉 `wrangler.jsonc` 里的 `r2_buckets` 段，定时任务会自动跳过备份。
- **自定义域名（可选）**：在 `wrangler.jsonc` 里加上 `"routes": [{ "pattern": "pickit.example.com", "custom_domain": true }]`，域名需要已接入你的 Cloudflare 账号。
- **AI（可选）**：登录后到 **设置** 页选择服务商（OpenAI、Anthropic、Gemini、DeepSeek、通义千问、OpenRouter 等，或「自定义」），填写 API Key，再从拉取到的模型列表里选模型。对话模型和向量模型分开配置，可以用不同的服务商。自定义地址时，「检测并获取模型」会自动判断要不要加 `/v1`，页面上也会实时显示实际请求的地址。不配置 AI 的话，其他功能都能正常使用。

### 自动部署

`.github/workflows/ci.yml` 会在每次推送和 PR 时执行类型检查、测试和构建；推送到 `main` 时，还会在远程 D1 执行迁移并自动部署。需要在仓库里添加以下 Secret：

| Secret | 值 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 用 "Edit Cloudflare Workers" 模板创建的 API Token，并额外添加 **Account → D1 → Edit** 权限 |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Cloudflare 账号 ID |

迁移会在新代码上线前执行，所以迁移要保持向后兼容：只新增字段或表，不要删除或重命名。

## API

网页端使用 Better Auth 的登录 Cookie。脚本可以使用在 **设置** 页生成的 API Token：

```bash
curl -H "Authorization: Bearer <token>" https://your-domain/api/items
```

API 错误信息的语言依次取自网页端的 `pickit_locale` Cookie、请求头 `X-PickIt-Locale: zh | en | ja`，以及保存的界面语言。

### MCP（AI 助手）

`/api/mcp` 是一个 [Model Context Protocol](https://modelcontextprotocol.io) 服务（Streamable HTTP，无状态），Claude 等 AI 助手可以通过它搜索、查看和添加你的收藏，鉴权同样使用 API Token。工具有 `search_bookmarks`、`get_bookmark`、`list_bookmarks`、`list_categories`、`list_tags`、`add_bookmark`，每次调用都会记入审计日志。**设置 → 访问与分享 → MCP 接入** 里有可直接复制的配置。

```bash
claude mcp add --transport http pickit https://your-domain/api/mcp \
  --header "Authorization: Bearer <token>"
```
