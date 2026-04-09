'use strict';
/**
 * sfJwtFlow.js — Salesforce JWT Bearer Flow for Experience Cloud custom domains.
 *
 * Three-phase flow:
 *   Phase 1 — Mint JWT assertion signed with RSA private key
 *   Phase 2 — POST to EC site token endpoint → access_token (domain-scoped)
 *   Phase 3 — Exchange via /singleaccess → web session ID → frontdoor URL
 *
 * Required env vars:
 *   SF_JWT_CLIENT_ID  — External Client App / Connected App Consumer Key
 *   SF_EC_SITE_URL    — https://support.sgummalla.net  (EC custom domain, no slash)
 *   SF_EC_RETURN_URL  — /s  (relative path within EC site)
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const KEY_PATH = path.join(__dirname, '..', '..', 'certs', 'idp.key');

// ── Logger ────────────────────────────────────────────────────────────────────
function log(step, data) {
  console.log(`[JWT:${step}]`, JSON.stringify(data, null, 2));
}
function logErr(step, err, extra = {}) {
  console.error(`[JWT:${step}:ERROR]`, JSON.stringify({ message: err.message, ...extra }, null, 2));
}

// ── Key loading ───────────────────────────────────────────────────────────────
let _privateKey;
function getPrivateKey() {
  if (!_privateKey) {
    if (!fs.existsSync(KEY_PATH)) {
      throw new Error(`Private key not found at: ${KEY_PATH}`);
    }
    _privateKey = fs.readFileSync(KEY_PATH, 'utf8').trim();
    log('KEY', { loaded: true, path: KEY_PATH });
  }
  return _privateKey;
}

// ── Phase 1 — Mint JWT assertion ──────────────────────────────────────────────
/**
 * Signs a JWT where:
 *   iss = Consumer Key
 *   sub = Salesforce username
 *   aud = EC site URL (domain-scoped — NOT login.salesforce.com)
 *   exp = now + 5 minutes
 */
function mintJWTAssertion(sfUsername) {
  const privateKey = getPrivateKey();
  const now        = Math.floor(Date.now() / 1000);
  const siteUrl    = (process.env.SF_EC_SITE_URL || '').replace(/\/$/, '');
  const clientId   = process.env.SF_JWT_CLIENT_ID;

  if (!siteUrl) throw new Error('SF_EC_SITE_URL is not set.');
  if (!clientId) throw new Error('SF_JWT_CLIENT_ID is not set.');

  const header  = { alg: 'RS256' };
  const payload = {
    iss: clientId,
    sub: sfUsername,
    aud: siteUrl,           // ← EC site URL, not login.salesforce.com
    exp: now + 300,
  };

  log('PHASE1:MINT', {
    iss:       clientId,
    sub:       sfUsername,
    aud:       siteUrl,
    exp_human: new Date(payload.exp * 1000).toISOString(),
  });

  const b64      = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signer   = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;

  log('PHASE1:MINT', { jwt_length: jwt.length });
  return jwt;
}

// ── Phase 2 — Exchange JWT for domain-scoped access token ─────────────────────
/**
 * POSTs the JWT to the EC site's own token endpoint.
 * This returns a token scoped to the custom domain.
 */
