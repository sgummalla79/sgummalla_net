'use strict';
/**
 * samlIdp.js
 * -----------------------------------------------------------
 * Hand-rolled SAML 2.0 IdP assertion issuer.
 *
 * Dependencies:
 *   - xml-crypto@6  (XMLDSig signing, pulls @xmldom/xmldom@0.8.12 — patched)
 *   - Node built-in crypto (UUID, random IDs)
 *   - Node built-in fs / path
 *
 * No samlp, no ejs, no moment, no node-forge — zero CVEs.
 * -----------------------------------------------------------
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { SignedXml } = require('xml-crypto');

// ── Cert / key ────────────────────────────────────────────────────────────────
const KEY_PATH  = path.join(__dirname, '..', 'certs', 'idp.key');
const CERT_PATH = path.join(__dirname, '..', 'certs', 'idp.crt');

function loadPem(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`[SAML] File not found: ${p}\nRun: npm run generate-certs`);
  }
  return fs.readFileSync(p, 'utf8').trim();
}

// Lazy-load so missing certs only throw on first /sso hit, not at startup
let _privateKey, _certificate, _certBody;
function getCerts() {
  if (!_privateKey) {
    _privateKey  = loadPem(KEY_PATH);
    _certificate = loadPem(CERT_PATH);
    _certBody    = _certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\r?\n/g, '');
  }
  return { privateKey: _privateKey, certificate: _certificate, certBody: _certBody };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid()        { return '_' + crypto.randomUUID().replace(/-/g, ''); }
function nowIso()     { return new Date().toISOString(); }
function plusMins(m)  { return new Date(Date.now() + m * 60_000).toISOString(); }
function esc(s)       { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }

// ── SAML claim URIs ───────────────────────────────────────────────────────────
const CLAIMS = {
  email:     'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  givenName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  surname:   'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  name:      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
};

// ── Build SAML assertion XML ──────────────────────────────────────────────────
/**
 * Builds the unsigned SAML 2.0 Response XML.
 *
 * @param {object} opts
 * @param {string} opts.nameId        - NameIdentifier value (typically email)
 * @param {string} opts.nameIdFormat  - NameID format URI
 * @param {string} opts.issuer        - IdP entity ID
 * @param {string} opts.acsUrl        - SP Assertion Consumer Service URL
 * @param {string} opts.audience      - SP entity ID / audience
 * @param {string} opts.inResponseTo  - AuthnRequest ID (or empty for IdP-initiated)
 * @param {object} opts.attributes    - { claimUri: value, ... }
 * @param {string} opts.certBody      - Base64 cert (no PEM headers)
 * @param {string} opts.sessionIndex  - Session index value
 */
function buildAssertionXml(opts) {
  const responseId  = uid();
  const assertionId = uid();
  const now         = nowIso();
  const notOnOrAfter     = plusMins(10);
  const sessionNotOnOrAfter = plusMins(480); // 8 hours

  const attrStatements = Object.entries(opts.attributes)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([uri, val]) => `
      <saml:Attribute Name="${esc(uri)}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri">
        <saml:AttributeValue xsi:type="xs:string">${esc(val)}</saml:AttributeValue>
      </saml:Attribute>`).join('');

  return `<?xml version="1.0"?>
<samlp:Response
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  ID="${responseId}"
  Version="2.0"
  IssueInstant="${now}"
  Destination="${esc(opts.acsUrl)}"
  ${opts.inResponseTo ? `InResponseTo="${esc(opts.inResponseTo)}"` : ''}>

  <saml:Issuer>${esc(opts.issuer)}</saml:Issuer>

  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>

  <saml:Assertion
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${assertionId}"
    Version="2.0"
    IssueInstant="${now}">

    <saml:Issuer>${esc(opts.issuer)}</saml:Issuer>

    <saml:Subject>
      <saml:NameID Format="${esc(opts.nameIdFormat)}">${esc(opts.nameId)}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData
          NotOnOrAfter="${notOnOrAfter}"
          Recipient="${esc(opts.acsUrl)}"
          ${opts.inResponseTo ? `InResponseTo="${esc(opts.inResponseTo)}"` : ''}/>
      </saml:SubjectConfirmation>
    </saml:Subject>

    <saml:Conditions NotBefore="${now}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${esc(opts.audience)}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>

    <saml:AuthnStatement
      AuthnInstant="${now}"
      SessionIndex="${esc(opts.sessionIndex)}"
      SessionNotOnOrAfter="${sessionNotOnOrAfter}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>
          urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
        </saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>

    <saml:AttributeStatement>${attrStatements}
    </saml:AttributeStatement>

  </saml:Assertion>

</samlp:Response>`;
}

// ── Sign the assertion ────────────────────────────────────────────────────────
/**
 * Signs the SAML assertion element (not the whole Response) using
 * RSA-SHA256 + XML Canonicalization (C14N exclusive).
 */
function signAssertion(xml, privateKey, certBody) {
  const sig = new SignedXml({
    privateKey,
    publicCert:         `-----BEGIN CERTIFICATE-----\n${certBody}\n-----END CERTIFICATE-----`,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });

  sig.addReference({
    // Sign the saml:Assertion element (ID starts with '_')
    xpath: '//*[local-name()=\'Assertion\']',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });

  sig.computeSignature(xml, {
    location: {
      // Insert <Signature> right after <Issuer> inside the Assertion
      reference: '//*[local-name()=\'Assertion\']/*[local-name()=\'Issuer\']',
      action:    'after',
    },
  });

  return sig.getSignedXml();
}

