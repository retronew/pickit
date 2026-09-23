import { TOOLS, ToolError, findTool, type ToolContext } from "./tools";

// A stateless MCP server over Streamable HTTP: each POST carries one JSON-RPC
// message and gets a JSON response (no SSE streams, no sessions), which is
// all a tools-only server needs and fits a Worker request.

export const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "pickit", title: "PickIt", version: "1.0.0" };

const INSTRUCTIONS =
  "PickIt is the user's personal bookmark library. Use search_bookmarks to find saved links by " +
  "topic or description before answering from memory, get_bookmark for details, and " +
  "add_bookmark to save a link the user asks to keep.";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: unknown } };

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function error(id: JsonRpcRequest["id"], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function isRequest(msg: unknown): msg is JsonRpcRequest {
  return (
    !!msg &&
    typeof msg === "object" &&
    (msg as JsonRpcRequest).jsonrpc === "2.0" &&
    typeof (msg as JsonRpcRequest).method === "string"
  );
}

async function callTool(params: Record<string, unknown> | undefined, ctx: ToolContext) {
  const tool = findTool(String(params?.name ?? ""));
  if (!tool) return null;
  const args = (params?.arguments ?? {}) as Record<string, unknown>;
  try {
    const result = await tool.run(args, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: false,
    };
  } catch (err) {
    // Tool failures go back to the model as results, not protocol errors.
    const message = err instanceof ToolError ? err.message : `internal error: ${String(err)}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

/** Handles one JSON-RPC message; null for notifications (no response). */
export async function handleMessage(msg: unknown, ctx: ToolContext): Promise<JsonRpcResponse | null> {
  if (!isRequest(msg)) return error(null, INVALID_REQUEST, "invalid JSON-RPC request");
  const { id, method, params } = msg;
  if (id === undefined) return null; // notifications/initialized, cancelled, …

  switch (method) {
    case "initialize": {
      const requested = String(params?.protocolVersion ?? "");
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map(({ run: _run, ...tool }) => tool),
        },
      };
    case "tools/call": {
      try {
        const result = await callTool(params, ctx);
        if (!result) return error(id, INVALID_PARAMS, `unknown tool: ${String(params?.name)}`);
        return { jsonrpc: "2.0", id, result };
      } catch (err) {
        return error(id, INTERNAL_ERROR, String(err));
      }
    }
    default:
      return error(id, METHOD_NOT_FOUND, `method not found: ${method}`);
  }
}

/** Parses a POST body (one message or a legacy batch) and builds the HTTP response. */
export async function handleMcpPost(body: string, ctx: ToolContext): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return Response.json(error(null, PARSE_ERROR, "parse error"), { status: 400 });
  }
  if (Array.isArray(parsed)) {
    const responses = (await Promise.all(parsed.map((m) => handleMessage(m, ctx)))).filter(Boolean);
    return responses.length ? Response.json(responses) : new Response(null, { status: 202 });
  }
  const response = await handleMessage(parsed, ctx);
  return response ? Response.json(response) : new Response(null, { status: 202 });
}
