import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import sql from "../lib/db.js";

const router: import("express").Router = Router();

router.use(requireAuth);

// ── GET /api/portals ──────────────────────────────────────────────────────────

type PortalEntry = {
  id: string;
  name: string;
  protocol: string;
  description: string;
  launchUrl?: string;
  external?: boolean;
  clientId?: string;
  allowedUserIds?: string[];
};

router.get("/", async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";

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
      id: "jwt-bearer",
      name: "JWT Bearer Flow",
      protocol: "jwt",
      description:
        "Server-side JWT assertion exchanged for a Salesforce user session token — no password required.",
      launchUrl: "/salesforce",
      external: false,
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    },
  ];

  // Dynamically add a Token Exchange portal for the first registered client
  const [exchangeClient] = await sql`
    SELECT id, label FROM sf_clients
    WHERE flow_type = 'token_exchange'
    ORDER BY created_at ASC LIMIT 1
  `;

  if (exchangeClient) {
    allPortals.push({
      id: "sf-token-exchange-login",
      name: "Token Exchange Login",
      protocol: "token-exchange",
      description:
        "Exchange your current session token for a Salesforce user session using OAuth 2.0 Token Exchange (RFC 8693) — opens directly in Salesforce.",
      external: false,
      clientId: exchangeClient.id as string,
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    });
  }

  const portals = allPortals
    .filter((p) => !p.allowedUserIds || p.allowedUserIds.includes(userId))
    .map(({ allowedUserIds: _, ...rest }) => rest);

  res.json({ portals });
});

export default router;
