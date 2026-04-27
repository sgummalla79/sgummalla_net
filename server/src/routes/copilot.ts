import { type Request, type Response, type NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt from "jsonwebtoken";
import { getCookieName, verifyToken, type JwtPayload } from "../lib/jwt.js";

const CHAINLIT_URL = process.env.CHAINLIT_URL ?? "http://localhost:8000";

function getCopilotSecret(): string {
  const secret = process.env.COPILOT_AUTH_SECRET;
  if (!secret) throw new Error("COPILOT_AUTH_SECRET is not set");
  return secret;
}

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

function signCopilotToken(payload: JwtPayload): string {
  return jwt.sign(
    { identifier: payload.email, name: payload.name, email: payload.email },
    getCopilotSecret(),
    { algorithm: "HS256", expiresIn: "1h" },
  );
}

// ── Auth guard ────────────────────────────────────────────────────────────────

export function copilotAuthGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[getCookieName()] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(token);
    (req as any)._copilotToken = signCopilotToken(payload);
    next();
  } catch {
    res.clearCookie(getCookieName());
    res.status(401).json({ error: "Unauthorized" });
  }
}

// ── HTTP proxy ────────────────────────────────────────────────────────────────
// Express strips "/copilot" before this middleware sees the path.
// pathRewrite adds it back so Chainlit (started with --root-path /copilot)
// receives the prefix it expects on every route.

export const copilotProxy = createProxyMiddleware({
  target: CHAINLIT_URL,
  changeOrigin: true,
  pathRewrite: { "^": "/copilot" },
  on: {
    proxyReq: (proxyReq, req) => {
      const copilotToken = (req as any)._copilotToken;
      if (copilotToken) {
        proxyReq.setHeader("x-copilot-token", copilotToken);
      }
    },
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
// We verify the session cookie, sign a copilot token, inject it as a header,
// then strip "/copilot" so pathRewrite can add it back before forwarding.

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
    const payload = verifyToken(token);
    req.headers["x-copilot-token"] = signCopilotToken(payload);
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  req.url = req.url.slice("/copilot".length) || "/";
  (copilotProxy as any).upgrade(req, socket, head);
}
