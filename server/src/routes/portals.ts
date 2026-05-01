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
  disabled?: boolean;
  clients?: Array<{ id: string; label: string }>;
  allowedUserIds?: string[];
};

router.get("/", async (req: Request, res: Response) => {
  const userId = req.user?.id ?? "";

  const allPortals: PortalEntry[] = [
    {
      id: "support-portal",
      name: "Support Portal",
      protocol: "saml",
      description:
        "SP-initiated SAML 2.0 SSO — browser redirects to your Identity Provider for assertion-based authentication.",
      launchUrl: "https://support.sgummalla.net/login",
      external: true,
      disabled: true,
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    },
    {
      id: "help-portal",
      name: "Help Portal",
      protocol: "oidc",
      description:
        "OpenID Connect authorization code flow — Identity Provider issues tokens on successful user authentication.",
      launchUrl: "https://help.sgummalla.net/login",
      external: true,
      disabled: true,
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    },
  ];

  // Token Exchange portal — lists all registered clients for selection
  const exchangeClients = await sql<{ id: string; label: string }[]>`
    SELECT id, label FROM sf_clients
    WHERE flow_type = 'token_exchange'
    ORDER BY created_at ASC
  `;

  if (exchangeClients.length > 0) {
    allPortals.push({
      id: "sf-token-exchange-login",
      name: "Token Exchange Login",
      protocol: "token-exchange",
      description:
        "Exchange your web session for a Salesforce user session using OAuth 2.0 Token Exchange",
      external: false,
      clients: exchangeClients.map((r) => ({ id: r.id, label: r.label })),
      allowedUserIds: ["auth0|68d40e8f46b12057807fce21"],
    });
  }

  const portals = allPortals
    .filter((p) => !p.allowedUserIds || p.allowedUserIds.includes(userId))
    .map(({ allowedUserIds: _, ...rest }) => rest);

  res.json({ portals });
});

export default router;
