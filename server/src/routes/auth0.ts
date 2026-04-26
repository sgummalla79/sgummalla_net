import { Router, type Request, type Response } from "express";
import { Issuer, type TokenSet, type UserinfoResponse } from "openid-client";
import {
  signToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
  type SfAccount,
} from "../lib/jwt.js";

const router: import("express").Router = Router();

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

// ── GET /api/auth0/initiate ───────────────────────────────────────────────────

router.get("/initiate", async (_req: Request, res: Response) => {
  try {
    const client = await getClient();
    // Request openid profile email — sf_accounts injected via Auth0 Action
    const url = client.authorizationUrl({ scope: "openid profile email" });
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

    const token = signToken(user);
    res.cookie(getCookieName(), token, cookieOptions());
    res.redirect("/auths");
  } catch (err) {
    console.error("[Sgummalla Works Auth0]", err);
    res.redirect("/login?error=auth0_failed");
  }
});

export default router;
