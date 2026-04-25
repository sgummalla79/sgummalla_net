import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getSalesforceFrontdoorUrl } from "../lib/sfJwtFlow.js";
import { logger } from "../lib/logger.js";

const router: import("express").Router = Router();

router.use(requireAuth);

// ── GET /api/portals ──────────────────────────────────────────────────────────

type PortalEntry = {
  id: string;
  name: string;
  protocol: string;
  description: string;
  launchUrl: string;
  external?: boolean;
  allowedUserIds?: string[];
};

router.get("/", (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";

  // chainlit-pilot plugin — conditionally included when CHAINLIT_URL is set
  const chainlitPortal: PortalEntry[] = process.env.CHAINLIT_URL
    ? [
        {
          id: "chainlit-pilot",
          name: "AI Pilot",
          protocol: "chainlit",
          description:
            "Conversational AI assistant powered by Chainlit and GPT-4o.",
          launchUrl: "",
        },
      ]
    : [];

  const allPortals: PortalEntry[] = [
    {
      id: "support-portal",
      name: "Support Portal",
      protocol: "saml",
      description: "SP-initiated SAML 2.0 SSO with RSA-signed assertions.",
      launchUrl: "https://support.sgummalla.net/login",
      external: true,
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    },
    {
      id: "help-portal",
      name: "Help Portal",
      protocol: "oidc",
      description: "OpenID Connect authorization code flow.",
      launchUrl: "https://help.sgummalla.net/login",
      external: true,
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    },
    {
      id: "experience-cloud",
      name: "Token Exchange",
      protocol: "jwt",
      description:
        "Server-side JWT assertion exchanged for a domain-scoped Salesforce session.",
      launchUrl: "/api/portals/launch/experience-cloud",
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    },
    ...chainlitPortal,
  ];

  const portals = allPortals
    .filter((p) => !p.allowedUserIds || p.allowedUserIds.includes(userId))
    .map(({ allowedUserIds: _, ...rest }) => rest);

  res.json({ portals });
});

const PORTAL_SITE_URLS: Record<string, string> = {
  support: "https://support.sgummalla.net",
  help: "https://help.sgummalla.net",
};

// ── POST /api/portals/launch/experience-cloud ─────────────────────────────────

router.post("/launch/experience-cloud", async (req: Request, res: Response) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const portal: string = req.body?.portal ?? "support";
  const siteUrl = PORTAL_SITE_URLS[portal];

  if (!siteUrl) {
    res.status(400).json({
      error: `Unknown portal: ${portal}. Valid options: ${Object.keys(PORTAL_SITE_URLS).join(", ")}`,
    });
    return;
  }

  try {
    const sfClientId = process.env.SF_JWT_CLIENT_ID ?? "";
    const sfAccounts = user.sfAccounts ?? [];

    logger.debug("EC Launch — resolving sf_username", {
      userId: user.id,
      sfClientId,
      sfAccounts,
      portal,
      siteUrl,
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

    const frontdoorUrl = await getSalesforceFrontdoorUrl(
      match.sf_username,
      siteUrl,
    );
    res.json({ frontdoorUrl });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to launch Experience Cloud";
    console.error("[Sgummalla Works Portals] EC launch error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
