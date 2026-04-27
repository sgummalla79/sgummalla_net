import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import sql from "../lib/db.js";
import { encrypt, decrypt } from "../lib/copilotCrypto.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getCookieName, verifyToken } from "../lib/jwt.js";

const router: import("express").Router = Router();

// ── GET /api/copilot/clients ──────────────────────────────────────────────────

router.get("/clients", requireAuth, async (req: Request, res: Response) => {
  const clients = await sql<
    {
      client_id: string;
      name: string | null;
      allowed_origins: string[];
      created_at: string;
    }[]
  >`
    SELECT client_id, name, allowed_origins, created_at
    FROM copilot_clients
    WHERE user_id = ${req.user!.id}
    ORDER BY created_at DESC
  `;
  res.json(clients);
});

// ── POST /api/copilot/clients ─────────────────────────────────────────────────

router.post("/clients", requireAuth, async (req: Request, res: Response) => {
  const { client_id, client_secret, name, allowed_origins = [] } = req.body;

  if (!client_id || !client_secret || !name) {
    res
      .status(400)
      .json({ error: "client_id, client_secret and name are required" });
    return;
  }

  try {
    await sql`
      INSERT INTO copilot_clients (client_id, encrypted_secret, name, allowed_origins, user_id)
      VALUES (
        ${client_id},
        ${encrypt(client_secret)},
        ${name ?? null},
        ${allowed_origins},
        ${req.user!.id}
      )
    `;
    res.json({ ok: true, client_id });
  } catch (err: any) {
    const isDuplicate = err.code === "23505";
    res.status(isDuplicate ? 409 : 500).json({
      error: isDuplicate ? "client_id already exists" : "Database error",
    });
  }
});

// ── PUT /api/copilot/clients/:clientId ────────────────────────────────────────
// Supports renaming client_id (triggers delete+insert) and rotating client_secret.

router.put(
  "/clients/:clientId",
  requireAuth,
  async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const {
      client_id: newClientId,
      client_secret,
      name,
      allowed_origins = [],
    } = req.body;

    const [existing] = await sql<{ encrypted_secret: string }[]>`
      SELECT encrypted_secret FROM copilot_clients
      WHERE client_id = ${clientId} AND user_id = ${req.user!.id}
    `;

    if (!existing) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const effectiveId = newClientId || clientId;
    const encryptedSecret = client_secret
      ? encrypt(client_secret)
      : existing.encrypted_secret;

    try {
      if (effectiveId !== clientId) {
        // client_id is changing — swap atomically
        await sql.begin(async (tx) => {
          await tx`
            INSERT INTO copilot_clients (client_id, encrypted_secret, name, allowed_origins, user_id)
            VALUES (${effectiveId}, ${encryptedSecret}, ${name ?? null}, ${allowed_origins}, ${req.user!.id})
          `;
          await tx`
            DELETE FROM copilot_clients WHERE client_id = ${clientId} AND user_id = ${req.user!.id}
          `;
        });
      } else {
        await sql`
          UPDATE copilot_clients
          SET encrypted_secret = ${encryptedSecret},
              name             = ${name ?? null},
              allowed_origins  = ${allowed_origins}
          WHERE client_id = ${clientId} AND user_id = ${req.user!.id}
        `;
      }
      res.json({ ok: true, client_id: effectiveId });
    } catch (err: any) {
      const isDuplicate = err.code === "23505";
      res.status(isDuplicate ? 409 : 500).json({
        error: isDuplicate ? "Client ID already exists" : "Database error",
      });
    }
  },
);

// ── DELETE /api/copilot/clients/:clientId ─────────────────────────────────────

router.delete(
  "/clients/:clientId",
  requireAuth,
  async (req: Request, res: Response) => {
    await sql`
      DELETE FROM copilot_clients
      WHERE client_id = ${req.params.clientId}
        AND user_id   = ${req.user!.id}
    `;
    res.json({ ok: true });
  },
);

// ── GET /api/copilot/me-token ─────────────────────────────────────────────────
// Issues a short-lived Chainlit access token for the logged-in user.
// Used by the widget on sgummalla.net pages (Path 1 — own users).

router.get("/me-token", async (req: Request, res: Response) => {
  const sessionToken = req.cookies?.[getCookieName()] as string | undefined;
  if (!sessionToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyToken(sessionToken);
    const secret = process.env.COPILOT_AUTH_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Copilot auth not configured" });
      return;
    }
    const accessToken = jwt.sign(
      { identifier: payload.email, name: payload.name, email: payload.email },
      secret,
      { algorithm: "HS256", expiresIn: "1h" },
    );
    res.json({ access_token: accessToken });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// ── POST /api/copilot/token ───────────────────────────────────────────────────

router.post("/token", async (req: Request, res: Response) => {
  const { assertion } = req.body as { assertion?: string };

  if (!assertion) {
    res.status(400).json({ error: "assertion is required" });
    return;
  }

  const decoded = jwt.decode(assertion);
  if (!decoded || typeof decoded !== "object" || !decoded["client_id"]) {
    res.status(400).json({ error: "Invalid assertion: missing client_id" });
    return;
  }
  const clientId = decoded["client_id"] as string;

  const [client] = await sql<{ encrypted_secret: string }[]>`
    SELECT encrypted_secret
    FROM copilot_clients
    WHERE client_id = ${clientId}
  `;

  if (!client) {
    res.status(401).json({ error: "Unknown client_id" });
    return;
  }

  let clientSecret: string;
  try {
    clientSecret = decrypt(client.encrypted_secret);
  } catch {
    res.status(500).json({ error: "Failed to decrypt client secret" });
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(assertion, clientSecret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
  } catch {
    res.status(401).json({ error: "Invalid assertion signature or expired" });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp - now > 5 * 60) {
    res.status(400).json({ error: "Assertion exp must be at most 5 minutes" });
    return;
  }

  const identifier = payload["identifier"] as string | undefined;
  if (!identifier) {
    res.status(400).json({ error: "Assertion missing identifier" });
    return;
  }

  const copilotAuthSecret = process.env.COPILOT_AUTH_SECRET;
  if (!copilotAuthSecret) {
    res.status(500).json({ error: "Copilot auth not configured" });
    return;
  }

  const accessToken = jwt.sign(
    {
      identifier,
      display_name: payload["metadata"]?.["name"] ?? identifier,
      metadata: payload["metadata"] ?? {},
    },
    copilotAuthSecret,
    { algorithm: "HS256", expiresIn: "1h" },
  );

  res.json({ access_token: accessToken });
});

export default router;
