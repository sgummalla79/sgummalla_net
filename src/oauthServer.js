'use strict';
/**
 * oauthServer.js
 * ──────────────────────────────────────────────────────────────
 * Turns this Node.js app into a minimal OIDC Authorization Server
 * so Salesforce Experience Cloud (help.sgummalla.net) can use it
 * as a Custom Auth Provider via the Authorization Code Flow.
 *
 * Endpoints:
 *   GET  /.well-known/openid-configuration  ← OIDC discovery
 *   GET  /oauth/jwks                        ← public key for JWT verification
 *   GET  /oauth/authorize                   ← start auth code flow
 *   POST /oauth/token                       ← exchange code for tokens
 *   GET  /oauth/userinfo                    ← return user profile
 * ──────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── Key loading ───────────────────────────────────────────────────────────────
// Reuse the same RSA key pair already used for SAML signing.
const KEY_PATH  = path.join(__dirname, '..', 'certs', 'idp.key');
const CERT_PATH = path.join(__dirname, '..', 'certs', 'idp.crt');

let _privateKey, _publicKey;
function getKeys() {
  if (!_privateKey) {
    _privateKey = fs.readFileSync(KEY_PATH,  'utf8').trim();
    _publicKey  = fs.readFileSync(CERT_PATH, 'utf8').trim();
  }
  return { privateKey: _privateKey, publicKey: _publicKey };
}

// ── In-memory stores ──────────────────────────────────────────────────────────
// For a single Fly machine this is fine.
// If you scale to multiple machines, replace with Redis.

// code → { user, clientId, redirectUri, expiresAt, codeChallenge, codeChallengeMethod }
const authCodes = new Map();

// token → { user, clientId, expiresAt }
const accessTokens = new Map();

// Prune expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authCodes)    if (v.expiresAt < now) authCodes.delete(k);
  for (const [k, v] of accessTokens) if (v.expiresAt < now) accessTokens.delete(k);
}, 5 * 60 * 1000).unref();

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateClient(clientId, clientSecret) {
  return (
    clientId     === process.env.OAUTH_CLIENT_ID &&
    clientSecret === process.env.OAUTH_CLIENT_SECRET
  );
}

function verifyPKCE(verifier, challenge, method) {
  if (!challenge) return true; // PKCE not required by this client
  if (method === 'S256') {
    const hash = crypto.createHash('sha256').update(verifier).digest('base64url');
    return hash === challenge;
  }
  return verifier === challenge; // plain
}

// ── JWT (id_token) ────────────────────────────────────────────────────────────
function generateIdToken(user, clientId, issuer) {
  const { privateKey } = getKeys();
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'idp-key-1',
  };

  const payload = {
    iss:         issuer,
    sub:         user.email || user.sub,
    aud:         clientId,
    iat:         now,
    exp:         now + 3600,
    email:       user.email        || '',
    given_name:  user.given_name   || (user.name ? user.name.split(' ')[0]               : ''),
    family_name: user.family_name  || (user.name ? user.name.split(' ').slice(1).join(' '): ''),
    name:        user.name         || user.email || '',
  };

  const b64   = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const parts = `${b64(header)}.${b64(payload)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(parts);
  const sig = signer.sign(privateKey, 'base64url');

  return `${parts}.${sig}`;
}

// ── JWKS ──────────────────────────────────────────────────────────────────────
function buildJWKS() {
  const { publicKey } = getKeys();
  const key = crypto.createPublicKey(publicKey);
  const jwk = key.export({ format: 'jwk' });
  return {
    keys: [{
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: 'idp-key-1',
      n:   jwk.n,
      e:   jwk.e,
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /.well-known/openid-configuration
 * OIDC discovery document — Salesforce reads this to auto-configure endpoints.
 */
