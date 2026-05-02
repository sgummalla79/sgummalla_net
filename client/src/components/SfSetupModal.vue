<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  open: boolean;
  flow: "jwt-bearer" | "token-exchange";
}>();

const emit = defineEmits<{
  close: [];
  register: [];
}>();

function handleRegister() {
  emit("close");
  emit("register");
}

// ── Certificate generator ────────────────────────────────────────────────────

const certCN = ref("sgummalla-works");
const generating = ref(false);
const generated = ref(false);
const privateKeyPem = ref("");
const certificatePem = ref("");

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function derLen(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const body = concat(...parts);
  return concat(new Uint8Array([tag]), derLen(body.length), body);
}

function utcTime(date: Date): Uint8Array {
  const s = date.toISOString().replace(/[-:T]/g, "").slice(2, 14) + "Z";
  const b = new TextEncoder().encode(s);
  return concat(new Uint8Array([0x17, b.length]), b);
}

function toPem(buffer: ArrayBuffer, label: string): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const lines = (b64.match(/.{1,64}/g) ?? []).join("\n");
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

async function generateCertificate() {
  generating.value = true;
  generated.value = false;
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );

    // Private key PEM
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    privateKeyPem.value = toPem(pkcs8, "PRIVATE KEY");

    // Self-signed X.509 certificate
    const spki = new Uint8Array(
      await crypto.subtle.exportKey("spki", keyPair.publicKey),
    );
    const cn = new TextEncoder().encode(certCN.value || "sgummalla-works");

    const SHA256RSA = new Uint8Array([
      0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b,
    ]);
    const CN_OID = new Uint8Array([0x55, 0x04, 0x03]);

    const algoId = der(
      0x30,
      der(0x06, SHA256RSA),
      new Uint8Array([0x05, 0x00]),
    );
    const name = der(
      0x30,
      der(0x31, der(0x30, der(0x06, CN_OID), der(0x0c, cn))),
    );
    const now = new Date();
    const validity = der(
      0x30,
      utcTime(now),
      utcTime(new Date(now.getTime() + 3650 * 86400000)),
    );

    const tbs = der(
      0x30,
      der(0xa0, der(0x02, new Uint8Array([0x02]))), // v3
      der(0x02, new Uint8Array([0x01])), // serial
      algoId,
      name,
      validity,
      name,
      spki,
    );

    const tbsBuf = tbs.buffer.slice(
      tbs.byteOffset,
      tbs.byteOffset + tbs.byteLength,
    ) as ArrayBuffer;
    const sig = new Uint8Array(
      await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, tbsBuf),
    );
    const cert = der(0x30, tbs, algoId, der(0x03, new Uint8Array([0x00]), sig));

    const certBuf = cert.buffer.slice(
      cert.byteOffset,
      cert.byteOffset + cert.byteLength,
    ) as ArrayBuffer;
    certificatePem.value = toPem(certBuf, "CERTIFICATE");
    generated.value = true;
  } finally {
    generating.value = false;
  }
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sf-setup-fade">
      <div v-if="open" class="sf-setup-overlay" @click.self="$emit('close')">
        <div
          class="sf-setup-modal"
          :class="{ 'sf-setup-modal--wide': flow === 'token-exchange' }"
        >
          <!-- Header -->
          <div class="sf-setup-header">
            <div class="sf-setup-header__left">
              <svg
                class="sf-setup-header__sf-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M10.12 3.27a5.1 5.1 0 0 1 3.61 1.5 6.12 6.12 0 0 1 3.74-1.27 6.18 6.18 0 0 1 6.18 6.18 6.18 6.18 0 0 1-6.18 6.18H5.25A4.25 4.25 0 0 1 1 11.62a4.25 4.25 0 0 1 4.25-4.25c.17 0 .34.01.5.03A5.09 5.09 0 0 1 10.12 3.27z"
                />
              </svg>
              <div>
                <p class="sf-setup-header__eyebrow">Salesforce Setup Guide</p>
                <p class="sf-setup-header__title">
                  {{
                    flow === "jwt-bearer"
                      ? "JWT Bearer Authentication"
                      : "Token Exchange Authentication"
                  }}
                </p>
              </div>
            </div>
            <button class="sf-setup-close" @click="$emit('close')">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="sf-setup-body">
            <!-- ── Cert generator (shared) ─────────────────────────── -->
            <div class="sf-cert-box">
              <div class="sf-cert-box__header">
                <div>
                  <p class="sf-cert-box__title">Generate RSA Key Pair</p>
                  <p class="sf-cert-box__desc">
                    Create a private key and self-signed certificate directly in
                    your browser — nothing is sent to any server.
                  </p>
                </div>
              </div>
              <div class="sf-cert-box__controls">
                <div class="sf-cert-box__cn">
                  <label class="sf-cert-box__label"
                    >Certificate CN (app name)</label
                  >
                  <input
                    v-model="certCN"
                    class="sf-cert-box__input"
                    placeholder="sgummalla-works"
                  />
                </div>
                <button
                  class="sf-cert-box__btn"
                  :disabled="generating"
                  @click="generateCertificate"
                >
                  <svg
                    v-if="generating"
                    class="sf-cert-spinner"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                  </svg>
                  <svg
                    v-else
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {{ generating ? "Generating…" : "Generate" }}
                </button>
              </div>
              <div v-if="generated" class="sf-cert-box__downloads">
                <button
                  class="sf-cert-dl sf-cert-dl--key"
                  @click="download(privateKeyPem, 'private.pem')"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download private.pem
                </button>
                <button
                  class="sf-cert-dl sf-cert-dl--cert"
                  @click="download(certificatePem, 'certificate.crt')"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download certificate.crt
                </button>
              </div>
              <p v-if="generated" class="sf-cert-box__note">
                ✓ Generated — upload <strong>certificate.crt</strong> to
                Salesforce. Paste <strong>private.pem</strong> when registering
                below.
              </p>
            </div>

            <!-- ── JWT Bearer ────────────────────────────────────────── -->
            <template v-if="flow === 'jwt-bearer'">
              <div class="sf-setup-steps">
                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">1</span>
                  <div>
                    <p class="sf-setup-step__title">
                      Create an External Client App
                    </p>
                    <p class="sf-setup-step__desc">
                      Setup → <strong>External Client Apps</strong> →
                      <strong>New External Client App</strong>
                    </p>
                    <table class="sf-setup-table">
                      <tr>
                        <td>Enable OAuth Settings</td>
                        <td>Checked</td>
                      </tr>
                      <tr>
                        <td>Callback URL</td>
                        <td>
                          <code class="sf-setup-inline"
                            >https://login.salesforce.com/services/oauth2/success</code
                          >
                        </td>
                      </tr>
                      <tr>
                        <td>Selected OAuth Scopes</td>
                        <td>
                          <code class="sf-setup-inline">api</code>,
                          <code class="sf-setup-inline">refresh_token</code>
                        </td>
                      </tr>
                      <tr>
                        <td>Use Digital Signatures</td>
                        <td>
                          Checked — upload
                          <code class="sf-setup-inline">certificate.crt</code>
                        </td>
                      </tr>
                      <tr>
                        <td>Permitted Users</td>
                        <td>
                          <strong
                            >Admin approved users are pre-authorized</strong
                          >
                        </td>
                      </tr>
                    </table>
                  </div>
                </div>

                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">2</span>
                  <div>
                    <p class="sf-setup-step__title">Pre-authorize the App</p>
                    <p class="sf-setup-step__desc">
                      External Client Apps → find your app →
                      <strong>Edit Policies</strong>
                    </p>
                    <ul class="sf-setup-list">
                      <li>
                        Permitted Users →
                        <strong>Admin approved users are pre-authorized</strong>
                      </li>
                      <li>
                        Add the target Salesforce user via Profiles or
                        Permission Sets
                      </li>
                    </ul>
                    <p class="sf-setup-step__note">
                      Every user who needs a token must be pre-authorized. A
                      request for a non-pre-authorized user returns an immediate
                      error.
                    </p>
                  </div>
                </div>

                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">3</span>
                  <div>
                    <p class="sf-setup-step__title">Copy the Consumer Key</p>
                    <p class="sf-setup-step__desc">
                      External Client Apps → find your app → copy the
                      <strong>Consumer Key</strong>. This becomes the
                      <code class="sf-setup-inline">iss</code> claim in every
                      JWT assertion — you'll paste it during registration below.
                    </p>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── Token Exchange ────────────────────────────────────── -->
            <template v-else>
              <div class="sf-setup-steps">
                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">1</span>
                  <div>
                    <p class="sf-setup-step__title">
                      Create an External Client App
                    </p>
                    <p class="sf-setup-step__desc">
                      Setup → <strong>External Client Apps</strong> →
                      <strong>New External Client App</strong>
                    </p>
                    <table class="sf-setup-table">
                      <tr>
                        <td>App Developer Name</td>
                        <td>
                          e.g.
                          <code class="sf-setup-inline"
                            >my_token_exchange_app</code
                          >
                          — you'll need this later
                        </td>
                      </tr>
                      <tr>
                        <td>Distribution State</td>
                        <td>Local</td>
                      </tr>
                      <tr>
                        <td>Selected OAuth Scopes</td>
                        <td>
                          <code class="sf-setup-inline">api</code>,
                          <code class="sf-setup-inline">refresh_token</code>
                        </td>
                      </tr>
                      <tr>
                        <td>Token Exchange Grant</td>
                        <td>
                          <strong>Enable</strong> — exposes the token-exchange
                          grant type
                        </td>
                      </tr>
                    </table>
                    <p class="sf-setup-step__note">
                      This flow uses the
                      <strong>ExternalClientApplication</strong> metadata type
                      (API 63.0+), not the legacy ConnectedApp. Ensure your org
                      targets Spring '26 or later.
                    </p>
                  </div>
                </div>

                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">2</span>
                  <div>
                    <p class="sf-setup-step__title">
                      Implement the Apex Token Handler
                    </p>
                    <p class="sf-setup-step__desc">
                      Create an Apex class extending
                      <code class="sf-setup-inline"
                        >Auth.Oauth2TokenExchangeHandler</code
                      >. This handler decodes the incoming Auth0 id_token and
                      resolves the Salesforce username.
                    </p>
                    <div class="sf-setup-code sf-setup-code--apex">
                      <code
                        >public class MyTokenExchangeHandler extends
                        Auth.Oauth2TokenExchangeHandler &#123;</code
                      >
                      <code>&nbsp;</code>
                      <code
                        >&nbsp; public override Auth.TokenValidationResult
                        validateIncomingToken(</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; String appDeveloperName,
                        Auth.IntegratingAppType appType,</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; String incomingToken,
                        Auth.OAuth2TokenExchangeType tokenType</code
                      >
                      <code>&nbsp; ) &#123;</code>
                      <code
                        >&nbsp;&nbsp;&nbsp; String[] parts =
                        incomingToken.split('\\.');</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; String payload =
                        parts[1].replace('-','+').replace('_','/');</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; while (Math.mod(payload.length(), 4)
                        != 0) payload += '=';</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; Map&lt;String,Object&gt; claims =
                        (Map&lt;String,Object&gt;)</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                        JSON.deserializeUntyped(EncodingUtil.base64Decode(payload).toString());</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; String sfUsername = (String)
                        claims.get('salesforce_username');</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; if
                        (String.isBlank(sfUsername))</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; return
                        Auth.TokenValidationResult.failure('Identity claim
                        missing');</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; return
                        Auth.TokenValidationResult.success(sfUsername);</code
                      >
                      <code>&nbsp; &#125;</code>
                      <code>&nbsp;</code>
                      <code
                        >&nbsp; public override User
                        getUserForTokenSubject(</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; String tokenSubject, String
                        appDeveloperName, Auth.IntegratingAppType appType</code
                      >
                      <code>&nbsp; ) &#123;</code>
                      <code
                        >&nbsp;&nbsp;&nbsp; List&lt;User&gt; users = [SELECT Id,
                        Username FROM User</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; WHERE Username =
                        :tokenSubject AND IsActive = true LIMIT 1];</code
                      >
                      <code
                        >&nbsp;&nbsp;&nbsp; return users.isEmpty() ? null :
                        users[0];</code
                      >
                      <code>&nbsp; &#125;</code>
                      <code>&#125;</code>
                    </div>
                    <p class="sf-setup-step__note">
                      The claim
                      <code class="sf-setup-inline">salesforce_username</code>
                      must be injected by your Auth0 Action into the id_token.
                      Adjust the claim name to match what Auth0 sends.
                    </p>
                  </div>
                </div>

                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">3</span>
                  <div>
                    <p class="sf-setup-step__title">
                      Register the Handler Metadata
                    </p>
                    <p class="sf-setup-step__desc">
                      Run this in Salesforce Developer Console → Execute
                      Anonymous to link the Apex class to your External Client
                      App.
                    </p>
                    <div class="sf-setup-code sf-setup-code--apex">
                      <code
                        >ExternalClientApplication eca = [SELECT Id FROM
                        ExternalClientApplication</code
                      >
                      <code
                        >&nbsp; WHERE DeveloperName = 'my_token_exchange_app'
                        LIMIT 1];</code
                      >
                      <code>&nbsp;</code>
                      <code
                        >OauthTokenExchangeHandler handler = new
                        OauthTokenExchangeHandler();</code
                      >
                      <code
                        >handler.ApexClass__c = 'MyTokenExchangeHandler';</code
                      >
                      <code
                        >handler.DeveloperName = 'MyTokenExchangeHandler';</code
                      >
                      <code
                        >handler.MasterLabel = 'My Token Exchange
                        Handler';</code
                      >
                      <code>handler.IsEnabled__c = true;</code>
                      <code>insert handler;</code>
                      <code>&nbsp;</code>
                      <code
                        >OauthTokenExchHandlerApp link = new
                        OauthTokenExchHandlerApp();</code
                      >
                      <code
                        >link.OauthTokenExchangeHandlerId = handler.Id;</code
                      >
                      <code>link.ExternalClientApplicationId = eca.Id;</code>
                      <code>insert link;</code>
                    </div>
                  </div>
                </div>

                <div class="sf-setup-step">
                  <span class="sf-setup-step__num">4</span>
                  <div>
                    <p class="sf-setup-step__title">Copy the Consumer Key</p>
                    <p class="sf-setup-step__desc">
                      External Client Apps → find your app → copy the
                      <strong>Consumer Key</strong>. Paste it in the
                      <em>Consumer Key</em> field when registering below. You
                      will also need the
                      <strong>App Developer Name</strong> used in Step 1.
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="sf-setup-footer">
            <button class="sf-setup-footer__cancel" @click="$emit('close')">
              Close
            </button>
            <button class="sf-setup-footer__register" @click="handleRegister">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Register client
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sf-setup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 450;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.sf-setup-modal {
  background: var(--vz-bg);
  border: 1px solid var(--vz-border);
  border-radius: 12px;
  width: 640px;
  max-width: calc(100vw - 2rem);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  /* clip instead of hidden so internal scroll containers still work */
  overflow: clip;
}

.sf-setup-modal--wide {
  width: 820px;
}

/* ── Header ── */
.sf-setup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--vz-border);
  background: var(--vz-surface);
  flex-shrink: 0;
}

