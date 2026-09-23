# pickit

[English](./README.md) | **简体中文** | [日本語](./README.ja.md)

一个自托管的单用户书签管理工具，完整运行在 Cloudflare Workers + D1 上。保存链接，用分类和标签整理，支持全文搜索和语义搜索，还可以让 AI 帮你整理收藏。

## 功能

- **收藏管理**：新增、编辑、置顶、删除到回收站、恢复、批量操作、重复检测与合并
- **整理**：分类、标签（重命名 / 删除）、访问次数统计、数据统计页
- **搜索**：基于 SQLite FTS5 的全文搜索，以及基于 embedding 的语义搜索
- **AI**（可选，支持 OpenAI、Anthropic、Gemini 及任意 OpenAI 兼容接口）：新链接自动填写名称 / 分类 / 标签、单条摘要、基于收藏库的对话、批量整理。对话模型和向量模型各自独立配置，可以来自不同的服务商
- **导入 / 导出**：Markdown 表格、JSON、浏览器书签 HTML
- **分享**：公开只读分享链接（`/s/:slug`）
- **快速收藏**：书签小工具（bookmarklet），一键打开当前页面的 `/add?url=...`
- **API 访问**：Bearer API Token，方便脚本和第三方集成
- **批量任务**：向量索引重建和 AI 批量整理按小批次分步执行，支持暂停 / 继续、重试失败项，并能查看每一条的失败原因。设置页打开时由页面推进，关闭后由每分钟一次的定时任务在后台继续
- **定时维护**：每天备份 JSON 到 R2，并检查失效链接

## 技术栈

| 层 | 技术 |
| --- | --- |
| API | Cloudflare Workers 上的 [Hono](https://hono.dev)，D1（SQLite），R2 |
| 前端 | React 19、React Router、Vite、Tailwind CSS v4、Base UI |
| AI | [AI SDK](https://ai-sdk.dev)，对接 OpenAI 兼容服务 |
| 工程化 | pnpm workspaces、TypeScript、Vitest、GitHub Actions |

```
apps/
  api/        Worker：API 路由、D1 迁移、定时任务（wrangler.jsonc）
  web/        React 单页应用，构建到 apps/api/dist，作为 Worker 静态资源提供
packages/
  shared/     api 和 web 共用的类型与工具函数（URL 规范化、导入解析）
scripts/
  import.mjs  把 Markdown 书签表格批量导入 D1
```

## 本地开发

环境要求：Node.js 24+、pnpm 11+。

```bash
pnpm install

# 本地密钥（已被 git 忽略）
cat > apps/api/.dev.vars <<'EOF'
APP_PASSWORD=你的登录密码
JWT_SECRET=任意一段较长的随机字符串
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

## 部署到 Cloudflare

个人书签库的量级，Workers 和 D1 的免费额度完全够用。

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create pickit-db          # 把输出的 database_id 填进 wrangler.jsonc
pnpm db:migrate:remote
npx wrangler secret put APP_PASSWORD
npx wrangler secret put JWT_SECRET        # 例如 openssl rand -base64 32
cd ../.. && pnpm deploy
```

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

网页端使用 Cookie 登录态。脚本可以使用在 **设置** 页生成的 API Token：

```bash
curl -H "Authorization: Bearer <token>" https://your-domain/api/items
```