function handleDiscovery(_req, res) {
  const issuer = process.env.BASE_URL;
  res.json({
    issuer,
    authorization_endpoint:                `${issuer}/oauth/authorize`,
    token_endpoint:                        `${issuer}/oauth/token`,
    userinfo_endpoint:                     `${issuer}/oauth/userinfo`,
    jwks_uri:                              `${issuer}/oauth/jwks`,
    response_types_supported:             ['code'],
    subject_types_supported:              ['public'],
    id_token_signing_alg_values_supported:['RS256'],
    scopes_supported:                     ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported:['client_secret_post'],
    claims_supported:                     ['sub', 'email', 'given_name', 'family_name', 'name'],
  });
}

/**
 * GET /oauth/jwks
 * Public key in JWK format so Salesforce can verify the id_token signature.
 */
function handleJWKS(_req, res) {
  res.json(buildJWKS());
}

/**
 * GET /oauth/authorize
 * Start of the Authorization Code Flow.
 * If the user already has a session → issue code immediately (no login prompt).
 * If not → redirect to /login then return here.
 */
function handleAuthorize(req, res) {
  const {
    client_id,
    redirect_uri,
    response_type,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query;

  // Basic validation
  if (!client_id || !redirect_uri || response_type !== 'code') {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
  }

  if (client_id !== process.env.OAUTH_CLIENT_ID) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // Validate redirect_uri against whitelist
  const allowedRedirectUris = (process.env.OAUTH_REDIRECT_URIS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  if (!allowedRedirectUris.includes(redirect_uri)) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: `redirect_uri "${redirect_uri}" is not registered.`,
    });
  }

  // No session — send to login, come back here after
  if (!req.session?.user) {
    const returnTo = '/oauth/authorize?' + new URLSearchParams(req.query).toString();
    req.session.returnTo = returnTo;
    return res.redirect('/login');
  }

  // Session found — issue auth code immediately (matches diagram)
  const code = crypto.randomBytes(32).toString('base64url');
  authCodes.set(code, {
    user:                req.session.user,
    clientId:            client_id,
    redirectUri:         redirect_uri,
    expiresAt:           Date.now() + 10 * 60 * 1000, // 10 min
    codeChallenge:       code_challenge       || null,
    codeChallengeMethod: code_challenge_method || 'plain',
  });

  const callbackUrl = new URL(redirect_uri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  res.redirect(callbackUrl.toString());
}

/**
 * POST /oauth/token
 * Back-channel: Salesforce exchanges the auth code for tokens.
 * Returns { access_token, id_token, token_type, expires_in }.
 */
function handleToken(req, res) {
  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    client_secret,
    code_verifier,
  } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!validateClient(client_id, client_secret)) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const codeData = authCodes.get(code);
  if (!codeData || codeData.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired or invalid' });
  }

  if (codeData.clientId !== client_id || codeData.redirectUri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id or redirect_uri mismatch' });
  }

  if (!verifyPKCE(code_verifier, codeData.codeChallenge, codeData.codeChallengeMethod)) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
  }

  // Single-use — consume the code
  authCodes.delete(code);

  const issuer      = process.env.BASE_URL;
  const user        = codeData.user;
  const accessToken = crypto.randomBytes(32).toString('base64url');
  const idToken     = generateIdToken(user, client_id, issuer);

  accessTokens.set(accessToken, {
    user,
    clientId:  client_id,
    expiresAt: Date.now() + 3600 * 1000,
  });

  res.json({
    access_token: accessToken,
    token_type:   'Bearer',
    expires_in:   3600,
    id_token:     idToken,
  });
}

/**
 * GET /oauth/userinfo
 * Salesforce calls this (back-channel) with the access_token to get
 * { email, given_name, family_name, name } for JIT provisioning.
 */
function handleUserInfo(req, res) {
  const auth  = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const data = accessTokens.get(token);
  if (!data || data.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired or invalid' });
  }

  const u = data.user;
  res.json({
    sub:         u.email        || u.sub,
    email:       u.email        || '',
    given_name:  u.given_name   || (u.name ? u.name.split(' ')[0]                : ''),
    family_name: u.family_name  || (u.name ? u.name.split(' ').slice(1).join(' '): ''),
    name:        u.name         || u.email || '',
  });
}

module.exports = {
  handleDiscovery,
  handleJWKS,
  handleAuthorize,
  handleToken,
  handleUserInfo,
};