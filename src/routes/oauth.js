'use strict';

const router = require('express').Router();
const {
  handleDiscovery,
  handleJWKS,
  handleAuthorize,
  handleToken,
  handleUserInfo,
} = require('../oauthServer');

// ── OIDC Discovery ────────────────────────────────────────────────────────────
// Salesforce reads this on Auth Provider setup to auto-configure all endpoints.
router.get('/.well-known/openid-configuration', handleDiscovery);

// ── JWKS ──────────────────────────────────────────────────────────────────────
// Public key — Salesforce verifies the id_token signature against this.
router.get('/oauth/jwks', handleJWKS);

// ── Authorization Code Flow ───────────────────────────────────────────────────
// 1. Salesforce redirects browser here to start login
router.get('/oauth/authorize', handleAuthorize);

// 2. Salesforce exchanges code for tokens (back-channel)
router.post('/oauth/token', handleToken);

// 3. Salesforce fetches user profile for JIT provisioning (back-channel)
router.get('/oauth/userinfo', handleUserInfo);

module.exports = router;