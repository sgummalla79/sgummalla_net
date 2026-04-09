'use strict';

const router        = require('express').Router();
const requiresLogin = require('../middleware/requiresLogin');

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', requiresLogin, (req, res) => {
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

  // Strip the SAML-specific path suffix to get the base Salesforce URL
  const sfUrl = (process.env.SALESFORCE_ACS_URL || '')
    .replace('/services/auth/saml/sgummalla_net_idp', '')
    .replace('/services/auth/saml/EC_SSO', '')
    || '#';

  res.render('home', { displayName, firstName, email, picture, initials, sfUrl });
});

module.exports = router;