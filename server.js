'use strict';
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { auth, requiresAuth } = require('express-openid-connect');
const { respondWithSAMLAssertion, buildIdPMetadata } = require('./src/samlIdp');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Session ───────────────────────────────────────────────────────────────────
// express-openid-connect stores its state here; it sits ABOVE the OIDC middleware.
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production', // true behind HTTPS in prod
    maxAge:   8 * 60 * 60 * 1000,                   // 8 hours
  },
}));

// ── Auth0 OIDC middleware ─────────────────────────────────────────────────────
// Handles /login, /logout, /callback automatically.
app.use(auth({
  authorizationParams: { response_type: 'code', scope: 'openid profile email' },
  baseURL:         process.env.BASE_URL,
  clientID:        process.env.AUTH0_CLIENT_ID,
  clientSecret:    process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL:   `https://${process.env.AUTH0_DOMAIN}`,
  secret:          process.env.SESSION_SECRET || 'dev-secret-change-me',
  // After login, return to whatever page triggered it (supports the /sso redirect)
}));

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── SAML IdP Metadata ─────────────────────────────────────────────────────────
// Give this URL to Salesforce → SSO Settings → IdP metadata (optional)
// The certificate inside is what Salesforce uses to verify your signatures.
app.get('/saml/metadata', (_req, res) => {
  res.set('Content-Type', 'application/xml');
  res.send(buildIdPMetadata(process.env.BASE_URL));
});

// ── SAML SSO endpoint ─────────────────────────────────────────────────────────
/**
 * Salesforce Experience Cloud is configured to redirect here when a user
 * hits a Salesforce page without an active Salesforce session.
 *
 * Flow (matches your diagram):
 *  1. Browser → Salesforce EC
 *  2. Salesforce 302 → GET /sso?SAMLRequest=...  (this route)
 *  3. requiresAuth() checks for an existing Auth0 session:
 *       • Session found  → proceed immediately (no login prompt)
 *       • No session     → redirect to Auth0, then return here via /callback
 *  4. respondWithSAMLAssertion builds & auto-POSTs assertion to Salesforce ACS
 *  5. Salesforce validates, JIT-provisions if needed, sets its own cookie
 *  6. Salesforce 302 → Experience Cloud page → user is logged in ✅
 */
app.get('/sso', requiresAuth(), (req, res) => {
  respondWithSAMLAssertion(req, res);
});

// Also support HTTP-POST binding (some SP configs use POST for the AuthnRequest)
app.post('/sso', requiresAuth(), (req, res) => {
  respondWithSAMLAssertion(req, res);
});