.sf-setup-header__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sf-setup-header__sf-icon {
  width: 28px;
  height: 28px;
  color: #00a1e0;
  flex-shrink: 0;
}

.sf-setup-header__eyebrow {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
}

.sf-setup-header__title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--vz-text);
  margin-top: 0.1rem;
}

.sf-setup-close {
  background: none;
  border: none;
  color: var(--vz-text3);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: var(--vz-radius-sm);
  display: flex;
  align-items: center;
  transition:
    color 0.15s,
    background 0.15s;
}

.sf-setup-close:hover {
  color: var(--vz-text);
  background: var(--vz-surface2);
}

/* ── Body ── */
.sf-setup-body {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.25rem;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Cert generator box ── */
.sf-cert-box {
  background: var(--vz-surface);
  border: 1px solid var(--vz-border2);
  border-radius: var(--vz-radius-md);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sf-cert-box__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.sf-cert-box__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vz-text);
}

.sf-cert-box__desc {
  font-size: 0.78rem;
  color: var(--vz-text3);
  margin-top: 0.15rem;
  line-height: 1.5;
}

.sf-cert-box__controls {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.sf-cert-box__cn {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sf-cert-box__label {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3);
}

.sf-cert-box__input {
  background: var(--vz-bg);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-md);
  padding: 0.45rem 0.7rem;
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  color: var(--vz-text);
  outline: none;
  transition: border-color 0.15s;
}

