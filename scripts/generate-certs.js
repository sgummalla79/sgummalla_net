#!/usr/bin/env node
/**
 * generate-certs.js
 * Generates a self-signed RSA key pair for signing SAML assertions.
 * Run once: node scripts/generate-certs.js
 *
 * Output:
 *   certs/idp.key  — private key (keep secret, never commit)
 *   certs/idp.crt  — public certificate (share with Salesforce SP)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '..', 'certs');

if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, 'idp.key');
const crtPath = path.join(certsDir, 'idp.crt');

console.log('🔐 Generating RSA private key...');
execSync(`openssl genrsa -out "${keyPath}" 2048`);

console.log('📜 Generating self-signed certificate (10 year validity)...');
execSync(
  `openssl req -new -x509 -key "${keyPath}" -out "${crtPath}" -days 3650 ` +
  `-subj "/C=US/ST=State/L=City/O=MyOrg/OU=IT/CN=saml-idp"`
);

console.log('\n✅ Certificates generated:');
console.log(`   Private key : ${keyPath}`);
console.log(`   Certificate : ${crtPath}`);
console.log('\n📋 Next step: copy the contents of certs/idp.crt into');
console.log('   Salesforce → SSO Settings → Identity Provider Certificate field.\n');

// Print the cert for easy copy-paste
const cert = fs.readFileSync(crtPath, 'utf8');
console.log('──────── CERTIFICATE (copy to Salesforce) ────────');
console.log(cert);
console.log('──────────────────────────────────────────────────');
