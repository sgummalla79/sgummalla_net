'use strict';

const router                                   = require('express').Router();
const requiresLogin                            = require('../middleware/requiresLogin');
const { respondWithSAMLAssertion, buildIdPMetadata } = require('../samlIdp');

// ── GET /saml/metadata ────────────────────────────────────────────────────────
// Salesforce reads this to verify the IdP certificate and SSO URL.
router.get('/saml/metadata', (_req, res) => {
  res.set('Content-Type', 'application/xml');
  res.send(buildIdPMetadata(process.env.BASE_URL));
});

// ── GET|POST /sso ─────────────────────────────────────────────────────────────
// Salesforce Experience Cloud (support.sgummalla.net) redirects here when the
// user has no active Salesforce session. If a Node.js session already exists
// the assertion is posted silently — no login prompt shown.
router.get('/sso',  requiresLogin, (req, res) => respondWithSAMLAssertion(req, res));
router.post('/sso', requiresLogin, (req, res) => respondWithSAMLAssertion(req, res));

module.exports = router;