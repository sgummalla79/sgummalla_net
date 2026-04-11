import jwt, { type SignOptions } from "jsonwebtoken";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  provider: "credentials" | "auth0" | "saml" | "oidc";
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  provider: JwtPayload["provider"];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

export function getCookieName(): string {
  return process.env.JWT_COOKIE_NAME ?? "vzen_token";
}

// ── Sign ──────────────────────────────────────────────────────────────────────

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
  };

  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "1h") as string &
      SignOptions["expiresIn"],
    algorithm: "HS256",
  };

  return jwt.sign(payload, getSecret(), options);
}

// ── Verify ────────────────────────────────────────────────────────────────────

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  return decoded as JwtPayload;
}

// ── Cookie options ────────────────────────────────────────────────────────────

export function cookieOptions(maxAgeMs: number = 60 * 60 * 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
}
