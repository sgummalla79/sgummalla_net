'use strict';

const router                        = require('express').Router();
const requiresLogin                 = require('../middleware/requiresLogin');
const { getSalesforceFrontdoorUrl } = require('../lib/sfJwtFlow');

/**
 * GET /launch-portal
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT Bearer Token Flow — Variant A.
 *
 * SF username is resolved by matching SF_JWT_CLIENT_ID against the
 * sf_accounts array stored in Auth0 user_metadata:
 *
 *   user_metadata: {
 *     "sf_accounts": [
 *       {
 *         "client_id":   "<Salesforce Consumer Key>",
 *         "sf_username": "user@org.salesforce.com",
 *         "label":       "Human readable org name"
 *       }
 *     ]
 *   }
 *
 * Resolution order:
 *   1. sf_accounts[].client_id match  ← preferred (multi-org safe)
 *   2. user.sf_username               ← legacy single-org fallback
 *   3. user.email                     ← last resort
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.get('/launch-portal', requiresLogin, async (req, res) => {
  try {
    const user     = req.session.user;
    const clientId = process.env.SF_JWT_CLIENT_ID;

    // ── Resolve SF username ───────────────────────────────────────────────────
    let sfUsername = null;
    let source     = null;

    // 1. Match by client_id in sf_accounts array
    const sfAccounts = user.sf_accounts;
    if (Array.isArray(sfAccounts) && sfAccounts.length > 0) {
      const match = sfAccounts.find(a => a.client_id === clientId);
      if (match) {
        sfUsername = match.sf_username;
        source     = `sf_accounts[client_id=${clientId}] → label: "${match.label || 'unlabelled'}"`;
      } else {
        // Accounts exist but none match this client_id
        console.warn('[JWT Flow] sf_accounts found but no match for client_id:', clientId);
        console.warn('[JWT Flow] Available client_ids:', sfAccounts.map(a => a.client_id));
      }
    }

    // 2. Legacy single-org fallback
    if (!sfUsername && user.sf_username) {
      sfUsername = user.sf_username;
      source     = 'legacy sf_username claim';
    }

    // 3. Last resort — email (works only if SF username == email)
    if (!sfUsername && user.email) {
      sfUsername = user.email;
      source     = 'email fallback (sf_username not configured)';
    }

    if (!sfUsername) {
      return res.status(400).send(
        'Cannot determine Salesforce username. ' +
        'Add sf_accounts to this user\'s Auth0 user_metadata.'
      );
    }

    console.log('[JWT Flow] Resolved SF username:', {
      auth0_email: user.email,
      client_id:   clientId,
      sf_username: sfUsername,
      source,
    });

    const frontdoorUrl = await getSalesforceFrontdoorUrl(sfUsername);
    res.redirect(frontdoorUrl);

  } catch (err) {
    console.error('[JWT Flow] Error:', err.message);
    const msg = encodeURIComponent(err.message);
    res.redirect(`/?error=${msg}`);
  }
});

module.exports = router;