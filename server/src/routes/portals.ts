import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router: import("express").Router = Router();

// All portal routes require a valid JWT cookie
router.use(requireAuth);

// ── GET /api/portals ──────────────────────────────────────────────────────────

router.get("/", (_req, res) => {
  res.json({
    portals: [
      {
        id: "experience-cloud",
        name: "Experience Cloud",
        protocol: "jwt",
        description:
          "Server-side JWT assertion exchanged for a domain-scoped Salesforce session.",
        launchUrl: "/api/portals/launch/experience-cloud",
      },
      {
        id: "support-portal",
        name: "Support Portal",
        protocol: "oidc",
        description:
          "OpenID Connect authorization code flow via the vZen OAuth server.",
        launchUrl: "https://support.sgummalla.net/login",
        external: true,
      },
      {
        id: "help-portal",
        name: "Help Portal",
        protocol: "saml",
        description: "SP-initiated SAML 2.0 SSO with RSA-signed assertions.",
        launchUrl: "http://help.sgummalla.net/login",
        external: true,
      },
    ],
  });
});

// ── POST /api/portals/launch/experience-cloud ─────────────────────────────────

router.post("/launch/experience-cloud", (req, res) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // In production: generate a Salesforce JWT assertion here using the
  // connected app private key, then call the singleaccess endpoint.
  // For now return a placeholder so the route is testable.
  res.json({
    message: "Experience Cloud launch initiated",
    user: { email: user.email, name: user.name },
    note: "Implement Salesforce JWT assertion in production",
  });
});

export default router;
