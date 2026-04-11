import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import auth0Router from "./routes/auth0.js";
import samlRouter from "./routes/saml.js";
import oidcRouter from "./routes/oidc.js";
import portalsRouter from "./routes/portals.js";

// ── App ───────────────────────────────────────────────────────────────────────

const app: express.Application = express();
const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/auth0", auth0Router);
app.use("/api/saml", samlRouter);
app.use("/api/oidc", oidcRouter);
app.use("/api/portals", portalsRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[vZen]", err.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[vZen] Server running on http://localhost:${PORT}`);
  console.log(`[vZen] Client origin: ${CLIENT_URL}`);
  console.log(`[vZen] Environment: ${process.env.NODE_ENV ?? "development"}`);
});

export default app;
