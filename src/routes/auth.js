'use strict';

const router = require('express').Router();

// ── Auth0 Resource Owner Password Grant ───────────────────────────────────────
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

// ── GET /login ────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.render('login', { error: req.query.error || '' });
});

// ── POST /auth/credentials ────────────────────────────────────────────────────
router.post('/auth/credentials', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.redirect('/login?error=Please+enter+your+email+and+password.');
  }

  try {
    req.session.user = await loginWithPassword(email, password);
    const returnTo   = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    const msg = encodeURIComponent(err.message || 'Authentication failed.');
    res.redirect(`/login?error=${msg}`);
  }
});

// ── GET /logout ───────────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  // 1. Destroy our express session (clears req.session.user)
  // 2. res.oidc.logout() clears the separate appSession cookie that
  //    express-openid-connect manages — without this the OIDC cookie
  //    survives and the session sync middleware re-creates the user.
  req.session.destroy(() => {
    res.oidc.logout({ returnTo: `${process.env.BASE_URL}/login` });
  });
});

module.exports = router;