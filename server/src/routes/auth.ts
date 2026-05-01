import { Router } from "express";
import {
  signToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
  type SfAccount,
} from "../lib/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import sql from "../lib/db.js";

const router: import("express").Router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoginBody {
  email: string;
  password: string;
}

// ── Auth0 Resource Owner Password Grant ───────────────────────────────────────

async function loginWithAuth0(
  email: string,
  password: string,
): Promise<{ user: AuthUser; idToken: string | undefined }> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    throw new Error("Auth0 is not configured");
  }

  const tokenRes = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      username: email,
      password,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid profile email",
      connection: "Username-Password-Authentication",
    }),
  });

  if (!tokenRes.ok) {
    const err = (await tokenRes.json().catch(() => ({}))) as {
      error_description?: string;
    };
    throw new Error(err.error_description ?? "Invalid email or password");
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
  };

  const userinfoRes = await fetch(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userinfoRes.ok) throw new Error("Failed to retrieve user info");

  const userinfo = (await userinfoRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    nickname?: string;
    sf_accounts?: SfAccount[];
  };

  const user: AuthUser = {
    id: userinfo.sub,
    email: userinfo.email ?? "",
    name:
      userinfo.name ?? userinfo.nickname ?? userinfo.email ?? "",
    provider: "auth0",
    sfAccounts: userinfo.sf_accounts ?? [],
  };

  return { user, idToken: tokens.id_token };
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post(
  "/login",
  validate({
    email: { type: "email", required: true, maxLength: 254 },
    password: { type: "string", required: true, minLength: 1, maxLength: 128 },
  }),
  async (req, res) => {
    const { email, password } = req.body as LoginBody;

    try {
      const { user, idToken } = await loginWithAuth0(email, password);

      if (idToken) {
        await sql`
          INSERT INTO user_id_tokens (user_id, id_token)
          VALUES (${user.id}, ${idToken})
          ON CONFLICT (user_id) DO UPDATE SET
            id_token   = EXCLUDED.id_token,
            updated_at = now()
        `;
      }

      const token = signToken(user);
      res.cookie(getCookieName(), token, cookieOptions());
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password";
      res.status(401).json({ error: "Unauthorized", message });
    }
  },
);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/logout", (_req, res) => {
  res.clearCookie(getCookieName(), { path: "/" });
  res.json({ message: "Logged out successfully" });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, (_req, res) => {
  res.json({ user: _req.user });
});

// ── GET /api/auth/id-token ────────────────────────────────────────────────────

router.get("/id-token", requireAuth, async (req, res) => {
  const [row] = await sql<{ id_token: string }[]>`
    SELECT id_token FROM user_id_tokens WHERE user_id = ${req.user!.id}
  `;
  if (!row) {
    res.status(404).json({ error: "No ID token found" });
    return;
  }
  res.json({ idToken: row.id_token });
});

export default router;