// ── HTML auto-POST form ───────────────────────────────────────────────────────
function buildAutoPostForm(acsUrl, samlResponseB64, relayState) {
  return `<!DOCTYPE html>
<html>
<head><title>Redirecting to Salesforce...</title></head>
<body onload="document.forms[0].submit()">
  <form method="POST" action="${esc(acsUrl)}">
    <input type="hidden" name="SAMLResponse" value="${esc(samlResponseB64)}"/>
    ${relayState ? `<input type="hidden" name="RelayState" value="${esc(relayState)}"/>` : ''}
    <noscript><button type="submit">Continue to Salesforce</button></noscript>
  </form>
</body>
</html>`;
}

// ── Main Express handler ──────────────────────────────────────────────────────
/**
 * Builds a signed SAML assertion from the Auth0 session user and
 * auto-POSTs it to the Salesforce Experience Cloud ACS URL.
 *
 * Matches the diagram flow:
 *   Browser → /sso → (session found, no login prompt) → POST SAMLResponse → ACS
 */
function respondWithSAMLAssertion(req, res) {
  try {
    const user = req.session?.user || req.oidc?.user;
    if (!user) return res.status(401).send('Not authenticated');

    const { privateKey, certBody } = getCerts();

    const nameIdFormat = process.env.SAML_NAMEID_FORMAT ||
      'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';

    const issuer   = process.env.SAML_ISSUER;
    const acsUrl   = process.env.SALESFORCE_ACS_URL;
    const audience = process.env.SALESFORCE_ENTITY_ID;

    if (!issuer || !acsUrl || !audience) {
      console.error('[SAML] Missing env vars: SAML_ISSUER, SALESFORCE_ACS_URL, or SALESFORCE_ENTITY_ID');
      return res.status(500).send('SAML IdP misconfigured — check server environment variables.');
    }

    // Extract the AuthnRequest ID from the SP redirect (if present)
    const inResponseTo = req.query.SAMLRequest
      ? extractAuthnRequestId(req.query.SAMLRequest)
      : '';

    const relayState = req.query.RelayState || req.body?.RelayState || '';

    const attributes = {
      [CLAIMS.email]:     user.email || '',
      [CLAIMS.givenName]: user.given_name  || (user.name?.split(' ')[0] ?? ''),
      [CLAIMS.surname]:   user.family_name || (user.name?.split(' ').slice(1).join(' ') ?? ''),
      [CLAIMS.name]:      user.name        || user.email || '',
      // Add more attributes to match your Salesforce JIT attribute mapping, e.g.:
      // 'salesforce_federation_id': user.email,
    };

    const xml = buildAssertionXml({
      nameId:       user.email || user.sub,
      nameIdFormat,
      issuer,
      acsUrl,
      audience,
      inResponseTo,
      attributes,
      certBody,
      sessionIndex: uid(),
    });

    const signedXml      = signAssertion(xml, privateKey, certBody);
    const samlResponseB64 = Buffer.from(signedXml).toString('base64');

    res.set('Content-Type', 'text/html');
    res.send(buildAutoPostForm(acsUrl, samlResponseB64, relayState));

  } catch (err) {
    console.error('[SAML] Fatal error:', err);
    res.status(500).send('SAML assertion failed — see server logs.');
  }
}

// ── Decode AuthnRequest to extract the InResponseTo ID ───────────────────────
/**
 * Safely decodes an HTTP-Redirect SAML AuthnRequest to extract its ID.
 * Returns '' on any failure (IdP-initiated flow still works without it).
 */
function extractAuthnRequestId(samlRequestParam) {
  try {
    // HTTP-Redirect binding: base64(deflate(XML)) — but not all SPs deflate
    // Try plain base64 first, then inflated
    let xml = '';
    try {
      const buf = Buffer.from(samlRequestParam, 'base64');
      // Check if it looks like deflated data (zlib header bytes)
      if (buf[0] === 0x78 || (buf[0] & 0x0f) === 8) {
        xml = require('zlib').inflateRawSync(buf).toString('utf8');
      } else {
        xml = buf.toString('utf8');
      }
    } catch {
      xml = Buffer.from(samlRequestParam, 'base64').toString('utf8');
    }

    const match = xml.match(/\bID="([^"]+)"/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

// ── Metadata XML ──────────────────────────────────────────────────────────────
function buildIdPMetadata(baseUrl) {
  const { certBody } = getCerts();
  const ssoUrl  = `${baseUrl}/sso`;
  const metaUrl = process.env.SAML_ISSUER || `${baseUrl}/saml/metadata`;

  return `<?xml version="1.0"?>
<EntityDescriptor
  xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  entityID="${esc(metaUrl)}">

  <IDPSSODescriptor
    WantAuthnRequestsSigned="false"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">

    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${certBody}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>

    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>

    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${esc(ssoUrl)}"/>

    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${esc(ssoUrl)}"/>

  </IDPSSODescriptor>

</EntityDescriptor>`;
}

module.exports = { respondWithSAMLAssertion, buildIdPMetadata };
