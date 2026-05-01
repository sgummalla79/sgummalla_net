public class WebAppTokenExchangeHandler extends Auth.Oauth2TokenExchangeHandler {

    public override Auth.TokenValidationResult validateIncomingToken(
        String appDeveloperName,
        Auth.IntegratingAppType appType,
        String incomingToken,
        Auth.OAuth2TokenExchangeType tokenType
    ) {
        if (tokenType != Auth.OAuth2TokenExchangeType.JWT) {
            return new Auth.TokenValidationResult(
                false, null, null, incomingToken, tokenType, 'Expected a JWT token'
            );
        }

        Map<String, Object> claims;
        try {
            String[] parts = incomingToken.split('\\.');
            if (parts.size() < 2) {
                return new Auth.TokenValidationResult(
                    false, null, null, incomingToken, tokenType, 'Invalid JWT format'
                );
            }
            String payload = parts[1].replace('-', '+').replace('_', '/');
            Integer mod = Math.mod(payload.length(), 4);
            if (mod == 2) payload += '==';
            else if (mod == 3) payload += '=';

            claims = (Map<String, Object>) JSON.deserializeUntyped(
                EncodingUtil.base64Decode(payload).toString()
            );
        } catch (Exception e) {
            return new Auth.TokenValidationResult(
                false, null, null, incomingToken, tokenType,
                'Failed to decode token: ' + e.getMessage()
            );
        }

        // Verify token came from our Auth0 tenant
        String iss = (String) claims.get('iss');
        if (String.isBlank(iss) || !iss.contains('auth0.com')) {
            return new Auth.TokenValidationResult(
                false, null, null, incomingToken, tokenType,
                'Untrusted issuer: ' + iss
            );
        }

        // Find the sf_accounts entry matching this External Client App
        List<Object> sfAccounts = (List<Object>) claims.get('sf_accounts');
        if (sfAccounts == null || sfAccounts.isEmpty()) {
            return new Auth.TokenValidationResult(
                false, null, null, incomingToken, tokenType,
                'No sf_accounts claim found in token'
            );
        }

        String sfUsername;
        for (Object item : sfAccounts) {
            Map<String, Object> acct = (Map<String, Object>) item;
            if (appDeveloperName.equals(acct.get('appDeveloperName'))) {
                sfUsername = (String) acct.get('sf_username');
                break;
            }
        }

        if (String.isBlank(sfUsername)) {
            return new Auth.TokenValidationResult(
                false, null, null, incomingToken, tokenType,
                'No sf_accounts entry found for app: ' + appDeveloperName
            );
        }

        Auth.UserData userData = new Auth.UserData(
            sfUsername, null, null, null,
            (String) claims.get('email'),
            null,
            sfUsername,  // username = sf_username for direct lookup
            null, iss, null, null
        );

        return new Auth.TokenValidationResult(
            true, null, userData, incomingToken, tokenType, null
        );
    }

    public override User getUserForTokenSubject(
        Id networkId,
        Auth.TokenValidationResult result,
        Boolean canCreateUser,
        String appDeveloperName,
        Auth.IntegratingAppType appType
    ) {
        String sfUsername = result.userData.username;
        List<User> users = [
            SELECT Id FROM User
            WHERE Username = :sfUsername AND IsActive = true
            LIMIT 1
        ];
        return users.isEmpty() ? null : users[0];
    }
}
