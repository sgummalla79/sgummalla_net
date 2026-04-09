'use strict';
require('dotenv').config();

const path    = require('path');
const express = require('express');
const session = require('express-session');
const { auth } = require('express-openid-connect');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Template engine ───────────────────────────────────────────────────────────
// __dirname = src/  →  views lives at src/views/
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static files ──────────────────────────────────────────────────────────────
// __dirname = src/  →  public lives at src/public/
app.use(express.static(path.join(__dirname, 'public')));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── Auth0 OIDC middleware ─────────────────────────────────────────────────────
// authRequired: false  — routes are guarded individually via requiresLogin.
// routes.login → /auth/auth0 so our custom /login page is not overridden.
// routes.logout → false      so we control logout in routes/auth.js.
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
// After OIDC /callback, mirror req.oidc.user → req.session.user so all routes
// share one source of truth regardless of which login method was used.
app.use((req, _res, next) => {
  if (req.oidc?.isAuthenticated() && !req.session.user) {
    req.session.user = req.oidc.user;
  }
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Routes ────────────────────────────────────────────────────────────────────
// All route files live at src/routes/ — require paths are relative to src/
app.use(require('./routes/oauth'));   // /.well-known/openid-configuration, /oauth/*
app.use(require('./routes/saml'));    // /saml/metadata, /sso
app.use(require('./routes/auth'));    // /login, /auth/credentials, /logout
app.use(require('./routes/portal')); // /launch-portal  (JWT Bearer flow)
app.use(require('./routes/home'));    // /

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server → ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log('    /              home (protected)');
  console.log('    /login         login page');
  console.log('    /launch-portal JWT Bearer → Salesforce EC (JWT flow)');
  console.log('    /sso           SAML SSO   → support.sgummalla.net');
  console.log('    /oauth/*       OAuth 2.0 OIDC → help.sgummalla.net');
  console.log('    /saml/metadata');
  console.log('    /logout\n');
});