const html = `
<div class="doc-header">
  <div class="label">Technical Architecture Reference</div>
  <h1>Obtaining User-Scoped Salesforce Tokens<br>Without a Password</h1>
  <div class="subtitle">JWT Bearer Grant · OAuth 2.0 Token Exchange — Server-to-Server Authentication Patterns</div>
  <div class="meta-row">
    <span class="meta-tag">Platform: Salesforce Platform</span>
    <span class="meta-tag">Standards: RFC 7523 · RFC 8693</span>
    <span class="meta-tag">Flows: JWT Bearer · Token Exchange</span>
    <span class="meta-tag">Release: Spring '26</span>
  </div>
</div>

<div class="container">

<!-- 00 — OVERVIEW -->
<div class="section">
  <div class="section-label">00 — Overview</div>
  <div class="section-title">Two Patterns for Passwordless Salesforce Authentication</div>
  <p class="section-desc">
    Server-side integrations often need to act on behalf of a specific Salesforce user — querying
    records, executing Apex, or calling APIs — without storing that user's password or requiring
    interactive login. Two OAuth 2.0 grant types address this precisely:
    the <strong>JWT Bearer Grant</strong> (RFC 7523) and the
    <strong>OAuth 2.0 Token Exchange</strong> (RFC 8693).
  </p>
  <p class="section-desc">
    Both patterns produce a Salesforce <code>access_token</code> scoped to a real named user,
    with that user's profile, permission sets, and record visibility — without any browser
    redirect or password prompt. All credential handling happens server-to-server.
  </p>

  <div class="data-grid" style="grid-template-columns: 1.4fr 1fr 1fr;">
    <div class="cell hdr">Dimension</div>
    <div class="cell hdr center">JWT Bearer (RFC 7523)</div>
    <div class="cell hdr center last-col">Token Exchange (RFC 8693)</div>

    <div class="cell dim">Credential held by server</div>
    <div class="cell center">RSA private key</div>
    <div class="cell center last-col">IdP-issued token (e.g. id_token)</div>

    <div class="cell dim">User identity source</div>
    <div class="cell center">Salesforce username passed at call time</div>
    <div class="cell center last-col">Identity claim inside IdP token</div>

    <div class="cell dim">Salesforce app type</div>
    <div class="cell center">External Client App</div>
    <div class="cell center last-col">External Client App (required)</div>

    <div class="cell dim">Custom Apex required</div>
    <div class="cell center"><span class="no">No</span></div>
    <div class="cell center last-col"><span class="yes">Yes — token handler</span></div>

    <div class="cell dim">Best suited for</div>
    <div class="cell center">Service accounts, batch jobs, per-user API calls where the caller controls the SF username</div>
    <div class="cell center last-col">Federating an existing IdP session into Salesforce without re-authenticating</div>

    <div class="cell dim last-row">Browser involvement</div>
    <div class="cell center last-row"><span class="no">None</span></div>
    <div class="cell center last-col last-row"><span class="partial">Login phase only (IdP); token exchange is server-to-server</span></div>
  </div>
</div>

<!-- 01 — JWT BEARER FLOW -->
<div class="section">
  <div class="section-label">01 — JWT Bearer Flow</div>
  <div class="section-title">RFC 7523 — Assertion-Based Token Acquisition</div>
  <p class="section-desc">
    The JWT Bearer grant lets a server prove its identity to Salesforce using a cryptographically
    signed assertion rather than a client secret or user password. Salesforce verifies the
    signature against a certificate you uploaded, then issues an <code>access_token</code>
    for the Salesforce user named in the assertion.
  </p>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 8px;">How It Works</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:20px;">
    The server mints a short-lived JWT signed with its RSA private key. The JWT carries three
    critical claims: <code>iss</code> (Consumer Key of the External Client App),
    <code>sub</code> (the Salesforce username to impersonate), and
    <code>aud</code> (the Salesforce token endpoint). Salesforce verifies the RS256 signature
    against the certificate on the External Client App, checks that the user is pre-authorised, and
    returns an access token. The private key never leaves the server.
  </p>

<pre class="lws-diagram">
  Client App                Your Server               Salesforce
      │                          │                         │
      ├── POST /api/token ───────►│                         │
      │   { sf_username }         │                         │
      │                           │                         │
      │                    ┌──────┴──────────┐              │
      │                    │  Mint RS256 JWT  │              │
      │                    │  iss = ConsumerKey│             │
      │                    │  sub = sfUsername │             │
      │                    │  aud = SF token   │             │
      │                    │  exp = now+3min   │             │
      │                    └──────┬──────────┘              │
      │                           │                         │
      │                           ├── POST /oauth2/token ───►│
      │                           │   grant_type=jwt-bearer  │
      │                           │   assertion=&lt;JWT&gt;        │
      │                           │                         │
      │                           │                  ┌──────┴──────┐
      │                           │                  │ Verify sig  │
      │                           │                  │ Check cert  │
      │                           │                  │ Check perms │
      │                           │                  └──────┬──────┘
      │                           │                         │
      │                           │◄── { access_token } ────┤
      │                           │    { instance_url  }    │
      │                           │                         │
      │◄── { access_token } ──────┤                         │
      │    { instance_url  }      │                         │
      │    { sf_username   }      │                         │
</pre>

  <div class="callout info">
    <strong>Short JWT lifetime is intentional.</strong> The assertion is valid for 3 minutes
    (Salesforce maximum). The resulting <code>access_token</code> carries a standard session
    lifetime. Each token acquisition mints a fresh JWT — do not reuse assertions.
  </div>
</div>

<!-- 02 — JWT BEARER SETUP -->
<div class="section">
  <div class="section-label">02 — JWT Bearer Setup</div>
  <div class="section-title">Salesforce Configuration — External Client App &amp; Certificate</div>
  <p class="section-desc">
    This flow requires a Salesforce External Client App with a digital certificate and the
    <code>jwt-bearer</code> OAuth policy enabled.
  </p>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 1 — Generate an RSA Key Pair</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:16px;">
    Generate a 2048-bit (or 4096-bit) RSA key pair. The private key stays on your server;
    the public certificate is uploaded to Salesforce.
  </p>

<pre class="lws-diagram">
# Generate private key
openssl genrsa -out private.pem 2048

# Generate self-signed certificate (10-year validity)
openssl req -new -x509 -key private.pem \
  -out certificate.crt -days 3650 \
  -subj "/CN=your-app-name"
</pre>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 2 — Create the External Client App</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:12px;">
    In Salesforce Setup → External Client Apps → New:
  </p>

  <div class="data-grid" style="grid-template-columns: 1fr 2fr;">
    <div class="cell hdr">Field</div>
    <div class="cell hdr last-col">Value</div>

    <div class="cell dim">Enable OAuth Settings</div>
    <div class="cell last-col"><span class="yes">✓ Checked</span></div>

    <div class="cell dim">Callback URL</div>
    <div class="cell last-col"><code>https://login.salesforce.com/services/oauth2/success</code> (placeholder — not used by this flow)</div>

    <div class="cell dim">Selected OAuth Scopes</div>
    <div class="cell last-col"><code>api</code>, <code>refresh_token</code> (add scopes your integration needs)</div>

    <div class="cell dim">Use Digital Signatures</div>
    <div class="cell last-col"><span class="yes">✓ Checked</span> — upload <code>certificate.crt</code></div>

    <div class="cell dim last-row">Permitted Users</div>
    <div class="cell last-col last-row">
      <strong>Admin approved users are pre-authorized</strong> — grants access to specific profiles or permission sets only.
      Alternatively <em>All users may self-authorize</em> for development environments.
    </div>
  </div>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 3 — Enable the JWT Bearer Policy</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:12px;">
    After saving the External Client App, open its OAuth settings and configure policies:
  </p>
  <ul style="font-size:15px;color:var(--text-dim);line-height:2;padding-left:1.5rem;margin-bottom:20px;">
    <li>Set <strong>Permitted Users</strong> to <em>Admin approved users are pre-authorized</em></li>
    <li>Add the profiles or permission sets that should be eligible under the pre-authorization section</li>
    <li>Note the <strong>Consumer Key</strong> — this becomes the <code>iss</code> claim in your JWT</li>
  </ul>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 4 — Mint and Exchange the JWT (Server Code)</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:16px;">
    At token-request time, the server constructs and signs the JWT, then POSTs it to Salesforce:
  </p>

<pre class="lws-diagram">
// JWT payload
{
  "iss": "&lt;Consumer Key&gt;",
  "sub": "&lt;salesforce.username@example.com&gt;",
  "aud": "https://login.salesforce.com",
  "exp": &lt;unix timestamp: now + 180 seconds&gt;
}

// Signed with RS256 using the RSA private key

// Token endpoint
POST https://login.salesforce.com/services/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
&amp;assertion=&lt;signed JWT&gt;
</pre>

  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-top:16px;">
    A successful response returns <code>access_token</code>, <code>instance_url</code>,
    and optionally <code>refresh_token</code> (if the External Client App has refresh token scope enabled).
    Use <code>instance_url</code> as the base URL for all subsequent Salesforce API calls.
  </p>

  <div class="callout warning">
    <strong>Sandbox vs Production.</strong> Use <code>https://test.salesforce.com</code> as the
    <code>aud</code> claim and token endpoint when targeting a sandbox org.
    The External Client App must exist in the org you are authenticating against.
  </div>

  <div class="callout success">
    <strong>No user interaction required.</strong> Once a Salesforce user is pre-authorised on the
    External Client App, any server holding the private key can obtain a token for that user at any time.
    This makes the JWT Bearer flow well-suited to background jobs, ETL pipelines, and multi-tenant
    SaaS integrations where each tenant maps to a named Salesforce user.
  </div>
</div>

<!-- 03 — TOKEN EXCHANGE FLOW -->
<div class="section">
  <div class="section-label">03 — OAuth 2.0 Token Exchange</div>
  <div class="section-title">RFC 8693 — Federating an Existing Identity into Salesforce</div>
  <p class="section-desc">
    The OAuth 2.0 Token Exchange grant allows a server to present a token issued by a trusted
    Identity Provider (IdP) and receive a Salesforce <code>access_token</code> in return —
    without the user re-authenticating. Salesforce delegates identity resolution to a custom
    Apex handler that decodes the incoming token, maps it to a Salesforce user, and returns
    that user for session issuance.
  </p>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 8px;">How It Works</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:20px;">
    The flow operates in two phases. In Phase 1, the user logs in through your Identity Provider
    and receives an <code>id_token</code> (or any signed token carrying user identity claims).
    That token is stored server-side at session time. In Phase 2, when a Salesforce token is
    needed, the server forwards the stored IdP token to Salesforce's token endpoint using the
    <code>urn:ietf:params:oauth:grant-type:token-exchange</code> grant. Salesforce invokes the
    registered Apex handler, which decodes the IdP token and resolves the Salesforce username.
    No JWT is minted — the IdP token is forwarded as-is.
  </p>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:20px 0 8px;">Phase 1 — User Login &amp; Token Storage</h3>

<pre class="lws-diagram">
  Browser           Identity Provider             Server
     │                     │                        │
     ├── Login ────────────►│                        │
     │                     │                        │
     │◄── id_token ─────────┤                        │
     │    (with user claims) │                       │
     │                      │                        │
     ├── POST /callback ──────────────────────────── ►│
     │   { id_token }        │                        │
     │                       │                   ┌────┴────┐
     │                       │                   │ Store   │
     │                       │                   │id_token │
     │                       │                   └────┬────┘
     │◄── session established ─────────────────────── ┤
</pre>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 8px;">Phase 2 — Token Exchange</h3>

<pre class="lws-diagram">
  Browser          Server           Salesforce        Apex Handler
     │                │                  │                  │
     ├── API call ────►│                  │                  │
     │   (session)     │                  │                  │
     │            ┌────┴────┐             │                  │
     │            │Retrieve  │            │                  │
     │            │id_token  │            │                  │
     │            └────┬────┘             │                  │
     │                │                  │                  │
     │                ├── POST /oauth2/token ───────────────►│
     │                │   grant=token-exchange               │
     │                │   subject_token=&lt;id_token&gt;           │
     │                │                  │                  │
     │                │                  ├──validateIncomingToken()──►│
     │                │                  │                  │
     │                │                  │           ┌───────┴──────┐
     │                │                  │           │ Decode JWT   │
     │                │                  │           │ Read claims  │
     │                │                  │           │ Resolve user │
     │                │                  │           └───────┬──────┘
     │                │                  │                  │
     │                │                  │◄── sf_username ───┤
     │                │                  │                  │
     │                │◄── access_token ─┤                  │
     │                │    instance_url   │                  │
     │◄── access_token─┤                  │                  │
</pre>

  <div class="callout info">
    <strong>The IdP token is forwarded as-is.</strong> The server does not sign a new JWT or
    transform the token in any way. Salesforce passes the raw token to your Apex handler, which
    performs all decoding and user resolution. This keeps identity logic centralised in Apex
    and ensures the token's integrity (signature) can be verified server-side if needed.
  </div>
</div>

<!-- 04 — TOKEN EXCHANGE SETUP -->
<div class="section">
  <div class="section-label">04 — Token Exchange Setup</div>
  <div class="section-title">Salesforce Configuration — External Client App &amp; Apex Handler</div>
  <p class="section-desc">
    The Token Exchange flow requires an External Client App (available Spring '25+), a custom
    Apex class extending <code>Auth.Oauth2TokenExchangeHandler</code>, and a metadata record
    linking the two. This flow cannot use the legacy Connected App type.
  </p>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 1 — Create an External Client App</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:12px;">
    In Salesforce Setup → External Client Apps → New:
  </p>

  <div class="data-grid" style="grid-template-columns: 1fr 2fr;">
    <div class="cell hdr">Field</div>
    <div class="cell hdr last-col">Value</div>

    <div class="cell dim">App Name &amp; Developer Name</div>
    <div class="cell last-col">Choose a name matching your integration (e.g. <code>my_token_exchange_app</code>)</div>

    <div class="cell dim">Distribution State</div>
    <div class="cell last-col">Local (single-org) or Global (managed package)</div>

    <div class="cell dim">Selected OAuth Scopes</div>
    <div class="cell last-col"><code>api</code>, <code>refresh_token</code> as needed</div>

    <div class="cell dim">Token Exchange Grant</div>
    <div class="cell last-col"><span class="yes">✓ Enable</span> — exposes the <code>token-exchange</code> grant type</div>

    <div class="cell dim last-row">Apex Handler</div>
    <div class="cell last-col last-row">
      Leave empty on the External Client App form — the handler is linked separately via the
      <code>OauthTokenExchangeHandler</code> metadata record (see Step 3)
    </div>
  </div>

  <div class="callout warning">
    <strong>External Client Apps use a different metadata type.</strong>
    The <code>ExternalClientApplication</code> metadata type replaces <code>ConnectedApp</code>
    for this flow. Deployments via Salesforce CLI use <code>.eca-meta.xml</code> files, not
    <code>.connectedApp-meta.xml</code>. Verify your SFDX project targets API version 63.0 or later.
  </div>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 2 — Implement the Apex Token Handler</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:16px;">
    Create an Apex class extending <code>Auth.Oauth2TokenExchangeHandler</code>. This class
    receives the incoming token and must return a Salesforce <code>User</code> record.
    Two methods are required:
  </p>
  <ul style="font-size:15px;color:var(--text-dim);line-height:2;padding-left:1.5rem;margin-bottom:16px;">
    <li><code>validateIncomingToken()</code> — decode the token, extract identity claims, return a
        <code>Auth.TokenValidationResult</code> containing the resolved Salesforce username</li>
    <li><code>getUserForTokenSubject()</code> — given the username returned above, query and
        return the <code>User</code> record; Salesforce uses this to issue the session</li>
  </ul>

<pre class="lws-diagram">
public class MyTokenExchangeHandler extends Auth.Oauth2TokenExchangeHandler {

    public override Auth.TokenValidationResult validateIncomingToken(
        String appDeveloperName,
        Auth.IntegratingAppType appType,
        String incomingToken,
        Auth.OAuth2TokenExchangeType tokenType
    ) {
        // 1. Decode the base64url JWT payload (no library needed)
        String[] parts = incomingToken.split('\\.');
        String payload = parts[1]
            .replace('-', '+')
            .replace('_', '/');
        // Pad to multiple of 4
        while (Math.mod(payload.length(), 4) != 0) payload += '=';
        Map&lt;String,Object&gt; claims = (Map&lt;String,Object&gt;)
            JSON.deserializeUntyped(
                EncodingUtil.base64Decode(payload).toString()
            );

        // 2. Extract the identity claim that maps to a Salesforce username
        //    The claim name depends on your IdP's token structure.
        String sfUsername = (String) claims.get('salesforce_username');

        if (String.isBlank(sfUsername)) {
            return Auth.TokenValidationResult.failure('Identity claim missing');
        }

        return Auth.TokenValidationResult.success(sfUsername);
    }

    public override User getUserForTokenSubject(
        String tokenSubject,
        String appDeveloperName,
        Auth.IntegratingAppType appType
    ) {
        List&lt;User&gt; users = [
            SELECT Id, Username
            FROM   User
            WHERE  Username = :tokenSubject
               AND IsActive  = true
            LIMIT 1
        ];
        return users.isEmpty() ? null : users[0];
    }
}
</pre>

  <div class="callout info">
    <strong>Identity claim mapping.</strong> The claim used to resolve the Salesforce username
    depends entirely on what your IdP includes in the token. Common patterns include a
    <code>salesforce_username</code> custom claim, a <code>federation_id</code> mapped to
    the Salesforce <code>FederationIdentifier</code> field, or an email matched against
    <code>User.Email</code>. Username matching is the most reliable since it is unique per org.
    Consider including an app-level scope claim (e.g. an array of allowed app identifiers passed
    as <code>appDeveloperName</code>) to restrict which apps can exchange tokens for which users.
  </div>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 3 — Register the Handler Metadata</h3>
  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-bottom:16px;">
    Salesforce requires an <code>OauthTokenExchangeHandler</code> metadata record linking the
    Apex class to the External Client App. The easiest way to create this link is via Apex DML
    in an anonymous window or a setup script — the UI form does not expose all required fields
    for External Client Apps.
  </p>

<pre class="lws-diagram">
// Run in Developer Console → Execute Anonymous

// 1. Find the External Client App ID
ExternalClientApplication eca = [
    SELECT Id FROM ExternalClientApplication
    WHERE DeveloperName = 'my_token_exchange_app'
    LIMIT 1
];

// 2. Create (or upsert) the handler record
OauthTokenExchangeHandler handler = new OauthTokenExchangeHandler();
handler.ApexClass__c         = 'MyTokenExchangeHandler';
handler.DeveloperName        = 'MyTokenExchangeHandler';
handler.MasterLabel          = 'My Token Exchange Handler';
handler.IsEnabled__c         = true;
insert handler;

// 3. Link handler → External Client App
OauthTokenExchHandlerApp link = new OauthTokenExchHandlerApp();
link.OauthTokenExchangeHandlerId    = handler.Id;
link.ExternalClientApplicationId    = eca.Id;
insert link;
</pre>

  <div class="callout warning">
    <strong>API field names vary by org version.</strong> The exact field names on
    <code>OauthTokenExchangeHandler</code> (<code>ApexClass__c</code>, <code>IsEnabled__c</code>)
    and <code>OauthTokenExchHandlerApp</code> (<code>ExternalClientApplicationId</code>)
    reflect the schema in API version 63.0 (Spring '26). Introspect your org with
    <code>Schema.getGlobalDescribe()</code> or the Tooling API if field names differ.
  </div>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:28px 0 12px;">Step 4 — Call the Token Exchange Endpoint (Server Code)</h3>

<pre class="lws-diagram">
POST https://login.salesforce.com/services/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&amp;client_id=&lt;External Client App Consumer Key&gt;
&amp;subject_token=&lt;IdP id_token or access_token&gt;
&amp;subject_token_type=urn:ietf:params:oauth:token-type:id_token
</pre>

  <p style="font-size:15px;color:var(--text-dim);line-height:1.8;margin-top:16px;">
    A successful response returns <code>access_token</code> and <code>instance_url</code>.
    To resolve the Salesforce username of the resulting session (for display or logging),
    call <code>GET {instance_url}/services/oauth2/userinfo</code> with the access token.
  </p>
</div>

<!-- 05 — COMPARISON & GUIDANCE -->
<div class="section">
  <div class="section-label">05 — Architecture Guidance</div>
  <div class="section-title">Choosing Between the Two Patterns</div>
  <p class="section-desc">
    Both patterns achieve the same outcome — a user-scoped Salesforce session — but they
    suit different integration architectures. The following guidance covers the most common
    decision points.
  </p>

  <div class="data-grid" style="grid-template-columns: 1.2fr 1fr 1fr;">
    <div class="cell hdr">Scenario</div>
    <div class="cell hdr center">JWT Bearer</div>
    <div class="cell hdr center last-col">Token Exchange</div>

    <div class="cell dim">Your app already has an IdP login flow</div>
    <div class="cell center"><span class="partial">Works, but identity is asserted by the server</span></div>
    <div class="cell center last-col"><span class="yes">Natural fit — reuse the existing session token</span></div>

    <div class="cell dim">Background / scheduled jobs with no user session</div>
    <div class="cell center"><span class="yes">Ideal — no user session needed</span></div>
    <div class="cell center last-col"><span class="no">Requires a valid IdP token — not available without a login</span></div>

    <div class="cell dim">Multi-tenant: each customer has a different SF username</div>
    <div class="cell center"><span class="yes">Pass the target username per request</span></div>
    <div class="cell center last-col"><span class="yes">Embed the SF username in the IdP token claim</span></div>

    <div class="cell dim">Compliance: no long-lived server credentials</div>
    <div class="cell center"><span class="partial">Private key is long-lived; rotate on a schedule</span></div>
    <div class="cell center last-col"><span class="yes">Server holds short-lived IdP tokens only</span></div>

    <div class="cell dim">Salesforce org type</div>
    <div class="cell center">External Client App (API 63.0+)</div>
    <div class="cell center last-col"><span class="partial">External Client App required (63.0+)</span></div>

    <div class="cell dim last-row">Custom code on Salesforce side</div>
    <div class="cell center last-row"><span class="yes">None required</span></div>
    <div class="cell center last-col last-row"><span class="partial">Apex handler required</span></div>
  </div>

  <h3 style="font-size:22px;font-weight:700;color:var(--text);margin:36px 0 12px;">Key Considerations</h3>

  <div class="callout warning">
    <strong>JWT Bearer — Pre-authorisation is mandatory.</strong>
    Users must be pre-authorised on the External Client App before the first token request.
    A request for a user who is not pre-authorised returns an immediate error.
    Automate pre-authorisation via Profiles or Permission Sets assigned to the External Client App.
  </div>

  <div class="callout warning">
    <strong>Token Exchange — Apex handler is the security boundary.</strong>
    The handler runs with system privileges. Ensure it validates the token signature (or delegates
    to a trusted claim), checks the <code>appDeveloperName</code> against an allowlist, and returns
    <code>null</code> (not an error) for any token that should not be trusted.
    Returning a User record grants that user a full Salesforce session.
  </div>

  <div class="callout info">
    <strong>Refresh tokens &amp; caching.</strong> Both flows support
    <code>refresh_token</code> scope. Cache access tokens for their full lifetime
    (check <code>issued_at</code> + session timeout) and refresh proactively rather than
    waiting for a 401 response. For the JWT Bearer flow, re-minting a JWT and calling the
    token endpoint again is also a valid — and often simpler — refresh strategy.
  </div>

  <div class="callout success">
    <strong>Both patterns keep credentials server-side.</strong>
    Neither flow exposes a Salesforce password, session cookie, or private key to the
    browser. The client application only ever sees the resulting <code>access_token</code>
    (or an opaque session identifier if your server proxies Salesforce calls).
    This is the primary security advantage of server-to-server token acquisition over
    interactive OAuth flows for machine-to-machine integrations.
  </div>
</div>

</div>
`;

export default html;
