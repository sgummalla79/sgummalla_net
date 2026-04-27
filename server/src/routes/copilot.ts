import { createProxyMiddleware } from "http-proxy-middleware";

const CHAINLIT_URL = process.env.CHAINLIT_URL ?? "http://localhost:8000";

// ── HTTP proxy ────────────────────────────────────────────────────────────────
// Express strips "/copilot" before this middleware sees the path.
// pathRewrite adds it back so Chainlit (started with --root-path /copilot)
// receives the prefix it expects on every route.

export const copilotProxy = createProxyMiddleware({
  target: CHAINLIT_URL,
  changeOrigin: true,
  pathRewrite: { "^": "/copilot" },
  on: {
    error: (_err, _req, res: any) => {
      if (typeof res.writeHead === "function") {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Copilot unavailable — is Chainlit running on port 8000?");
      } else if (typeof res.status === "function") {
        res.status(502).send("Copilot unavailable.");
      }
    },
  },
});

// ── WebSocket upgrade ─────────────────────────────────────────────────────────
// httpServer upgrade events arrive with the full path.
// Strip "/copilot" first — pathRewrite adds it back before forwarding.

export function handleCopilotUpgrade(req: any, socket: any, head: any): void {
  if (!req.url?.startsWith("/copilot")) return;
  req.url = req.url.slice("/copilot".length) || "/";
  (copilotProxy as any).upgrade(req, socket, head);
}
