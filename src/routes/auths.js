'use strict';

const router        = require('express').Router();
const requiresLogin = require('../middleware/requiresLogin');

// ── GET /auths ────────────────────────────────────────────────────────────────
router.get('/auths', requiresLogin, (req, res) => {
  res.render('auths');
});

module.exports = router;