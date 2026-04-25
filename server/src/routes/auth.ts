import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  signToken,
  verifyToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
} from "../lib/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";

const router: import("express").Router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoginBody {
  email: string;
  password: string;
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

    // Replace with your actual user lookup + bcrypt comparison.
    // Checks against env vars so the server is testable without a DB.
    const validEmail = process.env.ADMIN_EMAIL;
    const validPassword = process.env.ADMIN_PASSWORD;

    const credentialsValid =
      validEmail &&
      validPassword &&
      email === validEmail &&
      password === validPassword;

    if (!credentialsValid) {
      res
        .status(401)
        .json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    const user: AuthUser = {
      id: "admin",
      email,
      name: email.split("@")[0] ?? "User",
      provider: "credentials",
    };

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

// ── GET /api/auth/chainlit-token ──────────────────────────────────────────────
// Generates a Chainlit-native JWT (signed with CHAINLIT_AUTH_SECRET) for the
// copilot widget's accessToken. Chainlit validates this internally — no
// header_auth_callback needed.

router.get("/chainlit-token", (req, res) => {
  const chainlitSecret = process.env.CHAINLIT_AUTH_SECRET;
  if (!chainlitSecret) {
    res.status(503).json({ error: "Chainlit auth not configured" });
    return;
  }

  const appToken = req.cookies[getCookieName()] as string | undefined;
  if (!appToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyToken(appToken);
    const chainlitToken = jwt.sign(
      {
        identifier: payload.email,
        metadata: { name: payload.name },
      },
      chainlitSecret,
      { algorithm: "HS256", expiresIn: "15d" },
    );
    console.log("[chainlit-token] generated Chainlit JWT for:", payload.email);
    res.json({ token: chainlitToken });
  } catch {
    res.clearCookie(getCookieName(), { path: "/" });
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
