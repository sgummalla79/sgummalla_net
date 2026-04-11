import { Router, type Request, type Response } from "express";
import { Issuer, type TokenSet, type UserinfoResponse } from "openid-client";
import {
  signToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
} from "../lib/jwt.js";

const router: import("express").Router = Router();

// ── OIDC client (built lazily) ────────────────────────────────────────────────

type OidcClient = InstanceType<InstanceType<typeof Issuer>["Client"]>;
let oidcClient: OidcClient | null = null;

async function getOidcClient(): Promise<OidcClient> {
  if (oidcClient) return oidcClient;

  const issuerUrl = process.env.OIDC_ISSUER;
  if (!issuerUrl)
    throw new Error("OIDC_ISSUER environment variable is not set");

  const issuer = await Issuer.discover(issuerUrl);

  oidcClient = new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID ?? "",
    client_secret: process.env.OIDC_CLIENT_SECRET ?? "",
    redirect_uris: [
      process.env.OIDC_CALLBACK_URL ??
        "http://localhost:3000/api/oidc/callback",
    ],
    response_types: ["code"],
  });

  return oidcClient;
}

// ── GET /api/oidc/initiate ────────────────────────────────────────────────────

router.get("/initiate", async (_req: Request, res: Response) => {
  try {
    const client = await getOidcClient();
    const url = client.authorizationUrl({
      scope: "openid profile email",
      state: Math.random().toString(36).slice(2),
    });
    res.redirect(url);
  } catch (err) {
    console.error("[vZen OIDC]", err);
    res.redirect(
      `${process.env.CLIENT_URL ?? "http://localhost:5173"}/login?error=oidc_failed`,
    );
  }
});

// ── GET /api/oidc/callback ────────────────────────────────────────────────────

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const client = await getOidcClient();
    const params = client.callbackParams(req);
    const callbackUrl =
      process.env.OIDC_CALLBACK_URL ??
      "http://localhost:3000/api/oidc/callback";

    const tokenSet: TokenSet = await client.callback(callbackUrl, params);
    const userinfo: UserinfoResponse = await client.userinfo(tokenSet);

    const user: AuthUser = {
      id: userinfo.sub,
      email: (userinfo.email as string) ?? "",
      name:
        (userinfo.name as string) ??
        (userinfo.preferred_username as string) ??
        (userinfo.email as string) ??
        "",
      provider: "oidc",
    };

    const token = signToken(user);
    res.cookie(getCookieName(), token, cookieOptions());
    res.redirect(`${process.env.CLIENT_URL ?? "http://localhost:5173"}/home`);
  } catch (err) {
    console.error("[vZen OIDC]", err);
    res.redirect(
      `${process.env.CLIENT_URL ?? "http://localhost:5173"}/login?error=oidc_failed`,
    );
  }
});

export default router;
