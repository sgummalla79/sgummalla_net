import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireOwner } from "../middleware/requireOwner.js";
import { setDebugMode, isDebugMode } from "../lib/logger.js";

const router: import("express").Router = Router();

// ── GET /api/debug/mode ───────────────────────────────────────────────────────

router.get(
  "/mode",
  requireAuth,
  requireOwner,
  (_req: Request, res: Response) => {
    res.json({ enabled: isDebugMode() });
  },
);

// ── POST /api/debug/mode ──────────────────────────────────────────────────────

router.post(
  "/mode",
  requireAuth,
  requireOwner,
  (req: Request, res: Response) => {
    const { enabled } = req.body as { enabled: boolean };
    setDebugMode(!!enabled);
    console.log(`[Debug mode] ${isDebugMode() ? "ON" : "OFF"}`);
    res.json({ enabled: isDebugMode() });
  },
);

export default router;
