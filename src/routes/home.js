'use strict';

const router        = require('express').Router();
const requiresLogin = require('../middleware/requiresLogin');

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get('/', requiresLogin, (req, res) => {
  const user        = req.session.user;
  const displayName = user.name       || user.email || 'User';
  const firstName   = user.given_name  || displayName.split(' ')[0];
  const lastName    = user.family_name || displayName.split(' ').slice(1).join(' ') || '';
  const fullName    = lastName ? `${firstName} ${lastName}` : firstName;
  const email       = user.email       || '—';
  const picture     = user.picture     || '';
  const initials    = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const error       = req.query.error  || '';

  res.render('home', { displayName, firstName, lastName, fullName, email, picture, initials, error });
});

module.exports = router;