import type { Request, Response, NextFunction } from "express";
import { log } from "../lib/logger.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on("finish", () => {
    log({
      timestamp,
      level:
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
            ? "warn"
            : "info",
      type: "incoming",
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id,
    });
  });

  next();
}
