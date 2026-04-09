'use strict';
require('dotenv').config();

const path    = require('path');
const express = require('express');
const session = require('express-session');
const { auth } = require('express-openid-connect');
const { respondWithSAMLAssertion, buildIdPMetadata } = require('./src/samlIdp');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Template engine ───────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
  const sfOrigin = process.env.SALESFORCE_ORIGIN || '';

  // Allow framing only from your Salesforce org
  res.setHeader('Content-Security-Policy',
    `frame-ancestors 'self' ${sfOrigin} *.salesforce.com *.force.com *.site.com`
  );

  // Remove X-Frame-Options — it conflicts with CSP frame-ancestors
  // (CSP frame-ancestors takes precedence in modern browsers)
  res.removeHeader('X-Frame-Options');

  next();
});

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   true,           // always true — Fly is always HTTPS
    sameSite: 'none',         // required for cross-origin iframe
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

// ── Auth0 OIDC middleware ─────────────────────────────────────────────────────
app.use(auth({
  authorizationParams: { response_type: 'code', scope: 'openid profile email' },
  authRequired: false,
  baseURL:       process.env.BASE_URL,
  clientID:      process.env.AUTH0_CLIENT_ID,
  clientSecret:  process.env.AUTH0_CLIENT_SECRET,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  secret:        process.env.SESSION_SECRET || 'dev-secret-change-me',
  routes: {
    login:    '/auth/auth0',
    logout:   false,
    callback: '/callback',
  },
}));

// ── Session sync ──────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.oidc?.isAuthenticated() && !req.session.user) {
    req.session.user = req.oidc.user;
  }
  next();
});

// ── Auth guard ────────────────────────────────────────────────────────────────
function requiresLogin(req, res, next) {
  if (req.session?.user) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

// ── Auth0 password grant ──────────────────────────────────────────────────────
async function loginWithPassword(email, password) {
  const tokenRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      username:   email,
      password,
      client_id:     process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      scope:         'openid profile email',
      connection:    'Username-Password-Authentication',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err.error_description || 'Invalid email or password.');
  }

  const { access_token } = await tokenRes.json();

  const userRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) throw new Error('Could not retrieve user profile.');
  return userRes.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/saml/metadata', (_req, res) => {
  res.set('Content-Type', 'application/xml');
  res.send(buildIdPMetadata(process.env.BASE_URL));
});

app.get('/sso',  requiresLogin, (req, res) => respondWithSAMLAssertion(req, res));
app.post('/sso', requiresLogin, (req, res) => respondWithSAMLAssertion(req, res));

app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.render('login', { error: req.query.error || '' });
});

app.post('/auth/credentials', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.redirect('/login?error=Please+enter+your+email+and+password.');
  }
  try {
    req.session.user = await loginWithPassword(email, password);
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    const msg = encodeURIComponent(err.message || 'Authentication failed.');
    res.redirect(`/login?error=${msg}`);
  }
});

app.get('/logout', (req, res) => {
  // Destroy our express session (clears req.session.user)
  // then use res.oidc.logout() which clears the appSession cookie that
  // express-openid-connect manages separately — without this, the OIDC
  // cookie survives and the session sync middleware re-creates the user.
  req.session.destroy(() => {
    res.oidc.logout({ returnTo: `${process.env.BASE_URL}/login` });
  });
});

app.get('/', requiresLogin, (req, res) => {
  const user        = req.session.user;
  const displayName = user.name    || user.email || 'User';
  const firstName   = displayName.split(' ')[0];
  const email       = user.email   || '—';
  const picture     = user.picture || '';
  const initials    = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const sfUrl = process.env.SALESFORCE_ACS_URL
    ?.replace('/services/auth/saml/EC_SSO', '') || '#';

  res.render('home', { displayName, firstName, email, picture, initials, sfUrl });
});

app.get('/debug-sso', requiresLogin, (req, res) => {
  const user = req.session.user;
  res.json({
    nameId: user.email || user.sub,
    email:  user.email,
    name:   user.name,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server → ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`    /            home (protected)`);
  console.log(`    /login       custom login page`);
  console.log(`    /sso         SAML SSO endpoint`);
  console.log(`    /saml/metadata`);
  console.log(`    /logout\n`);
});