// ── Home page (protected) ─────────────────────────────────────────────────────
app.get('/', requiresAuth(), (req, res) => {
  const user = req.oidc.user;

  // Derive display values safely
  const displayName = user.name || user.email || 'User';
  const email       = user.email || '—';
  const picture     = user.picture || '';
  const initials    = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  res.send(/* html */`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #F7F5F2;
      --surface:     #FFFFFF;
      --surface-2:   #F0EDE8;
      --border:      #E2DDD7;
      --border-soft: #EDE9E4;
      --text:        #1C1917;
      --text-2:      #6B6560;
      --text-3:      #A09890;
      --gold:        #B8965A;
      --gold-light:  #D4B483;
      --gold-bg:     #F9F4EC;
      --gold-border: #E8D5B0;
      --green:       #3D7A5F;
      --green-bg:    #EEF5F1;
      --green-border:#BDD9CC;
    }

    html, body {
      min-height: 100vh;
      font-family: 'DM Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }

    /* ── Grain overlay ── */
    body::before {
      content: '';
      position: fixed; inset: 0; z-index: 0;
      opacity: .028;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      background-size: 200px;
      pointer-events: none;
    }

    /* ── Warm glow ── */
    body::after {
      content: '';
      position: fixed; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse 70% 50% at 15% 0%, rgba(184,150,90,.06) 0%, transparent 60%),
        radial-gradient(ellipse 50% 60% at 85% 100%, rgba(184,150,90,.04) 0%, transparent 60%);
      pointer-events: none;
    }

    /* ── Shell ── */
    .shell {
      position: relative; z-index: 1;
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }

    /* ── Nav ── */
    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.5rem 3rem;
      border-bottom: 1px solid var(--border-soft);
      background: rgba(247,245,242,.85);
      backdrop-filter: blur(16px);
      position: sticky; top: 0; z-index: 10;
    }

    .nav-brand {
      font-family: 'Cormorant Garamond', serif;
      font-weight: 500;
      font-size: 1.35rem;
      letter-spacing: .04em;
      color: var(--text);
      display: flex; align-items: center; gap: .75rem;
    }

    .nav-brand-rule {
      width: 1px; height: 18px;
      background: var(--gold-light);
    }

    .nav-brand-sub {
      font-family: 'DM Sans', sans-serif;
      font-size: .68rem;
      font-weight: 400;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .nav-right {
      display: flex; align-items: center; gap: 1.25rem;
    }

    .nav-email {
      font-size: .78rem;
      color: var(--text-3);
      letter-spacing: .01em;
    }

    .btn-signout {
      display: inline-flex; align-items: center; gap: .4rem;
      padding: .5rem 1.1rem;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: transparent;
      color: var(--text-2);
      font-size: .78rem;
      font-family: 'DM Sans', sans-serif;
      font-weight: 400;
      letter-spacing: .03em;
      text-decoration: none;
      cursor: pointer;
      transition: border-color .2s, color .2s, background .2s;
    }
    .btn-signout:hover {
      border-color: var(--text-3);
      color: var(--text);
      background: var(--surface-2);
    }

    /* ── Main ── */
    main {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5rem 2rem;
    }

    .container {
      width: 100%;
      max-width: 860px;
      animation: rise .7s cubic-bezier(.22,.68,0,1.2) both;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Top rule ── */
    .top-rule {
      display: flex; align-items: center; gap: 1rem;
      margin-bottom: 3.5rem;
    }
    .top-rule-line { flex: 1; height: 1px; background: var(--border); }
    .top-rule-text {
      font-size: .65rem;
      font-weight: 500;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--text-3);
    }

    /* ── Hero row ── */
    .hero {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3rem;
      align-items: start;
      margin-bottom: 3.5rem;
    }

    .hero-text {}

    .hero-eyebrow {
      font-size: .7rem;
      font-weight: 500;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 1rem;
    }

    .hero-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(2.8rem, 6vw, 4.2rem);
      font-weight: 300;
      line-height: 1.05;
      letter-spacing: -.01em;
      color: var(--text);
      margin-bottom: 1.25rem;
    }

    .hero-name em {
      font-style: italic;
      color: var(--gold);
    }

    .hero-body {
      font-size: .9rem;
      line-height: 1.75;
      color: var(--text-2);
      max-width: 42ch;
      font-weight: 300;
    }

    /* ── Avatar ── */
    .avatar-col { padding-top: .25rem; }

    .avatar {
      width: 88px; height: 88px;
      border-radius: 50%;
      overflow: hidden;
      border: 1px solid var(--gold-border);
      background: var(--gold-bg);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 0 0 4px var(--bg), 0 0 0 5px var(--gold-border);
    }

    .avatar img { width: 100%; height: 100%; object-fit: cover; }

    .avatar-initials {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.8rem;
      font-weight: 400;
      color: var(--gold);
      letter-spacing: .04em;
    }

    /* ── Cards grid ── */
    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 2.5rem;
    }

    .card {
      background: var(--surface);
      padding: 1.5rem 1.75rem;
      transition: background .2s;
    }
    .card:hover { background: #FDFCFB; }

    .card-label {
      font-size: .63rem;
      font-weight: 500;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--text-3);
      margin-bottom: .6rem;
    }

    .card-value {
      font-size: .88rem;
      color: var(--text);
      font-weight: 400;
      line-height: 1.4;
    }

    .status-pip {
      display: inline-flex; align-items: center; gap: .45rem;
    }
    .pip {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 3px var(--green-bg);
      flex-shrink: 0;
    }
    .status-label {
      color: var(--green);
      font-size: .88rem;
      font-weight: 500;
    }

    /* ── Actions ── */
    .actions {
      display: flex; align-items: center; gap: 1rem;
    }

    .btn-primary {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .7rem 1.6rem;
      background: var(--text);
      color: var(--bg);
      border: 1px solid var(--text);
      border-radius: 3px;
      font-size: .82rem;
      font-family: 'DM Sans', sans-serif;
      font-weight: 400;
      letter-spacing: .03em;
      text-decoration: none;
      transition: background .2s, border-color .2s, transform .15s;
    }
    .btn-primary:hover {
      background: #333;
      border-color: #333;
      transform: translateY(-1px);
    }

    .btn-secondary {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .7rem 1.4rem;
      background: transparent;
      color: var(--text-2);
      border: 1px solid var(--border);
      border-radius: 3px;
      font-size: .82rem;
      font-family: 'DM Sans', sans-serif;
      font-weight: 400;
      letter-spacing: .03em;
      text-decoration: none;
      transition: border-color .2s, color .2s;
    }
    .btn-secondary:hover {
      border-color: var(--text-3);
      color: var(--text);
    }

    .btn-arrow { font-size: .9em; }

    /* ── Footer ── */
    footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.4rem 3rem;
      border-top: 1px solid var(--border-soft);
    }

    .footer-left {
      font-size: .72rem;
      color: var(--text-3);
      letter-spacing: .01em;
    }

    .footer-right {
      display: flex; align-items: center; gap: .5rem;
      font-size: .72rem;
      color: var(--text-3);
    }

    .footer-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: var(--green);
    }

    /* ── Responsive ── */
    @media (max-width: 680px) {
      nav { padding: 1.25rem 1.5rem; }
      .nav-brand-sub, .nav-brand-rule { display: none; }
      main { padding: 3rem 1.25rem; }
      .hero { grid-template-columns: 1fr; gap: 1.5rem; }
      .avatar-col { order: -1; }
      .avatar { width: 64px; height: 64px; }
      .avatar-initials { font-size: 1.3rem; }
      .cards { grid-template-columns: 1fr; }
      .actions { flex-direction: column; align-items: stretch; }
      footer { flex-direction: column; gap: .5rem; text-align: center; }
    }
  </style>
</head>
<body>
<div class="shell">

  <nav>
    <div class="nav-brand">
      MyPortal
      <div class="nav-brand-rule"></div>
      <span class="nav-brand-sub">Identity Gateway</span>
    </div>
    <div class="nav-right">
      <span class="nav-email">${email}</span>
      <a href="/logout" class="btn-signout">Sign out</a>
    </div>
  </nav>

  <main>
    <div class="container">

      <div class="top-rule">
        <div class="top-rule-line"></div>
        <span class="top-rule-text">Authenticated Session</span>
        <div class="top-rule-line"></div>
      </div>

      <div class="hero">
        <div class="hero-text">
          <p class="hero-eyebrow">Welcome back</p>
          <h1 class="hero-name">Good to see you,<br><em>${displayName.split(' ')[0]}.</em></h1>
          <p class="hero-body">
            You are signed in via Auth0. Any Salesforce Experience Cloud
            page you visit will authenticate you automatically — no second
            login required.
          </p>
        </div>
        <div class="avatar-col">
          <div class="avatar">
            ${picture
              ? `<img src="${picture}" alt="${displayName}" referrerpolicy="no-referrer">`
              : `<span class="avatar-initials">${initials}</span>`
            }
          </div>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="card-label">Session Status</div>
          <div class="card-value">
            <span class="status-pip">
              <span class="pip"></span>
              <span class="status-label">Active</span>
            </span>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Signed in as</div>
          <div class="card-value">${email}</div>
        </div>
        <div class="card">
          <div class="card-label">Identity Provider</div>
          <div class="card-value">Auth0 via SAML 2.0</div>
        </div>
      </div>

      <div class="actions">
        <a href="${process.env.SALESFORCE_ACS_URL?.replace('/services/auth/saml/EC_SSO', '') || '#'}"
           target="_blank" rel="noopener" class="btn-primary">
          Open Experience Cloud <span class="btn-arrow">↗</span>
        </a>
        <a href="/saml/metadata" target="_blank" rel="noopener" class="btn-secondary">
          View SAML Metadata
        </a>
      </div>

    </div>
  </main>

  <footer>
    <span class="footer-left">SAML 2.0 SP-Initiated SSO · Node.js IdP</span>
    <div class="footer-right">
      <div class="footer-dot"></div>
      Session active
    </div>
  </footer>

</div>
</body>
</html>
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running → ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`   Home          : /`);
  console.log(`   SAML SSO      : /sso  (point Salesforce here)`);
  console.log(`   SAML Metadata : /saml/metadata`);
  console.log(`   Login         : /login`);
  console.log(`   Logout        : /logout\n`);
});
