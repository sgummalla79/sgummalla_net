import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createProxyMiddleware } from "http-proxy-middleware"; // chainlit-pilot plugin
import { verifyToken, getCookieName } from "./lib/jwt.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import auth0Router from "./routes/auth0.js";
import samlRouter from "./routes/saml.js";
import portalsRouter from "./routes/portals.js";
import samlIdpRouter from "./routes/samlIdp.js";
import oidcIdpRouter from "./routes/oidcIdp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app: express.Application = express();
const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production";

// ── Canonical host redirect (production only) ─────────────────────────────────
// Fly assigns a default *.fly.dev URL alongside the custom domain. Redirect
// any request that doesn't arrive on the canonical host so that only
// sgummallaworks.com works publicly.
const CANONICAL_HOST = process.env.CANONICAL_HOST;
if (isProd && CANONICAL_HOST) {
  app.use((req, res, next) => {
    if (req.hostname !== CANONICAL_HOST) {
      return res.redirect(301, `https://${CANONICAL_HOST}${req.url}`);
    }
    next();
  });
}

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production the client is served by Express itself — no CORS needed.
// In dev the client is on :5173 — CORS required.
if (!isProd) {
  app.use(
    cors({
      origin: CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
}

// cookieParser is hoisted above the Chainlit proxy so the auth guard below
// can read the session cookie before the request is forwarded.
app.use(cookieParser());

// ── Chainlit pilot proxy (chainlit-pilot plugin) ──────────────────────────────
// Must be registered BEFORE body-parsing middlewares so the request stream
// is intact when forwarded to Chainlit. Remove this block to disable.
const chainlitProxy = process.env.CHAINLIT_URL
  ? createProxyMiddleware({
      target: process.env.CHAINLIT_URL,
      changeOrigin: true,
      autoRewrite: true,
      ws: true,
      pathFilter: "/chainlit-app",
    })
  : null;

if (chainlitProxy) {
  // Guard every /chainlit-app/* request — unauthenticated browsers get
  // redirected to /login. cookieParser must run first (hoisted above).
  app.use("/chainlit-app", (req, res, next) => {
    const token = req.cookies[getCookieName()] as string | undefined;
    if (!token) {
      res.redirect(302, "/login");
      return;
    }
    try {
      verifyToken(token);
      next();
    } catch {
      res.clearCookie(getCookieName(), { path: "/" });
      res.redirect(302, "/login");
    }
  });

  // Block direct access to the Chainlit full UI — only the copilot widget
  // (mounted from /auths) is the intended entry point. Sub-paths like
  // /copilot/index.js, WebSocket, and /auth/* still pass through for the widget.
  app.get(["/chainlit-app", "/chainlit-app/"], (_req, res) => {
    res.redirect(302, "/auths");
  });

  app.use(chainlitProxy);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/auth0", auth0Router);
app.use("/api/saml", samlRouter);
app.use("/api/portals", portalsRouter);
app.use("/api/saml", samlIdpRouter);
app.use("/api/oidc", oidcIdpRouter);

// ── Static files (production only) ───────────────────────────────────────────
if (isProd) {
  const publicPath = join(__dirname, "../../public");
  app.use(express.static(publicPath));

  // SPA fallback — Vue Router handles all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(join(publicPath, "index.html"));
  });
}

// ── 404 (dev only — prod handled by SPA fallback above) ───────────────────────
if (!isProd) {
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[Sgummalla Works]", err.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: isProd ? undefined : err.message,
    });
  },
);

const server = app.listen(PORT, () => {
  console.log(`[Sgummalla Works] Server running on http://localhost:${PORT}`);
  console.log(
    `[Sgummalla Works] Environment: ${process.env.NODE_ENV ?? "development"}`,
  );
});

// Wire WebSocket upgrades to the Chainlit proxy (chainlit-pilot plugin)
if (chainlitProxy) {
  server.on("upgrade", chainlitProxy.upgrade);
}

export default app;
