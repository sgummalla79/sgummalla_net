import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getSalesforceFrontdoorUrl } from "../lib/sfJwtFlow.js";
import { logger } from "../lib/logger.js";

const router: import("express").Router = Router();

router.use(requireAuth);

// ── GET /api/portals ──────────────────────────────────────────────────────────

router.get("/", (_req: Request, res: Response) => {
  res.json({
    portals: [
      {
        id: "support-portal",
        name: "Support Portal",
        protocol: "saml",
        description: "SP-initiated SAML 2.0 SSO with RSA-signed assertions.",
        launchUrl: "https://support.sgummalla.net/login",
        external: true,
      },
      {
        id: "help-portal",
        name: "Help Portal",
        protocol: "oidc",
        description:
          "OpenID Connect authorization code flow.",
        launchUrl: "https://help.sgummalla.net/login",
        external: true,
      },
      {
        id: "experience-cloud",
        name: "Token Exchange",
        protocol: "jwt",
        description:
          "Server-side JWT assertion exchanged for a domain-scoped Salesforce session.",
        launchUrl: "/api/portals/launch/experience-cloud",
      },
    ],
  });
});

// ── POST /api/portals/launch/experience-cloud ─────────────────────────────────

router.post("/launch/experience-cloud", async (req: Request, res: Response) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const sfClientId = process.env.SF_JWT_CLIENT_ID ?? "";
    const sfAccounts = user.sfAccounts ?? [];

    logger.debug("EC Launch — resolving sf_username", {
      userId: user.id,
      sfClientId,
      sfAccounts,
    });

    // Find the Salesforce account matching the Connected App client_id
    const match = sfAccounts.find((a) => a.client_id === sfClientId);

    if (!match) {
      const available =
        sfAccounts.map((a) => a.label ?? a.client_id).join(", ") || "none";
      res.status(400).json({
        error: `No Salesforce account configured for client_id: ${sfClientId}`,
        hint: `Available accounts in user profile: ${available}`,
      });
      return;
    }

    logger.debug("EC Launch — sf_username resolved", {
      sf_username: match.sf_username,
      label: match.label,
    });

    const frontdoorUrl = await getSalesforceFrontdoorUrl(match.sf_username);
    res.json({ frontdoorUrl });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to launch Experience Cloud";
    console.error("[vZen Portals] EC launch error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
