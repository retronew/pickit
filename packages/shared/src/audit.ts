// Audit action names (written by the API) and their display labels (used
// by the web app). audit.test.ts in the API checks every emitted action has one.

export const AUDIT_CATEGORIES: Record<string, string> = {
  item: "收藏",
  tag: "标签",
  share: "分享",
  settings: "设置",
  job: "批量任务",
  ai: "AI",
  auth: "登录",
  backup: "备份",
  system: "系统",
  other: "其他",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "item.create": "添加收藏",
  "item.update": "编辑收藏",
  "item.pin": "置顶",
  "item.unpin": "取消置顶",
  "item.delete": "删除",
  "item.restore": "恢复",
  "item.purge": "彻底删除",
  "item.summarize": "AI 摘要",
  "item.check": "检查链接",
  "item.reembed": "重建向量",
  "item.visit": "打开收藏",
  "item.analyze": "AI 识别",
  "item.import": "导入",
  "item.import_preview": "预览导入",
  "item.export": "导出",
  "item.merge": "合并重复",
  "item.bulk_delete": "批量删除",
  "item.bulk_pin": "批量置顶",
  "item.bulk_unpin": "批量取消置顶",
  "item.bulk_category": "批量改分类",
  "item.bulk_purge": "清空回收站",
  "tag.rename": "重命名标签",
  "tag.delete": "删除标签",
  "share.create": "创建分享",
  "share.revoke": "撤销分享",
  "settings.ai_update": "修改 AI 配置",
  "settings.ai_models": "获取模型列表",
  "settings.ai_test": "测试模型",
  "settings.token_reset": "重置 API Token",
  "settings.token_delete": "删除 API Token",
  "settings.allowed_emails": "修改允许邮箱",
  "settings.audit_retention": "修改审计保留时间",
  "job.start": "开始任务",
  "job.pause": "暂停任务",
  "job.resume": "继续任务",
  "job.retry": "重试任务",
  "ai.chat": "AI 问答",
  "auth.sign_in": "登录",
  "auth.sign_in_denied": "拒绝登录",
  "auth.sign_out": "退出登录",
  "backup.create": "手动备份",
  "backup.restore": "恢复备份",
  "backup.restore_preview": "预览恢复",
  "backup.download": "下载备份",
  "backup.delete": "删除备份",
  "system.backup": "每日备份",
  "system.link_check": "链接检查",
  other: "其他",
};

export function auditActionCategory(action: string): string {
  return action.includes(".") ? action.split(".")[0] : "other";
}

/** Label for an action; unknown ones fall back to "<category> · <action>". */
export function auditActionLabel(action: string): string {
  const label = AUDIT_ACTION_LABELS[action];
  if (label) return label;
  const category = AUDIT_CATEGORIES[auditActionCategory(action)] ?? "其他";
  return `${category} · ${action}`;
}