.sf-cert-box__input:focus {
  border-color: var(--vz-border2);
}

.sf-cert-box__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: var(--vz-text);
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border2);
  border-radius: var(--vz-radius-md);
  padding: 0.45rem 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.sf-cert-box__btn:hover:not(:disabled) {
  background: var(--vz-bg);
  border-color: var(--vz-text3);
}

.sf-cert-box__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sf-cert-spinner {
  animation: sf-spin 0.9s linear infinite;
}

@keyframes sf-spin {
  to {
    transform: rotate(360deg);
  }
}

.sf-cert-box__downloads {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sf-cert-dl {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  border-radius: var(--vz-radius-sm);
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  border: 1px solid;
  transition: opacity 0.15s;
}

.sf-cert-dl:hover {
  opacity: 0.8;
}

.sf-cert-dl--key {
  color: var(--vz-green);
  background: rgba(74, 222, 128, 0.08);
  border-color: var(--vz-green);
}

.sf-cert-dl--cert {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.08);
  border-color: #60a5fa;
}

.sf-cert-box__note {
  font-size: 0.775rem;
  color: var(--vz-green);
  line-height: 1.5;
}

/* ── Steps ── */
.sf-setup-steps {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sf-setup-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.875rem;
  align-items: start;
}

.sf-setup-step__num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--vz-text2);
  flex-shrink: 0;
}

