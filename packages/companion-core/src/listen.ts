import { createServer, type Server } from "node:http";
import { getRuntime } from "./context.js";
import { handleUserMessage } from "./chat.js";
import { isReplyGenerating } from "./reply-scheduler.js";
import { startProactiveLoop } from "./proactive.js";

export type ListenOptions = {
  port?: number;
  host?: string;
  /** 默认 true：启动主动 tick 循环 */
  proactive?: boolean;
};

export type ListenHandle = {
  port: number;
  host: string;
  server: Server;
  close: () => Promise<void>;
};

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

/**
 * 最小 HTTP：健康检查 + 发消息 + 拉消息。无鉴权（自行启动示例用）。
 * 默认端口 8790，避免与现网应用 8787 冲突。
 */
export async function listenCompanion(
  opts: ListenOptions = {},
): Promise<ListenHandle> {
  getRuntime(); // 未 createCompanion 则抛错
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 8790;
  const proactive = opts.proactive !== false;

  let loop: ReturnType<typeof setInterval> | null = null;
  if (proactive) {
    loop = startProactiveLoop();
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}:${port}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && path === "/messages") {
        const limit = Number(url.searchParams.get("limit") || "50");
        const messages = getRuntime().store.listMessages(
          Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
        );
        sendJson(res, 200, {
          messages,
          generating: isReplyGenerating(),
        });
        return;
      }

      if (req.method === "POST" && path === "/messages") {
        const body = (await readJsonBody(req)) as { text?: string } | null;
        const text = body?.text?.trim() ?? "";
        if (!text) {
          sendJson(res, 400, { error: "text 不能为空" });
          return;
        }
        const result = await handleUserMessage(text);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  const boundPort =
    address && typeof address === "object" ? address.port : port;

  return {
    port: boundPort,
    host,
    server,
    close: async () => {
      if (loop) clearInterval(loop);
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
