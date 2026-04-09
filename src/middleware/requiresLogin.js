'use strict';

/**
 * requiresLogin
 * Protects routes that need an authenticated session.
 * Saves the original URL so the user is redirected back after login.
 */
module.exports = function requiresLogin(req, res, next) {
  if (req.session?.user) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
};