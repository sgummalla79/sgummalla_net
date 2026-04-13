/**
 * Salesforce JWT Bearer Flow — three-phase SSO into Experience Cloud.
 *
 * Phase 1 — Mint JWT assertion signed with RSA private key
 * Phase 2 — POST to EC site token endpoint → access_token (domain-scoped)
 * Phase 3 — Exchange via /singleaccess → frontdoor_uri → redirect user
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

function getPrivateKey(): string {
  if (process.env.IDP_PRIVATE_KEY) return process.env.IDP_PRIVATE_KEY;
  const certsDir = resolve(__dirname, "../../certs");
  return readFileSync(resolve(certsDir, "idp.key"), "utf-8").trim();
}

function getClientId(): string {
  const id = process.env.SF_JWT_CLIENT_ID ?? "";
  if (!id) throw new Error("SF_JWT_CLIENT_ID is not set");
  return id;
}

// ── Phase 1 — Mint JWT assertion ──────────────────────────────────────────────

function mintJWT(sfUsername: string, siteUrl: string): string {
  const key = getPrivateKey();
  const clientId = getClientId();
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientId,
      sub: sfUsername,
      aud: siteUrl, // EC site URL — NOT login.salesforce.com
      exp: now + 300, // 5 minute window
    }),
  ).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${signer.sign(key, "base64url")}`;

  logger.debug("SF JWT Phase 1 — JWT minted", {
    iss: clientId,
    sub: sfUsername,
    aud: siteUrl,
    exp: new Date((now + 300) * 1000).toISOString(),
  });

  return jwt;
}

// ── Phase 2 — Exchange JWT for domain-scoped access token ─────────────────────

async function exchangeJWT(jwt: string, siteUrl: string): Promise<string> {
  const tokenUrl = `${siteUrl}/services/oauth2/token`;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    const msg =
      parsed.error_description ??
      parsed.error ??
      `Token exchange failed (HTTP ${res.status})`;
    logger.error("SF JWT Phase 2 — Token exchange failed", {
      status: res.status,
      msg,
      body: text,
    });
    throw new Error(msg);
  }

  const data = JSON.parse(text) as { access_token: string };
  logger.debug("SF JWT Phase 2 — Access token received", {
    token_length: data.access_token?.length,
  });

  return data.access_token;
}

// ── Phase 3 — Exchange access token for web session ───────────────────────────

async function exchangeForSession(accessToken: string, siteUrl: string): Promise<string> {
  const retUrl = "/s";
  const singleAccessUrl = `${siteUrl}/services/oauth2/singleaccess`;

  const res = await fetch(singleAccessUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      access_token: accessToken,
      retURL: retUrl,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    const msg =
      parsed.error_description ??
      parsed.error ??
      `singleaccess failed (HTTP ${res.status})`;
    logger.error("SF JWT Phase 3 — singleaccess failed", {
      status: res.status,
      msg,
      body: text,
    });
    throw new Error(msg);
  }

  let data: { frontdoor_uri?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }

  if (data.frontdoor_uri) {
    logger.debug("SF JWT Phase 3 — frontdoor_uri received", {
      frontdoor_uri: data.frontdoor_uri.replace(/sid=[^&]+/, "sid=[REDACTED]"),
    });
    return data.frontdoor_uri;
  }

  // Fallback — build frontdoor URL manually from access token
  const retUrlEncoded = encodeURIComponent(retUrl);
  const fallback = `${siteUrl}/secur/frontdoor.jsp?sid=${accessToken}&retURL=${retUrlEncoded}`;
  logger.debug("SF JWT Phase 3 — using frontdoor.jsp fallback", {
    url: fallback.replace(accessToken, "[REDACTED]"),
  });
  return fallback;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function getSalesforceFrontdoorUrl(
  sfUsername: string,
  siteUrl: string,
): Promise<string> {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");

  logger.debug("SF JWT Flow — start", {
    sfUsername,
    siteUrl: normalizedSiteUrl,
    SF_JWT_CLIENT_ID: process.env.SF_JWT_CLIENT_ID ? "✅ set" : "❌ MISSING",
  });

  const jwt = mintJWT(sfUsername, normalizedSiteUrl);
  const accessToken = await exchangeJWT(jwt, normalizedSiteUrl);
  const frontdoorUrl = await exchangeForSession(accessToken, normalizedSiteUrl);

  return frontdoorUrl;
}