.sf-setup-step__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vz-text);
  margin-bottom: 0.3rem;
}

.sf-setup-step__desc {
  font-size: 0.825rem;
  color: var(--vz-text2);
  line-height: 1.55;
  margin-bottom: 0.5rem;
}

.sf-setup-step__note {
  font-size: 0.775rem;
  color: var(--vz-text3);
  line-height: 1.5;
  margin-top: 0.5rem;
}

.sf-setup-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sf-setup-list li {
  font-size: 0.825rem;
  color: var(--vz-text2);
  line-height: 1.5;
  padding-left: 1rem;
  position: relative;
}

.sf-setup-list li::before {
  content: "–";
  position: absolute;
  left: 0;
  color: var(--vz-text3);
}

.sf-setup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.sf-setup-table tr {
  border-bottom: 1px solid var(--vz-border);
}

.sf-setup-table tr:last-child {
  border-bottom: none;
}

.sf-setup-table td {
  padding: 0.4rem 0.6rem;
  color: var(--vz-text2);
  vertical-align: top;
}

.sf-setup-table td:first-child {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  color: var(--vz-text3);
  white-space: nowrap;
  width: 38%;
}

.sf-setup-code {
  background: var(--vz-surface);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-md);
  padding: 0.65rem 0.875rem;
  margin: 0.5rem 0;
  overflow-x: auto;
  /* Establish own scroll context so parent overflow-x: hidden doesn't block it */
  display: block;
}

