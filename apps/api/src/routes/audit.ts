import { Hono } from "hono";
import type { Env } from "#types";
import {
  MAX_RETENTION_DAYS,
  auditStats,
  getRetentionDays,
  isValidRetention,
  pruneAudit,
  setRetentionDays,
} from "#audit/index";

export const auditRoutes = new Hono<{ Bindings: Env }>();

interface AuditRow {
  id: number;
  created_at: number;
  actor: string;
  action: string;
  target: string;
  summary: string;
  status: number | null;
  ip: string;
  user_agent: string;
  detail: string;
}

function toJson(r: AuditRow) {
  let detail: unknown = {};
  try {
    detail = JSON.parse(r.detail);
  } catch {
    // keep {}
  }
  return {
    id: r.id,
    createdAt: r.created_at,
    actor: r.actor,
    action: r.action,
    target: r.target,
    summary: r.summary,
    status: r.status,
    ip: r.ip,
    userAgent: r.user_agent,
    detail,
  };
}

/**
 * GET /api/audit
 *   category  action prefix, e.g. "item" (matches item.*)
 *   action    exact action
 *   actor     exact actor
 *   result    "ok" | "error"
 *   q         substring of summary / target / ip
 *   from, to  ms timestamps
 *   before    id cursor for older pages; after: id for newer entries (live refresh)
 *   limit     default 50, max 200
 */
auditRoutes.get("/", async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const args: unknown[] = [];
  if (q.category === "other") {
    where.push("action NOT LIKE '%.%'");
  } else if (q.category) {
    where.push("action LIKE ?");
    args.push(`${q.category}.%`);
  }
  if (q.action) {
    where.push("action = ?");
    args.push(q.action);
  }
  if (q.actor) {
    where.push("actor = ?");
    args.push(q.actor);
  }
  if (q.result === "ok") where.push("(status IS NULL OR status < 400)");
  if (q.result === "error") where.push("status >= 400");
  if (q.q) {
    where.push("(summary LIKE ? OR target LIKE ? OR ip LIKE ?)");
    const like = `%${q.q}%`;
    args.push(like, like, like);
  }
  if (q.from) {
    where.push("created_at >= ?");
    args.push(Number(q.from));
  }
  if (q.to) {
    where.push("created_at <= ?");
    args.push(Number(q.to));
  }
  if (q.before) {
    where.push("id < ?");
    args.push(Number(q.before));
  }
  if (q.after) {
    where.push("id > ?");
    args.push(Number(q.after));
  }
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
  const sql = `SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY id DESC LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...args, limit + 1)
    .all<AuditRow>();
  const page = results.slice(0, limit);
  return c.json({
    entries: page.map(toJson),
    hasMore: results.length > limit,
  });
});

/** Distinct actions and actors for the filter menus. */
auditRoutes.get("/facets", async (c) => {
  const [actions, actors] = await c.env.DB.batch<{ value: string; count: number }>([
    c.env.DB.prepare(
      "SELECT action AS value, COUNT(*) AS count FROM audit_log GROUP BY action ORDER BY action",
    ),
    c.env.DB.prepare(
      "SELECT actor AS value, COUNT(*) AS count FROM audit_log GROUP BY actor ORDER BY count DESC",
    ),
  ]);
  return c.json({ actions: actions.results, actors: actors.results });
});

/** Retention setting plus current usage. */
auditRoutes.get("/settings", async (c) => {
  const [retentionDays, stats] = await Promise.all([
    getRetentionDays(c.env.DB),
    auditStats(c.env.DB),
  ]);
  return c.json({ retentionDays, maxRetentionDays: MAX_RETENTION_DAYS, stats });
});

/** Sets retention (0 = forever) and prunes right away when it got shorter. */
auditRoutes.put("/settings", async (c) => {
  const body = await c.req.json<{ retentionDays?: unknown }>().catch(() => ({}) as { retentionDays?: unknown });
  if (!isValidRetention(body.retentionDays)) {
    return c.json({ error: `保留天数需为 0（永久）到 ${MAX_RETENTION_DAYS} 之间的整数` }, 400);
  }
  await setRetentionDays(c.env.DB, body.retentionDays);
  const deleted = await pruneAudit(c.env.DB, body.retentionDays);
  return c.json({ retentionDays: body.retentionDays, deleted, stats: await auditStats(c.env.DB) });
});
