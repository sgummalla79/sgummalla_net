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
  const error = req.query.error || '';

  res.render('home', { displayName, firstName, email, picture, initials, error });
});

router.get('/debug-session', requiresLogin, (req, res) => {
  res.json({
    email:       req.session.user.email,
    sf_accounts: req.session.user.sf_accounts || 'NOT FOUND — re-login needed',
  });
});

module.exports = router;