.sf-setup-code code {
  display: block;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  color: var(--vz-green);
  white-space: pre;
  line-height: 1.65;
}

.sf-setup-code--apex code {
  color: #93c5fd;
}

.sf-setup-inline {
  font-family: var(--vz-font-mono);
  font-size: 0.78em;
  color: var(--vz-text);
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  border-radius: 3px;
  padding: 0.05em 0.35em;
}

/* ── Footer ── */
.sf-setup-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--vz-border);
  background: var(--vz-surface);
  flex-shrink: 0;
}

.sf-setup-footer__cancel {
  font-family: var(--vz-font-sans);
  font-size: 0.85rem;
  color: var(--vz-text3);
  background: none;
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-md);
  padding: 0.45rem 0.875rem;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.sf-setup-footer__cancel:hover {
  color: var(--vz-text);
  border-color: var(--vz-border2);
}

.sf-setup-footer__register {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--vz-font-sans);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--vz-bg);
  background: var(--vz-text);
  border: 1px solid var(--vz-text);
  border-radius: var(--vz-radius-md);
  padding: 0.45rem 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.sf-setup-footer__register:hover {
  opacity: 0.85;
}

/* ── Transition ── */
.sf-setup-fade-enter-active,
.sf-setup-fade-leave-active {
  transition: opacity 0.2s;
}
.sf-setup-fade-enter-from,
.sf-setup-fade-leave-to {
  opacity: 0;
}
</style>
