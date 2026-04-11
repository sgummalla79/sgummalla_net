import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.js";

// ── App ───────────────────────────────────────────────────────────────────────

const app: express.Application = express();
const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true, // required for httpOnly cookie exchange
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api", healthRouter);

// Auth routes added in Module 6
// Federated auth routes added in Module 7

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
