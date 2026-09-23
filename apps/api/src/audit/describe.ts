// Maps an API request to an action name and a readable summary.

export type Body = Record<string, any>;

interface Described {
  action: string;
  target?: string;
  summary: string;
}

const quote = (s: unknown) => (s ? `「${String(s)}」` : "");

const BULK_VERBS: Record<string, string> = {
  delete: "删除",
  pin: "置顶",
  unpin: "取消置顶",
  category: "修改分类",
  purge: "彻底删除",
  restore: "恢复",
  add_tags: "添加标签",
  remove_tags: "移除标签",
  apply: "应用整理建议",
};

/** MCP tool calls are audited; protocol chatter (initialize, tools/list…) is not. */
function describeMcp(body: Body): Described | false {
  if (body.method !== "tools/call") return false;
  const name = String(body.params?.name ?? "");
  const args = (body.params?.arguments ?? {}) as Body;
  const detail =
    name === "search_bookmarks"
      ? `搜索${quote(args.query)}`
      : name === "add_bookmark"
        ? `添加收藏 ${args.url ?? ""}`.trim()
        : name === "get_bookmark"
          ? `查看收藏 #${args.id}`
          : name;
  return { action: "mcp.call", target: `mcp:${name}`, summary: `MCP：${detail}` };
}

/**
 * Maps a request to an action name and a readable summary. `name` is the
 * item's name looked up before the handler ran (for /api/items/:id routes),
 * `res` the JSON response when useful (e.g. the id of a new item).
 */