async function exchangeJWTForToken(jwt) {
  const siteUrl  = (process.env.SF_EC_SITE_URL || '').replace(/\/$/, '');
  const tokenUrl = `${siteUrl}/services/oauth2/token`;

  log('PHASE2:EXCHANGE', { token_url: tokenUrl });

  const res  = await fetch(tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const body = await res.text();
  log('PHASE2:RESPONSE', {
    status:   res.status,
    body_raw: body,
  });

  if (!res.ok) {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch {}
    logErr('PHASE2', new Error(parsed.error_description || parsed.error || 'Token exchange failed'), {
      status:   res.status,
      sf_error: parsed.error,
      sf_error_description: parsed.error_description,
    });
    throw new Error(parsed.error_description || parsed.error || `Token exchange failed (HTTP ${res.status})`);
  }

  const data = JSON.parse(body);
  log('PHASE2:SUCCESS', {
    token_type:          data.token_type,
    access_token_length: data.access_token?.length,
    issued_at:           data.issued_at,
  });

  return data.access_token;
}

// ── Phase 3 — Exchange access token for web session via singleaccess ──────────
/**
 * POSTs the access_token to /services/oauth2/singleaccess.
 * Salesforce returns JSON with a frontdoor_uri — redirect user there directly.
 */
async function exchangeForWebSession(accessToken) {
  const siteUrl         = (process.env.SF_EC_SITE_URL || '').replace(/\/$/, '');
  const singleAccessUrl = `${siteUrl}/services/oauth2/singleaccess`;
  const retUrl          = process.env.SF_EC_RETURN_URL || '/s';

  log('PHASE3:SINGLEACCESS', {
    url:     singleAccessUrl,
    ret_url: retUrl,
  });

  const res = await fetch(singleAccessUrl, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept':        'application/json',
    },
    body: new URLSearchParams({
      access_token: accessToken,
      // retURL tells Salesforce where to land after session is established
      retURL: retUrl,
    }),
  });

  const body = await res.text();
  log('PHASE3:RESPONSE', {
    status:   res.status,
    headers: {
      'content-type': res.headers.get('content-type'),
      'location':     res.headers.get('location'),
    },
    body_raw: body,
  });

  if (!res.ok) {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch {}
    logErr('PHASE3', new Error(parsed.error_description || parsed.error || 'singleaccess failed'), {
      status:               res.status,
      sf_error:             parsed.error,
      sf_error_description: parsed.error_description,
    });
    throw new Error(parsed.error_description || parsed.error || `singleaccess failed (HTTP ${res.status})`);
  }

  // Salesforce returns JSON with frontdoor_uri — use it directly
  let data = {};
  try { data = JSON.parse(body); } catch {}

  log('PHASE3:SUCCESS', {
    keys:          Object.keys(data),
    frontdoor_uri: data.frontdoor_uri?.replace(/sid=[^&]+/, 'sid=[REDACTED]'),
  });

  // frontdoor_uri already includes the sid and retURL baked in
  if (data.frontdoor_uri) return data.frontdoor_uri;

  // Fallback — some versions return redirect in Location header
  const location = res.headers.get('location');
  if (location) return location;

  throw new Error('singleaccess did not return a frontdoor_uri. Full response: ' + body);
}

// ── Build final frontdoor URL ─────────────────────────────────────────────────
function buildFrontdoorUrl(sessionId) {
  const siteUrl = (process.env.SF_EC_SITE_URL || '').replace(/\/$/, '');
  const retUrl  = process.env.SF_EC_RETURN_URL || '/s';
  const url     = `${siteUrl}/secur/frontdoor.jsp?sid=${sessionId}&retURL=${encodeURIComponent(retUrl)}`;

  log('FRONTDOOR', {
    site_url:      siteUrl,
    ret_url:       retUrl,
    frontdoor_url: url.replace(sessionId, '[REDACTED]'),
  });

  return url;
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function getSalesforceFrontdoorUrl(sfUsername) {
  log('START', {
    sf_username:      sfUsername,
    SF_JWT_CLIENT_ID: process.env.SF_JWT_CLIENT_ID ? '✅ set' : '❌ MISSING',
    SF_EC_SITE_URL:   process.env.SF_EC_SITE_URL   || '❌ MISSING',
    SF_EC_RETURN_URL: process.env.SF_EC_RETURN_URL || '/s (default)',
  });

  const jwt          = mintJWTAssertion(sfUsername);
  const accessToken  = await exchangeJWTForToken(jwt);
  // singleaccess returns the full frontdoor_uri ready to redirect to
  const frontdoorUri = await exchangeForWebSession(accessToken);

  log('COMPLETE', {
    frontdoor_uri: frontdoorUri.replace(/sid=[^&]+/, 'sid=[REDACTED]'),
  });

  return frontdoorUri;
}

module.exports = { getSalesforceFrontdoorUrl, mintJWTAssertion };