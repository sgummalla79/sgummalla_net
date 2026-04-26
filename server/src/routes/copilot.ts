import { type Request, type Response, type NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { getCookieName, verifyToken } from "../lib/jwt.js";

const CHAINLIT_URL = process.env.CHAINLIT_URL ?? "http://localhost:8000";

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// ── Auth guard ────────────────────────────────────────────────────────────────
// Mounted at app.use("/copilot", copilotAuthGuard, ...) so req.path is
// relative to /copilot — no prefix check needed here.

export function copilotAuthGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[getCookieName()] as string | undefined;
  if (!token) {
    res.redirect("/login?redirect=%2Fcopilot");
    return;
  }
  try {
    verifyToken(token);
    next();
  } catch {
    res.clearCookie(getCookieName());
    res.redirect("/login?redirect=%2Fcopilot");
  }
}

// ── Proxy ─────────────────────────────────────────────────────────────────────
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
// httpServer upgrade events arrive with the full path, so we strip "/copilot"
// first — the proxy's pathRewrite then adds it back before forwarding.

export function handleCopilotUpgrade(req: any, socket: any, head: any): void {
  if (!req.url?.startsWith("/copilot")) return;

  const cookies = parseCookies(req.headers?.cookie ?? "");
  const token = cookies[getCookieName()];
  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  try {
    verifyToken(token);
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Strip /copilot so pathRewrite in the proxy adds it back correctly
  req.url = req.url.slice("/copilot".length) || "/";
  (copilotProxy as any).upgrade(req, socket, head);
}