export function describe(
  method: string,
  path: string,
  body: Body,
  name: string | undefined,
  res: Body,
): Described | null | false {
  const p = path.replace(/^\/api/, "");
  if (p === "/mcp") return method === "POST" ? describeMcp(body) : false;
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/items\/(\d+)(?:\/(\w+))?$/))) {
    const [, id, sub] = m;
    const target = `item:${id}`;
    const label = quote(name ?? body.name) || `#${id}`;
    if (!sub && method === "PUT") {
      const keys = Object.keys(body);
      if (keys.length === 1 && keys[0] === "pinned") {
        return body.pinned
          ? { action: "item.pin", target, summary: `置顶收藏${label}` }
          : { action: "item.unpin", target, summary: `取消置顶${label}` };
      }
      return { action: "item.update", target, summary: `编辑收藏${label}` };
    }
    if (!sub && method === "DELETE") return { action: "item.delete", target, summary: `删除收藏${label}（移到回收站）` };
    const subs: Record<string, [string, string]> = {
      restore: ["item.restore", `从回收站恢复${label}`],
      purge: ["item.purge", `彻底删除${label}`],
      summarize: ["item.summarize", `生成 AI 摘要${label}`],
      check: ["item.check", `检查链接${label}`],
      reembed: ["item.reembed", `重建向量${label}`],
      visit: ["item.visit", `打开收藏${label}`],
    };
    if (sub && subs[sub]) return { action: subs[sub][0], target, summary: subs[sub][1] };
  }

  const key = `${method} ${p}`;
  switch (key) {
    case "POST /items":
      return {
        action: "item.create",
        target: res.id ? `item:${res.id}` : undefined,
        summary: `添加收藏${quote(body.name)}${body.allowDuplicate ? "（重复链接仍保存）" : ""}`,
      };
    case "POST /items/analyze":
      return { action: "item.analyze", summary: `AI 识别链接 ${body.url ?? ""}`.trim() };
    case "POST /items/import":
      return body.dryRun
        ? { action: "item.import_preview", summary: `预览导入（${body.format ?? "未知格式"}）` }
        : {
            action: "item.import",
            summary: `导入数据（${body.format ?? "未知格式"}）${
              res.inserted != null ? `：新增 ${res.inserted} 条，跳过 ${res.skipped ?? 0} 条` : ""
            }`,
          };
    case "GET /items/export":
      return { action: "item.export", summary: "导出数据" };
    case "POST /items/merge":
      return {
        action: "item.merge",
        target: `item:${body.keepId}`,
        summary: `合并重复收藏：保留 #${body.keepId}，移除 ${(body.removeIds ?? []).length} 项`,
      };
    case "POST /items/suggest":
      return { action: "item.suggest", summary: `AI 生成整理建议 ${(body.ids ?? []).length} 项` };
    case "POST /items/bulk": {
      const n = body.action === "apply" ? (body.updates ?? []).length : (body.ids ?? []).length;
      const verb = BULK_VERBS[body.action] ?? body.action;
      const extra =
        body.action === "category"
          ? `到${quote(body.value || "未分类")}`
          : Array.isArray(body.tags)
            ? `：${body.tags.map((t: string) => `#${t}`).join(" ")}`
            : "";
      return { action: `item.bulk_${body.action}`, summary: `批量${verb} ${n} 项${extra}` };
    }
    case "POST /tags/rename":
      return { action: "tag.rename", target: `tag:${body.from}`, summary: `重命名标签${quote(body.from)}→${quote(body.to)}` };
    case "POST /tags/delete":
      return { action: "tag.delete", target: `tag:${body.tag}`, summary: `删除标签${quote(body.tag)}` };
    case "POST /shares":
      return {
        action: "share.create",
        target: res.slug ? `share:${res.slug}` : undefined,
        summary: `创建分享链接：${
          body.type === "category" ? `分类${quote(body.value)}` : body.type === "tag" ? `标签${quote(body.value)}` : quote(body.title) || `#${body.value}`
        }`,
      };
    case "POST /settings/ai":
      return { action: "settings.ai_update", summary: "修改 AI 配置" };
    case "POST /settings/ai/models":
      return { action: "settings.ai_models", summary: `获取${body.target === "embedding" ? "向量" : "对话"}模型列表` };
    case "POST /settings/ai/test":
      return { action: "settings.ai_test", summary: `测试${body.target === "embedding" ? "向量" : "对话"}模型连接` };
    case "POST /settings/api-token/reset":
      return { action: "settings.token_reset", summary: "生成 / 重置 API Token" };
    case "DELETE /settings/api-token":
      return { action: "settings.token_delete", summary: "删除 API Token" };
    case "PUT /settings/allowed-emails":
      return {
        action: "settings.allowed_emails",
        summary: `修改允许登录的邮箱（${(body.emails ?? []).length} 个）`,
      };
    case "PUT /audit/settings":
      return {
        action: "settings.audit_retention",
        summary: `修改审计日志保留时间为${body.retentionDays === 0 ? "永久" : ` ${body.retentionDays} 天`}${
          res.deleted ? `，清理 ${res.deleted} 条` : ""
        }`,
      };
    case "POST /backups":
      return {
        action: "backup.create",
        target: res.name ? `backup:${res.name}` : undefined,
        summary: `手动备份${res.count != null ? `：${res.count} 条收藏` : ""}`,
      };
    case "POST /chat":
      return { action: "ai.chat", summary: "AI 问答" };
    case "POST /auth/sign-out":
      return { action: "auth.sign_out", summary: "退出登录" };
  }

  if ((m = p.match(/^\/backups\/([^/]+?)(\/restore)?$/))) {
    const [, name, restore] = m;
    const target = `backup:${name}`;
    if (restore) {
      const mode = body.mode === "replace" ? "覆盖" : "合并";
      if (body.dryRun) return { action: "backup.restore_preview", target, summary: `预览恢复备份 ${name}（${mode}）` };
      const counts = res.inserted != null ? `：恢复 ${res.inserted} 条，跳过 ${res.skipped ?? 0} 条${res.trashed ? `，${res.trashed} 条移到回收站` : ""}` : "";
      return { action: "backup.restore", target, summary: `恢复备份 ${name}（${mode}）${counts}` };
    }
    if (method === "GET") return { action: "backup.download", target, summary: `下载备份 ${name}` };
    if (method === "DELETE") return { action: "backup.delete", target, summary: `删除备份 ${name}` };
  }
  if ((m = p.match(/^\/shares\/([^/]+)$/)) && method === "DELETE") {
    return { action: "share.revoke", target: `share:${m[1]}`, summary: `撤销分享 ${m[1]}` };
  }
  if ((m = p.match(/^\/jobs\/(\w+)\/(start|pause|resume|retry)$/))) {
    const job = m[1] === "reembed" ? "向量索引重建" : "批量整理";
    const verb = { start: "开始", pause: "暂停", resume: "继续", retry: "重试失败项" }[m[2]];
    return { action: `job.${m[2]}`, target: `job:${m[1]}`, summary: `${verb}${job}${body.mode ? `（${body.mode}）` : ""}` };
  }
  return null;
}
