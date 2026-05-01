import { Router, type Request, type Response } from "express";
import { Issuer, type TokenSet, type UserinfoResponse } from "openid-client";
import {
  signToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
  type SfAccount,
} from "../lib/jwt.js";
import sql from "../lib/db.js";

const router: import("express").Router = Router();

// ── Auth0 OIDC client ─────────────────────────────────────────────────────────

type Auth0Client = InstanceType<InstanceType<typeof Issuer>["Client"]>;
let auth0Client: Auth0Client | null = null;

async function getClient(): Promise<Auth0Client> {
  if (auth0Client) return auth0Client;

  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) throw new Error("AUTH0_DOMAIN is not set");

  const issuer = await Issuer.discover(`https://${domain}`);

  auth0Client = new issuer.Client({
    client_id: process.env.AUTH0_CLIENT_ID ?? "",
    client_secret: process.env.AUTH0_CLIENT_SECRET ?? "",
    redirect_uris: [
      process.env.AUTH0_CALLBACK_URL ??
        "http://localhost:3000/api/auth0/callback",
    ],
    response_types: ["code"],
  });

  return auth0Client;
}

// ── Management API helpers ────────────────────────────────────────────────────

const KNOWN_LABELS: Record<string, string> = {
  "google-oauth2": "Google",
  github: "GitHub",
  twitter: "Twitter",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  windowslive: "Microsoft",
  apple: "Apple",
};

interface MgmtTokenCache {
  token: string;
  expiresAt: number;
}

interface Auth0Connection {
  name: string;
  label: string;
  strategy: string;
}

interface ConnectionsCache {
  data: Auth0Connection[];
  expiresAt: number;
}

let mgmtTokenCache: MgmtTokenCache | null = null;
let connectionsCache: ConnectionsCache | null = null;

async function getMgmtToken(domain: string): Promise<string> {
  if (mgmtTokenCache && Date.now() < mgmtTokenCache.expiresAt) {
    return mgmtTokenCache.token;
  }

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
  });

  if (!res.ok) throw new Error(`Management token fetch failed: ${res.status}`);

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  mgmtTokenCache = {
    token: data.access_token,
    // Refresh 60s before actual expiry
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return mgmtTokenCache.token;
}

async function fetchConnections(): Promise<Auth0Connection[]> {
  if (connectionsCache && Date.now() < connectionsCache.expiresAt) {
    return connectionsCache.data;
  }

  const domain = process.env.AUTH0_DOMAIN!;
  const clientId = process.env.AUTH0_CLIENT_ID!;
  const token = await getMgmtToken(domain);

  const res = await fetch(
    `https://${domain}/api/v2/connections?client_id=${encodeURIComponent(clientId)}&fields=name,strategy,display_name,enabled_clients`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Connections fetch failed: ${res.status}`);

  const raw = (await res.json()) as Array<{
    name: string;
    strategy: string;
    display_name?: string;
    enabled_clients: string[];
  }>;

  const data: Auth0Connection[] = raw
    // Skip Auth0's own username/password DB — the credential form already covers it
    .filter((c) => c.strategy !== "auth0")
    // Only include connections explicitly enabled for this client (mirrors what Auth0 Dashboard shows)
    .filter((c) => c.enabled_clients.includes(clientId))
    .map((c) => ({
      name: c.name,
      strategy: c.strategy,
      label:
        c.display_name ??
        KNOWN_LABELS[c.name] ??
        KNOWN_LABELS[c.strategy] ??
        c.name,
    }));

  // Cache for 1 hour
  connectionsCache = { data, expiresAt: Date.now() + 60 * 60 * 1000 };
  return data;
}

// ── GET /api/auth0/connections ────────────────────────────────────────────────

router.get("/connections", async (_req: Request, res: Response) => {
  try {
    const connections = await fetchConnections();
    res.json(connections);
  } catch (err) {
    console.error("[Auth0 connections]", err);
    res.json([]);
  }
});

// ── GET /api/auth0/initiate ───────────────────────────────────────────────────

router.get("/initiate", async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    const connection = (req.query.connection as string) || undefined;
    // Request openid profile email — sf_accounts injected via Auth0 Action
    const url = client.authorizationUrl({
      scope: "openid profile email",
      ...(connection && { connection }),
    });
    res.redirect(url);
  } catch (err) {
    console.error("[Sgummalla Works Auth0]", err);
    res.redirect("/login?error=auth0_unavailable");
  }
});

// ── GET /api/auth0/callback ───────────────────────────────────────────────────

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const callbackUrl =
      process.env.AUTH0_CALLBACK_URL ??
      "http://localhost:3000/api/auth0/callback";

    const tokenSet: TokenSet = await client.callback(callbackUrl, params);
    const userinfo: UserinfoResponse = await client.userinfo(tokenSet);

    // Auth0 Action injects sf_accounts as a custom claim
    const sfAccounts =
      (userinfo["sf_accounts"] as SfAccount[] | undefined) ?? [];

    const user: AuthUser = {
      id: userinfo.sub,
      email: (userinfo.email as string) ?? "",
      name:
        (userinfo.name as string) ??
        (userinfo.nickname as string) ??
        (userinfo.email as string) ??
        "",
      provider: "auth0",
      sfAccounts,
    };

    // Debug: log the Auth0 id_token claims
    if (tokenSet.id_token) {
      try {
        const [, payloadB64] = tokenSet.id_token.split(".");
        const claims = JSON.parse(
          Buffer.from(payloadB64, "base64url").toString("utf-8"),
        );
        console.log("[Auth0 id_token claims]", JSON.stringify(claims, null, 2));
      } catch {
        console.log("[Auth0 id_token] could not decode payload");
      }
    }

    // Persist the Auth0 id_token for Token Exchange flow
    if (tokenSet.id_token) {
      await sql`
        INSERT INTO user_id_tokens (user_id, id_token)
        VALUES (${user.id}, ${tokenSet.id_token})
        ON CONFLICT (user_id) DO UPDATE SET
          id_token   = EXCLUDED.id_token,
          updated_at = now()
      `;
    }

    const token = signToken(user);
    res.cookie(getCookieName(), token, cookieOptions());
    res.redirect("/auths");
  } catch (err) {
    console.error("[Sgummalla Works Auth0]", err);
    res.redirect("/login?error=auth0_failed");
  }
});

export default router;
