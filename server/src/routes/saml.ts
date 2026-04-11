import { Router } from "express";
import passport from "passport";
import {
  Strategy as SamlStrategy,
  type Profile,
  type VerifyWithoutRequest,
} from "passport-saml";
import {
  signToken,
  cookieOptions,
  getCookieName,
  type AuthUser,
} from "../lib/jwt.js";

const router: import("express").Router = Router();

// ── Keep a reference to the strategy for metadata generation ──────────────────
let samlStrategy: SamlStrategy | null = null;

function buildVerify(): VerifyWithoutRequest {
  return (
    profile: Profile | null | undefined,
    done: (
      err: Error | null,
      user?: Record<string, unknown>,
      info?: Record<string, unknown>,
    ) => void,
  ) => {
    if (!profile) {
      done(new Error("No SAML profile returned"));
      return;
    }

    const user: AuthUser = {
      id: (profile.nameID as string) ?? "",
      email: (profile.email as string) ?? "",
      name:
        `${(profile.firstName as string) ?? ""} ${(profile.lastName as string) ?? ""}`.trim() ||
        ((profile.email as string) ?? ""),
      provider: "saml",
    };

    done(null, user as unknown as Record<string, unknown>);
  };
}

function ensureStrategy(): SamlStrategy {
  if (samlStrategy) return samlStrategy;

  samlStrategy = new SamlStrategy(
    {
      callbackUrl:
        process.env.SAML_CALLBACK_URL ??
        "http://localhost:3000/api/saml/callback",
      entryPoint: process.env.SAML_ENTRY_POINT ?? "",
      issuer: process.env.SAML_ISSUER ?? "",
      cert: process.env.SAML_CERT ?? "",
      wantAssertionsSigned: true,
    },
    buildVerify(),
  );

  passport.use("saml", samlStrategy as unknown as passport.Strategy);
  return samlStrategy;
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user as Express.User));

router.use(passport.initialize());

// ── GET /api/saml/initiate ────────────────────────────────────────────────────

router.get("/initiate", (req, res, next) => {
  ensureStrategy();
  passport.authenticate("saml", { session: false })(req, res, next);
});

// ── POST /api/saml/callback — ACS endpoint ────────────────────────────────────

router.post("/callback", (req, res, next) => {
  ensureStrategy();

  passport.authenticate(
    "saml",
    { session: false },
    (err: Error | null, user?: Record<string, unknown>) => {
      if (err || !user) {
        console.error("[vZen SAML]", err?.message ?? "No user returned");
        res.redirect(
          `${process.env.CLIENT_URL ?? "http://localhost:5173"}/login?error=saml_failed`,
        );
        return;
      }

      const token = signToken(user as unknown as AuthUser);
      res.cookie(getCookieName(), token, cookieOptions());
      res.redirect(`${process.env.CLIENT_URL ?? "http://localhost:5173"}/home`);
    },
  )(req, res, next);
});

// ── GET /api/saml/metadata ────────────────────────────────────────────────────

router.get("/metadata", (_req, res) => {
  const strategy = ensureStrategy();
  res.type("application/xml");
  res.send(
    strategy.generateServiceProviderMetadata(
      null,
      process.env.SAML_CERT ?? null,
    ),
  );
});

export default router;
