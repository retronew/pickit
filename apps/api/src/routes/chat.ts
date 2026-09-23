import { Hono } from "hono";
import { streamText } from "ai";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { nearest } from "#vectors";
import { getSettings } from "#settings";
import { createProvider } from "#ai";

export const chatRoutes = new Hono<{ Bindings: Env }>();

interface ItemLite {
  id: number;
  name: string;
  url: string;
  note: string;
  category: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

chatRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    message?: string;
    messages?: ChatMessage[];
  }>();
  const messages: ChatMessage[] = body.messages?.length
    ? body.messages
    : body.message
      ? [{ role: "user", content: body.message }]
      : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content.trim()) {
    return c.json({ error: "message required" }, 400);
  }

  const settings = await getSettings(c.env.DB);
  const provider = settings ? createProvider(settings) : null;
  if (!provider?.chat) {
    return c.json({ error: "还没有配置对话模型，请先到「设置」里完成配置" }, 400);
  }

  // retrieve relevant items: semantic if possible, otherwise dump categories/summary
  let context: ItemLite[] = [];
  const { results: allRows } = await c.env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL`,
  ).all<ItemRow>();

  if (provider.embedding && allRows.some((r) => r.has_embedding)) {
    try {
      const { embedText } = await import("#ai");
      const qvec = await embedText(provider, lastUser.content);
      if (qvec) {
        const top = await nearest(c.env.DB, qvec, provider.embeddingModelId!, { limit: 8 });
        const byId = new Map(allRows.map((r) => [r.id, r]));
        context = top.flatMap((t) => (byId.has(t.id) ? [toLite(byId.get(t.id)!)] : []));
      }
    } catch {
      // fallthrough to keyword
    }
  }
  if (context.length === 0) {
    context = allRows.slice(0, 50).map(toLite);
  }

  const catalog = context
    .map((i) => `- [[${i.id}]] ${i.name} [${i.category}] ${i.note} (${i.url})`)
    .join("\n");

  const result = streamText({
    model: provider.chat,
    system:
      "你是用户的技术收藏库助手。用户会描述需求，你基于提供的收藏条目推荐最合适的方案。" +
      "回复要求：给出推荐的条目、选择理由，简洁实用；如收藏中没有合适方案，诚实说明并给出通用建议。" +
      "提到某个收藏条目时，必须使用 [[id]] 格式引用它（例如 [[123]]），不要用其他方式写出条目名称或链接。\n\n" +
      `用户收藏（相关条目）：\n${catalog}`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return result.toTextStreamResponse();
});

function toLite(r: ItemRow): ItemLite {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    note: r.note,
    category: r.category,
  };
}
