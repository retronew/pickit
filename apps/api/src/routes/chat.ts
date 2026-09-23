import { Hono } from "hono";
import { streamText } from "ai";
import { type Env, type ItemRow, ITEM_COLUMNS } from "#types";
import { nearest } from "#vectors";
import { getSettings } from "#settings";
import { createProvider } from "#ai";
import { tr } from "#i18n";
import { aiLocale } from "#locale";
import { chatSystem } from "#prompts";

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
    return c.json({ error: await tr(c, "api_need_chat") }, 400);
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
    system: chatSystem(await aiLocale(c.env.DB), catalog),
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
