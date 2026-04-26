<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  type CopilotClient,
} from "../api/copilotClients";

const router = useRouter();
const auth = useAuthStore();

// ── Toasts ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}
let toastSeq = 0;
const toasts = ref<Toast[]>([]);

function addToast(message: string, type: Toast["type"] = "success") {
  const id = ++toastSeq;
  toasts.value.push({ id, message, type });
  setTimeout(() => removeToast(id), 4000);
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

// ── State ─────────────────────────────────────────────────────────────────────

const clients = ref<CopilotClient[]>([]);
const loading = ref(true);
const submitting = ref(false);
const formError = ref<string | null>(null);

const form = ref({
  client_id: "",
  client_secret: "",
  name: "",
  allowed_origins: "",
});

const editSidebarOpen = ref(false);
const editTarget = ref<CopilotClient | null>(null);
const editForm = ref({
  client_id: "",
  client_secret: "",
  name: "",
  allowed_origins: "",
});
const savingId = ref(false);
const deletingId = ref<string | null>(null);
const deleteTarget = ref<CopilotClient | null>(null);

const sidebarOpen = ref(false);
const expandedId = ref<string | null>(null);
const sfExpandedId = ref<string | null>(null);
const copiedSnippet = ref<string | null>(null);

const origin = window.location.origin;
const copilotServer = computed(() => `${origin}/copilot`);
const expandedClient = computed(
  () => clients.value.find((c) => c.client_id === expandedId.value) ?? null,
);
const sfExpandedClient = computed(
  () => clients.value.find((c) => c.client_id === sfExpandedId.value) ?? null,
);
const copiedField = ref<string | null>(null);

function copyField(key: string, value: string) {
  if (!value) return;
  navigator.clipboard.writeText(value);
  copiedField.value = key;
  setTimeout(() => (copiedField.value = null), 2000);
}

function generateClientId() {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  form.value.client_id = `app-${rand}`;
}

function generateClientSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  form.value.client_secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    clients.value = await listClients();
  } finally {
    loading.value = false;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseOrigins(raw: string) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function handleLogout() {
  auth.logout().then(() => router.push({ name: "home" }));
}

function toggleExpand(clientId: string) {
  expandedId.value = expandedId.value === clientId ? null : clientId;
}

function copySnippet(key: string, text: string) {
  navigator.clipboard.writeText(text);
  copiedSnippet.value = key;
  setTimeout(() => (copiedSnippet.value = null), 2000);
}

function snippetEnv() {
  return `COPILOT_CLIENT_SECRET=your-client-secret-here`;
}

function snippetInstall() {
  return `npm install jsonwebtoken`;
}

function snippetBackend(clientId: string) {
  const tokenUrl = `${window.location.origin}/api/copilot/token`;
  return `const jwt = require("jsonwebtoken");

// GET /copilot-token  — call this from your frontend
app.get("/copilot-token", async (req, res) => {
  // Make sure the user is authenticated before issuing a token
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  // 1. Build a short-lived assertion JWT signed with your client_secret
  const assertion = jwt.sign(
    {
      client_id:  "${clientId}",
      identifier: req.user.email,          // unique ID for this user
      metadata:   { name: req.user.name }, // shown in the copilot UI
    },
    process.env.COPILOT_CLIENT_SECRET,     // from your .env — never in browser
    { algorithm: "HS256", expiresIn: "5m" }
  );

  // 2. Exchange the assertion for a Chainlit access token
  const response = await fetch("${tokenUrl}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assertion }),
  });

  if (!response.ok) {
    return res.status(502).json({ error: "Token exchange failed" });
  }

  const { access_token } = await response.json();

  // 3. Return it to the frontend (keep expiry short — token lives 1 hour)
  res.json({ access_token });
});`;
}

function snippetFrontend(_clientId: string) {
  const server = copilotServer.value;
  return `<!-- Paste this where you want the copilot widget to appear -->

<!-- 1. Load the copilot widget script from the copilot server -->
<script src="${server}/copilot/index.js"><\/script>

<!-- 2. Initialise the widget -->
<script>
  (async () => {
    // Fetch the access token from YOUR backend (never put client_secret here)
    const res = await fetch("/copilot-token", { credentials: "include" });
    const { access_token } = await res.json();

    // Mount the floating chat widget
    window.mountChainlitWidget({
      chainlitServer: "${server}",
      accessToken: access_token, // raw JWT — the widget adds "Bearer" automatically
    });
  })();
<\/script>`;
}

// ── Salesforce snippets ───────────────────────────────────────────────────────

function snippetSFApex(clientId: string) {
  const tokenUrl = `${window.location.origin}/api/copilot/token`;
  return `public class CopilotController {

    // Store your client_secret in a Protected Custom Setting or Named Credential
    // Never hardcode it here — use CustomSettings or Label.CopilotClientSecret
    private static final String CLIENT_SECRET = Label.CopilotClientSecret;
    private static final String CLIENT_ID     = '${clientId}';
    private static final String TOKEN_URL     = '${tokenUrl}';

    @RemoteAction
    public static String getAccessToken() {
        // 1. Build assertion JWT header + payload
        Long exp = DateTime.now().addMinutes(5).getTime() / 1000;
        String userId = UserInfo.getUserName();
        String userName = UserInfo.getName();

        String header  = b64url(Blob.valueOf('{"alg":"HS256","typ":"JWT"}'));
        String payload = b64url(Blob.valueOf(
            '{"client_id":"' + CLIENT_ID + '",' +
            '"identifier":"' + userId   + '",' +
            '"metadata":{"name":"' + userName + '"},' +
            '"exp":'         + exp       + '}'
        ));
        String sigInput = header + '.' + payload;

        // 2. Sign with HMAC-SHA256
        Blob sig = Crypto.generateMac(
            'HmacSHA256',
            Blob.valueOf(sigInput),
            Blob.valueOf(CLIENT_SECRET)
        );
        String assertion = sigInput + '.' + b64url(sig);

        // 3. Exchange assertion for Chainlit access token
        HttpRequest req = new HttpRequest();
        req.setEndpoint(TOKEN_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody('{"assertion":"' + assertion + '"}');
        req.setTimeout(10000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Token exchange failed: ' + res.getBody());
        }

        Map<String,Object> body = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        return (String) body.get('access_token');
    }

    // Base64-URL encoder (no padding, - instead of +, _ instead of /)
    private static String b64url(Blob input) {
        return EncodingUtil.base64Encode(input)
            .replace('+', '-').replace('/', '_').replace('=', '');
    }
}`;
}

function snippetSFPage(_clientId: string) {
  const server = copilotServer.value;
  return `<apex:page controller="CopilotController" showHeader="false" sidebar="false"
          docType="html-5.0" applyBodyTag="false" applyHtmlTag="false">
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <!-- Load the copilot widget from the Chainlit server -->
  <script src="${server}/copilot/index.js"><\/script>
</head>
<body>

<script>
  // JS remoting calls the Apex controller to get an access token
  Visualforce.remoting.Manager.invokeAction(
    '{!$RemoteAction.CopilotController.getAccessToken}',
    function(result, event) {
      if (event.status && result) {
        window.mountChainlitWidget({
          chainlitServer: '${server}',
          accessToken: result,  // raw JWT — widget adds "Bearer" automatically
        });
      } else {
        console.error('Copilot token error:', event.message);
      }
    }
  );
<\/script>

</body>
</html>
</apex:page>`;
}

function snippetSFCustomLabel() {
  return `Setup → Custom Labels → New
  Name:  CopilotClientSecret
  Value: <paste your client_secret here>
  Protected: ✅ (only code in the same namespace can read it)`;
}

// ── Create ────────────────────────────────────────────────────────────────────

function openSidebar() {
  form.value = {
    client_id: "",
    client_secret: "",
    name: "",
    allowed_origins: "",
  };
  formError.value = null;
  sidebarOpen.value = true;
}

function closeSidebar() {
  sidebarOpen.value = false;
  formError.value = null;
}

async function handleCreate() {
  formError.value = null;
  submitting.value = true;
  try {
    await createClient({
      client_id: form.value.client_id,
      client_secret: form.value.client_secret,
      ...(form.value.name ? { name: form.value.name } : {}),
      allowed_origins: parseOrigins(form.value.allowed_origins),
    });
    clients.value = await listClients();
    closeSidebar();
    addToast(`"${form.value.client_id || "Client"}" registered successfully.`);
  } catch (err: any) {
    formError.value = err.response?.data?.error ?? "Failed to create client";
  } finally {
    submitting.value = false;
  }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function startEdit(client: CopilotClient) {
  editTarget.value = client;
  editForm.value = {
    client_id: client.client_id,
    client_secret: "",
    name: client.name ?? "",
    allowed_origins: client.allowed_origins.join(", "),
  };
  editSidebarOpen.value = true;
}

function cancelEdit() {
  editSidebarOpen.value = false;
  editTarget.value = null;
}

async function saveEdit() {
  if (!editTarget.value) return;
  savingId.value = true;
  try {
    const result = await updateClient(editTarget.value.client_id, {
      ...(editForm.value.client_id
        ? { client_id: editForm.value.client_id }
        : {}),
      ...(editForm.value.client_secret
        ? { client_secret: editForm.value.client_secret }
        : {}),
      ...(editForm.value.name ? { name: editForm.value.name } : {}),
      allowed_origins: parseOrigins(editForm.value.allowed_origins),
    });
    clients.value = await listClients();
    // if client_id changed, keep instructions sidebar in sync
    if (expandedId.value === editTarget.value.client_id) {
      expandedId.value = result.client_id;
    }
    cancelEdit();
    addToast("Client updated successfully.");
  } catch (err: any) {
    addToast(err.response?.data?.error ?? "Failed to update client.", "error");
  } finally {
    savingId.value = false;
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

function requestDelete(client: CopilotClient) {
  deleteTarget.value = client;
}

function cancelDelete() {
  deleteTarget.value = null;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const { client_id, name } = deleteTarget.value;
  deleteTarget.value = null;
  deletingId.value = client_id;
  try {
    await deleteClient(client_id);
    clients.value = clients.value.filter((c) => c.client_id !== client_id);
    if (editTarget.value?.client_id === client_id) cancelEdit();
    if (expandedId.value === client_id) expandedId.value = null;
    addToast(`"${name || client_id}" deleted.`);
  } catch {
    addToast("Failed to delete client.", "error");
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <AppLayout
    active-page="copilot-clients"
    :is-owner="auth.isOwner"
    :user-name="auth.fullName"
    :user-email="auth.email"
    :scrollable="true"
    @profile="router.push({ name: 'profile' })"
    @logout="handleLogout"
  >
    <div class="cc">
      <!-- Header -->
      <div class="cc__header">
        <div class="cc__header-row">
          <div>
            <h1 class="cc__title">Copilot Clients</h1>
            <p class="cc__sub">
              Register apps that can embed the AI copilot widget. Click a client
              to view integration instructions.
            </p>
          </div>
          <button
            class="cc__btn cc__btn--primary cc__btn--new"
            @click="openSidebar"
          >
            + New Client
          </button>
        </div>
      </div>

      <!-- Sidebar overlay -->
      <Teleport to="body">
        <Transition name="cc-overlay">
          <div v-if="sidebarOpen" class="cc__overlay" @click="closeSidebar" />
        </Transition>
        <Transition name="cc-sidebar">
          <div v-if="sidebarOpen" class="cc__sidebar">
            <div class="cc__sidebar-header">
              <h2 class="cc__sidebar-title">New Client</h2>
              <button class="cc__sidebar-close" @click="closeSidebar">✕</button>
            </div>

            <form class="cc__form" @submit.prevent="handleCreate">
              <div class="cc__field">
                <label class="cc__label"
                  >Name <span class="cc__req">*</span></label
                >
                <input
                  v-model="form.name"
                  class="cc__input"
                  placeholder="My App"
                  required
                />
              </div>
              <div class="cc__field">
                <label class="cc__label"
                  >Client ID <span class="cc__req">*</span></label
                >
                <div class="cc__input-group">
                  <input
                    v-model="form.client_id"
                    class="cc__input"
                    placeholder="my-app"
                    required
                  />
                  <button
                    type="button"
                    class="cc__input-action"
                    @click="generateClientId"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    class="cc__input-action cc__input-action--copy"
                    :class="{
                      'cc__input-action--copied': copiedField === 'client_id',
                    }"
                    :disabled="!form.client_id"
                    @click="copyField('client_id', form.client_id)"
                  >
                    <svg
                      v-if="copiedField !== 'client_id'"
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path
                        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                      />
                    </svg>
                    <span v-else>✓</span>
                  </button>
                </div>
              </div>
              <div class="cc__field">
                <label class="cc__label"
                  >Client Secret <span class="cc__req">*</span></label
                >
                <div class="cc__input-group">
                  <input
                    v-model="form.client_secret"
                    class="cc__input cc__input--mono"
                    placeholder="your-secret-key"
                    required
                  />
                  <button
                    type="button"
                    class="cc__input-action"
                    @click="generateClientSecret"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    class="cc__input-action cc__input-action--copy"
                    :class="{
                      'cc__input-action--copied':
                        copiedField === 'client_secret',
                    }"
                    :disabled="!form.client_secret"
                    @click="copyField('client_secret', form.client_secret)"
                  >
                    <svg
                      v-if="copiedField !== 'client_secret'"
                      xmlns="http://www.w3.org/2000/svg"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path
                        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                      />
                    </svg>
                    <span v-else>✓</span>
                  </button>
                </div>
                <span class="cc__hint"
                  >Stored encrypted — never retrievable in plaintext.</span
                >
              </div>
              <div class="cc__field">
                <label class="cc__label">Allowed Origins</label>
                <input
                  v-model="form.allowed_origins"
                  class="cc__input"
                  placeholder="https://app.example.com, https://other.example.com"
                />
                <span class="cc__hint"
                  >Comma-separated origins allowed to embed the widget. Leave empty to allow all (dev only).</span
                >
              </div>

              <p v-if="formError" class="cc__error">{{ formError }}</p>

              <div class="cc__sidebar-actions">
                <button
                  class="cc__btn cc__btn--primary"
                  type="submit"
                  :disabled="submitting"
                >
                  {{ submitting ? "Creating…" : "Create Client" }}
                </button>
                <button
                  class="cc__btn cc__btn--ghost"
                  type="button"
                  @click="closeSidebar"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Transition>
      </Teleport>

      <!-- Instructions sidebar -->
      <Teleport to="body">
        <Transition name="cc-overlay">
          <div
            v-if="expandedId"
            class="cc__overlay"
            @click="expandedId = null"
          />
        </Transition>
        <Transition name="cc-sidebar">
          <div
            v-if="expandedId && expandedClient"
            class="cc__sidebar cc__sidebar--wide"
          >
            <div class="cc__sidebar-header">
              <div>
                <h2 class="cc__sidebar-title">Integration Guide</h2>
                <p class="cc__sidebar-sub">
                  <code>{{ expandedClient.client_id }}</code>
                  <span v-if="expandedClient.name">
                    · {{ expandedClient.name }}</span
                  >
                </p>
              </div>
              <button class="cc__sidebar-close" @click="expandedId = null">
                ✕
              </button>
            </div>

            <div class="cc__instr-body">
              <p class="cc__instr-intro">
                Follow these steps to embed the AI copilot widget in your web
                app. The <strong>client_secret stays on your server</strong> —
                it never touches the browser.
              </p>

              <div class="cc__step">
                <div class="cc__step-num">
                  Step 1 — Store your client secret
                </div>
                <p class="cc__step-desc">
                  Add your <code>client_secret</code> to your server's
                  environment variables. Never commit it to source control or
                  send it to the browser.
                </p>
                <div class="cc__snippet-wrap">
                  <button
                    class="cc__snippet-copy"
                    @click="copySnippet('env', snippetEnv())"
                  >
                    {{ copiedSnippet === "env" ? "✓ Copied" : "Copy" }}
                  </button>
                  <pre class="cc__snippet"><code>{{ snippetEnv() }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 2 — Install the JWT library</div>
                <p class="cc__step-desc">
                  Your backend needs to sign a short-lived assertion JWT.
                  Install <code>jsonwebtoken</code>:
                </p>
                <div class="cc__snippet-wrap">
                  <button
                    class="cc__snippet-copy"
                    @click="copySnippet('install', snippetInstall())"
                  >
                    {{ copiedSnippet === "install" ? "✓ Copied" : "Copy" }}
                  </button>
                  <pre
                    class="cc__snippet"
                  ><code>{{ snippetInstall() }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">
                  Step 3 — Add a token endpoint to your backend
                </div>
                <p class="cc__step-desc">
                  This endpoint signs an assertion with your
                  <code>client_secret</code>, exchanges it for a Chainlit access
                  token, and returns it to your frontend. Only authenticated
                  users should be able to call it.
                </p>
                <div class="cc__snippet-wrap">
                  <button
                    class="cc__snippet-copy"
                    @click="
                      copySnippet(
                        'be',
                        snippetBackend(expandedClient.client_id),
                      )
                    "
                  >
                    {{ copiedSnippet === "be" ? "✓ Copied" : "Copy" }}
                  </button>
                  <pre
                    class="cc__snippet"
                  ><code>{{ snippetBackend(expandedClient.client_id) }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">
                  Step 4 — Add the widget to your frontend
                </div>
                <p class="cc__step-desc">
                  Paste this into any HTML page. It loads the widget script,
                  fetches the access token from your backend endpoint, and
                  mounts the floating chat button.
                </p>
                <div class="cc__snippet-wrap">
                  <button
                    class="cc__snippet-copy"
                    @click="
                      copySnippet(
                        'fe',
                        snippetFrontend(expandedClient.client_id),
                      )
                    "
                  >
                    {{ copiedSnippet === "fe" ? "✓ Copied" : "Copy" }}
                  </button>
                  <pre
                    class="cc__snippet"
                  ><code>{{ snippetFrontend(expandedClient.client_id) }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 5 — Configure Allowed Origins</div>
                <p class="cc__step-desc">
                  The <strong>Allowed Origins</strong> field on this client controls which domains
                  are permitted to embed the widget. If left empty all origins are allowed —
                  fine for development but not for production.
                </p>
                <p class="cc__step-desc">
                  Set it to the exact origin(s) where your page is hosted. You can update this
                  at any time using the <strong>Edit</strong> button on the client row.
                </p>
                <div class="cc__sf-table">
                  <div class="cc__sf-row"><span class="cc__sf-key">Example</span><code class="cc__sf-val">https://app.mycompany.com</code></div>
                  <div class="cc__sf-row"><span class="cc__sf-key">Multiple</span><code class="cc__sf-val">https://app.mycompany.com, https://staging.mycompany.com</code></div>
                  <div class="cc__sf-row"><span class="cc__sf-key">Local dev</span><code class="cc__sf-val">http://localhost:3000</code></div>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 6 — Test it</div>
                <p class="cc__step-desc">
                  Open your page in a browser. A chat bubble should appear in
                  the bottom-right corner. Click it — you should see the copilot
                  greet you. If the widget does not appear, check the browser
                  console for errors and verify your
                  <code>/copilot-token</code> endpoint returns a valid
                  <code>access_token</code>.
                </p>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Client list -->
      <div class="cc__card">
        <h2 class="cc__card-title">Registered Clients</h2>

        <div v-if="loading" class="cc__empty">Loading…</div>
        <div v-else-if="clients.length === 0" class="cc__empty">
          No clients yet — create one above.
        </div>

        <div v-else class="cc__list">
          <div
            v-for="client in clients"
            :key="client.client_id"
            class="cc__item-wrap"
          >
            <div
              class="cc__item"
              :class="{ 'cc__item--expanded': expandedId === client.client_id }"
            >
              <div class="cc__item-main">
                <span class="cc__client-name">{{
                  client.name || client.client_id
                }}</span>
              </div>

              <div
                v-if="editTarget?.client_id !== client.client_id"
                class="cc__item-actions"
              >
                <button
                  class="cc__icon-btn"
                  title="Integration instructions"
                  @click.stop="toggleExpand(client.client_id)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </button>
                <button
                  class="cc__icon-btn"
                  title="Salesforce integration"
                  @click.stop="sfExpandedId = client.client_id"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
                    />
                  </svg>
                </button>
                <button
                  class="cc__btn cc__btn--ghost"
                  @click.stop="startEdit(client)"
                >
                  Edit
                </button>
                <button
                  class="cc__btn cc__btn--danger"
                  :disabled="deletingId === client.client_id"
                  @click.stop="requestDelete(client)"
                >
                  {{ deletingId === client.client_id ? "…" : "Delete" }}
                </button>
              </div>
              <span v-else class="cc__editing-badge">Editing…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>

  <!-- Salesforce instructions sidebar -->
  <Teleport to="body">
    <Transition name="cc-overlay">
      <div
        v-if="sfExpandedId"
        class="cc__overlay"
        @click="sfExpandedId = null"
      />
    </Transition>
    <Transition name="cc-sidebar">
      <div
        v-if="sfExpandedId && sfExpandedClient"
        class="cc__sidebar cc__sidebar--wide"
      >
        <div class="cc__sidebar-header">
          <div>
            <h2 class="cc__sidebar-title">Salesforce Integration</h2>
            <p class="cc__sidebar-sub">
              {{ sfExpandedClient.client_id
              }}<span v-if="sfExpandedClient.name">
                · {{ sfExpandedClient.name }}</span
              >
            </p>
          </div>
          <button class="cc__sidebar-close" @click="sfExpandedId = null">
            ✕
          </button>
        </div>

        <div class="cc__instr-body">
          <p class="cc__instr-intro">
            Embed the copilot widget in a Salesforce VisualForce page. Apex
            handles the token exchange server-side —
            <strong>client_secret never leaves Salesforce</strong>.
          </p>

          <!-- Origins -->
          <div class="cc__step">
            <div class="cc__step-num">Before you start — Set Allowed Origins for this client</div>
            <p class="cc__step-desc">
              The <strong>Allowed Origins</strong> field on this client must include your Salesforce
              org domain so the widget is permitted to embed on those pages.
              Click <strong>Edit</strong> on the client row and add your org's domains.
              Salesforce orgs typically use several domains — add all that apply:
            </p>
            <div class="cc__sf-table">
              <div class="cc__sf-row cc__sf-row--header"><span class="cc__sf-key">Production</span><span class="cc__sf-val" /></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Lightning Experience</span><code class="cc__sf-val">https://yourorg.lightning.force.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">My Domain</span><code class="cc__sf-val">https://yourorg.my.salesforce.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">VisualForce (modern)</span><code class="cc__sf-val">https://yourorg.vf.force.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">VisualForce (legacy)</span><code class="cc__sf-val">https://yourorg.visualforce.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Experience Cloud</span><code class="cc__sf-val">https://yourorg.my.site.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Salesforce Sites</span><code class="cc__sf-val">https://yourorg.secure.force.com</code></div>
              <div class="cc__sf-row cc__sf-row--header"><span class="cc__sf-key">Sandbox</span><span class="cc__sf-val" /></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Sandbox Lightning</span><code class="cc__sf-val">https://yourorg--sandbox.sandbox.lightning.force.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Sandbox My Domain</span><code class="cc__sf-val">https://yourorg--sandbox.sandbox.my.salesforce.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Sandbox VisualForce</span><code class="cc__sf-val">https://yourorg--sandbox.sandbox.vf.force.com</code></div>
              <div class="cc__sf-row cc__sf-row--header"><span class="cc__sf-key">Developer / Scratch</span><span class="cc__sf-val" /></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Developer Edition</span><code class="cc__sf-val">https://yourorg.develop.lightning.force.com</code></div>
              <div class="cc__sf-row"><span class="cc__sf-key">Scratch Org</span><code class="cc__sf-val">https://yourorg.scratch.lightning.force.com</code></div>
            </div>
            <p class="cc__step-desc" style="margin-top:0.5rem">
              Replace <code>yourorg</code> with your actual org subdomain. To find it:
              <strong>Setup → My Domain → Current My Domain URL</strong>.
              Add all domains that apply — users may access the page from any of them.
            </p>
          </div>

          <!-- Step 1 -->
          <div class="cc__step">
            <div class="cc__step-num">
              Step 1 — Store the client secret as a Protected Custom Label
            </div>
            <p class="cc__step-desc">
              Custom Labels are encrypted at rest and inaccessible to other
              packages. Never store the secret in Apex code or a Custom Setting
              with public visibility.
            </p>
            <div class="cc__snippet-wrap">
              <button
                class="cc__snippet-copy"
                @click="copySnippet('sf-label', snippetSFCustomLabel())"
              >
                {{ copiedSnippet === "sf-label" ? "✓ Copied" : "Copy" }}
              </button>
              <pre
                class="cc__snippet"
              ><code>{{ snippetSFCustomLabel() }}</code></pre>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="cc__step">
            <div class="cc__step-num">Step 2 — Add a Remote Site Setting</div>
            <p class="cc__step-desc">
              Salesforce blocks Apex HTTP callouts to external URLs unless they
              are whitelisted. Go to
              <strong>Setup → Security → Remote Site Settings → New</strong> and
              add:
            </p>
            <div class="cc__sf-table">
              <div class="cc__sf-row">
                <span class="cc__sf-key">Remote Site Name</span
                ><code class="cc__sf-val">CopilotTokenEndpoint</code>
              </div>
              <div class="cc__sf-row">
                <span class="cc__sf-key">Remote Site URL</span
                ><code class="cc__sf-val">{{ origin }}</code>
              </div>
              <div class="cc__sf-row">
                <span class="cc__sf-key">Disable Protocol Security</span
                ><code class="cc__sf-val">No</code>
              </div>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="cc__step">
            <div class="cc__step-num">
              Step 3 — Add Trusted URLs (CSP) for the widget script
            </div>
            <p class="cc__step-desc">
              The browser loads the widget JS from the copilot server.
              Salesforce's Content Security Policy blocks this unless you
              whitelist it. Go to
              <strong>Setup → Security → Trusted URLs → New</strong>:
            </p>
            <div class="cc__sf-table">
              <div class="cc__sf-row">
                <span class="cc__sf-key">Name</span
                ><code class="cc__sf-val">CopilotServer</code>
              </div>
              <div class="cc__sf-row">
                <span class="cc__sf-key">URL</span
                ><code class="cc__sf-val">{{ origin }}</code>
              </div>
              <div class="cc__sf-row">
                <span class="cc__sf-key">CSP Directives</span
                ><code class="cc__sf-val"
                  >✅ script-src &nbsp; ✅ connect-src &nbsp; ✅ frame-src
                  &nbsp; ✅ img-src &nbsp; ✅ style-src</code
                >
              </div>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="cc__step">
            <div class="cc__step-num">Step 4 — Create the Apex Controller</div>
            <p class="cc__step-desc">
              This class signs an assertion JWT using HMAC-SHA256 (Salesforce
              built-in <code>Crypto</code>), exchanges it for a Chainlit access
              token, and exposes it to the VF page via a
              <code>@RemoteAction</code>. It reads the secret from the Protected
              Custom Label you created.
            </p>
            <div class="cc__snippet-wrap">
              <button
                class="cc__snippet-copy"
                @click="
                  copySnippet(
                    'sf-apex',
                    snippetSFApex(sfExpandedClient.client_id),
                  )
                "
              >
                {{ copiedSnippet === "sf-apex" ? "✓ Copied" : "Copy" }}
              </button>
              <pre
                class="cc__snippet"
              ><code>{{ snippetSFApex(sfExpandedClient.client_id) }}</code></pre>
            </div>
          </div>

          <!-- Step 5 -->
          <div class="cc__step">
            <div class="cc__step-num">Step 5 — Create the VisualForce Page</div>
            <p class="cc__step-desc">
              Go to <strong>Setup → VisualForce Pages → New</strong>. This page
              calls the Apex <code>@RemoteAction</code> to get the token, then
              mounts the copilot widget.
            </p>
            <div class="cc__snippet-wrap">
              <button
                class="cc__snippet-copy"
                @click="
                  copySnippet(
                    'sf-vf',
                    snippetSFPage(sfExpandedClient.client_id),
                  )
                "
              >
                {{ copiedSnippet === "sf-vf" ? "✓ Copied" : "Copy" }}
              </button>
              <pre
                class="cc__snippet"
              ><code>{{ snippetSFPage(sfExpandedClient.client_id) }}</code></pre>
            </div>
          </div>

          <!-- Step 6 -->
          <div class="cc__step">
            <div class="cc__step-num">
              Step 6 — Expose the page in Lightning
            </div>
            <p class="cc__step-desc">
              To embed the VF page in a Lightning App or Record Page:
            </p>
            <ol class="cc__step-list">
              <li>
                Open <strong>Lightning App Builder</strong> for the page you
                want.
              </li>
              <li>
                Drag a <strong>Visualforce</strong> standard component onto the
                canvas.
              </li>
              <li>Select your new VF page from the dropdown.</li>
              <li>
                Set the height (e.g. <code>500px</code>) — the widget floats
                inside the iframe.
              </li>
              <li>Save and activate the page.</li>
            </ol>
          </div>

          <!-- Step 7 -->
          <div class="cc__step">
            <div class="cc__step-num">Step 7 — Test it</div>
            <p class="cc__step-desc">
              Open the Lightning page where you added the VF component. The chat
              bubble should appear in the corner. If it does not:
            </p>
            <ol class="cc__step-list">
              <li>
                Open browser DevTools → Console. Check for CSP errors — means a
                Trusted URL is missing.
              </li>
              <li>
                Check for <code>Token exchange failed</code> — means the Remote
                Site Setting is missing or the Custom Label value is wrong.
              </li>
              <li>
                In Salesforce Setup → Debug Logs, enable an Apex log for your
                user to trace the <code>CopilotController</code> callout.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Edit sidebar -->
  <Teleport to="body">
    <Transition name="cc-overlay">
      <div v-if="editSidebarOpen" class="cc__overlay" @click="cancelEdit" />
    </Transition>
    <Transition name="cc-sidebar">
      <div v-if="editSidebarOpen && editTarget" class="cc__sidebar">
        <div class="cc__sidebar-header">
          <div>
            <h2 class="cc__sidebar-title">Edit Client</h2>
            <p class="cc__sidebar-sub">{{ editTarget.client_id }}</p>
          </div>
          <button class="cc__sidebar-close" @click="cancelEdit">✕</button>
        </div>

        <form class="cc__form" @submit.prevent="saveEdit">
          <div class="cc__field">
            <label class="cc__label">Name <span class="cc__req">*</span></label>
            <input
              v-model="editForm.name"
              class="cc__input"
              placeholder="My App"
              required
            />
          </div>
          <div class="cc__field">
            <label class="cc__label"
              >Client ID <span class="cc__req">*</span></label
            >
            <div class="cc__input-group">
              <input
                v-model="editForm.client_id"
                class="cc__input"
                placeholder="my-app"
                required
              />
              <button
                type="button"
                class="cc__input-action cc__input-action--copy"
                :class="{
                  'cc__input-action--copied': copiedField === 'edit_client_id',
                }"
                :disabled="!editForm.client_id"
                @click="copyField('edit_client_id', editForm.client_id)"
              >
                <svg
                  v-if="copiedField !== 'edit_client_id'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  />
                </svg>
                <span v-else>✓</span>
              </button>
            </div>
          </div>
          <div class="cc__field">
            <label class="cc__label">New Client Secret</label>
            <div class="cc__input-group">
              <input
                v-model="editForm.client_secret"
                class="cc__input cc__input--mono"
                placeholder="Leave blank to keep current"
              />
              <button
                type="button"
                class="cc__input-action"
                @click="generateClientSecret"
              >
                Generate
              </button>
              <button
                type="button"
                class="cc__input-action cc__input-action--copy"
                :class="{
                  'cc__input-action--copied': copiedField === 'edit_secret',
                }"
                :disabled="!editForm.client_secret"
                @click="copyField('edit_secret', editForm.client_secret)"
              >
                <svg
                  v-if="copiedField !== 'edit_secret'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  />
                </svg>
                <span v-else>✓</span>
              </button>
            </div>
            <span class="cc__hint"
              >Leave blank to keep the current secret.</span
            >
          </div>
          <div class="cc__field">
            <label class="cc__label">Allowed Origins</label>
            <input
              v-model="editForm.allowed_origins"
              class="cc__input"
              placeholder="https://app.example.com, https://other.example.com"
            />
            <span class="cc__hint"
              >Comma-separated origins allowed to embed the widget. Leave empty to allow all (dev only).</span
            >
          </div>

          <div class="cc__sidebar-actions">
            <button
              class="cc__btn cc__btn--primary"
              type="submit"
              :disabled="savingId"
            >
              {{ savingId ? "Saving…" : "Save Changes" }}
            </button>
            <button
              class="cc__btn cc__btn--ghost"
              type="button"
              @click="cancelEdit"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>

  <!-- Delete confirmation modal -->
  <Teleport to="body">
    <Transition name="cc-overlay">
      <div
        v-if="deleteTarget"
        class="cc__overlay cc__overlay--center"
        @click="cancelDelete"
      >
        <Transition name="cc-modal">
          <div class="cc__modal" @click.stop>
            <h3 class="cc__modal-title">Delete client?</h3>
            <p class="cc__modal-msg">
              <strong>{{ deleteTarget.name || deleteTarget.client_id }}</strong>
              will be permanently removed. Any apps using it will stop working.
            </p>
            <div class="cc__modal-actions">
              <button class="cc__btn cc__btn--danger" @click="confirmDelete">
                Yes, delete
              </button>
              <button class="cc__btn cc__btn--ghost" @click="cancelDelete">
                Cancel
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Toast stack -->
  <Teleport to="body">
    <div class="cc__toasts">
      <TransitionGroup name="cc-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="cc__toast"
          :class="`cc__toast--${toast.type}`"
        >
          <span>{{ toast.message }}</span>
          <button class="cc__toast-close" @click="removeToast(toast.id)">
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.cc {
  width: 100%;
  max-width: 860px;
  animation: cc-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  padding-bottom: 3rem;
}

@keyframes cc-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fade */
.cc-fade-enter-active,
.cc-fade-leave-active {
  transition: opacity 0.2s;
}
.cc-fade-enter-from,
.cc-fade-leave-to {
  opacity: 0;
}

/* Header */
.cc__header {
  margin-bottom: 1.75rem;
}
.cc__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  margin-bottom: 0.4rem;
  line-height: 1;
}
.cc__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
  line-height: 1.6;
}

/* Banner */
.cc__banner {
  background: var(--vz-surface);
  border: 1px solid var(--vz-green, #22c55e);
  border-radius: var(--vz-radius-lg);
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.cc__banner-msg {
  font-size: 0.9rem;
  color: var(--vz-text);
}
.cc__secret-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.cc__secret {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-sm);
  padding: 0.4rem 0.75rem;
  word-break: break-all;
  flex: 1;
}
.cc__copy-btn {
  font-size: 0.8rem;
  padding: 0.35rem 0.9rem;
  border-radius: var(--vz-radius-sm);
  border: 1px solid var(--vz-border2);
  background: var(--vz-surface2);
  color: var(--vz-text);
  cursor: pointer;
  white-space: nowrap;
}
.cc__copy-btn:hover {
  opacity: 0.8;
}
.cc__dismiss {
  font-size: 0.78rem;
  color: var(--vz-text3);
  background: none;
  border: none;
  cursor: pointer;
  align-self: flex-start;
  padding: 0;
}
.cc__dismiss:hover {
  color: var(--vz-text2);
}

/* Card */
.cc__card {
  background: var(--vz-bg);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  padding: 1.5rem;
  margin-bottom: 1.25rem;
}
.cc__card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vz-text);
  margin-bottom: 1.25rem;
}

/* Form */
.cc__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cc__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 600px) {
  .cc__row {
    grid-template-columns: 1fr;
  }
}
.cc__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.cc__label {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3);
}
.cc__req {
  color: var(--vz-red, #e55);
}
.cc__input {
  background: var(--vz-surface);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius);
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: var(--vz-text);
  font-family: var(--vz-font-sans);
  outline: none;
  transition: border-color 0.15s;
}
.cc__input:focus {
  border-color: var(--vz-border2);
}
.cc__input::placeholder {
  color: var(--vz-text3);
}
.cc__input--mono {
  font-family: var(--vz-font-mono);
  font-size: 0.82rem;
}

.cc__input-group {
  display: flex;
  align-items: stretch;
}

.cc__input-group .cc__input {
  border-right: none;
  border-radius: var(--vz-radius) 0 0 var(--vz-radius);
  flex: 1;
}

.cc__input-group .cc__input:focus {
  border-color: var(--vz-border2);
  z-index: 1;
}

.cc__input-action {
  padding: 0 0.85rem;
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  border-radius: 0 var(--vz-radius) var(--vz-radius) 0;
  color: var(--vz-text2);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  flex-shrink: 0;
}

.cc__input-action:hover {
  background: var(--vz-surface3, var(--vz-border));
  color: var(--vz-text);
}

.cc__input-action--copy {
  padding: 0 0.65rem;
  border-left: none;
  border-radius: 0 var(--vz-radius) var(--vz-radius) 0;
}

.cc__input-group .cc__input-action:not(:last-child) {
  border-radius: 0;
  border-right: none;
}

.cc__input-action--copy:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cc__input-action--copied {
  color: var(--vz-green, #22c55e);
}
.cc__hint {
  font-size: 0.75rem;
  color: var(--vz-text3);
}
.cc__error {
  font-size: 0.85rem;
  color: var(--vz-red, #e55);
}

/* Buttons */
.cc__btn {
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.45rem 1rem;
  border-radius: var(--vz-radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    opacity 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.cc__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cc__btn--primary {
  background: var(--vz-green, #22c55e);
  color: #000;
  border-color: var(--vz-green, #22c55e);
  align-self: flex-start;
}
.cc__btn--primary:not(:disabled):hover {
  opacity: 0.85;
}
.cc__btn--ghost {
  background: transparent;
  color: var(--vz-text2);
  border-color: var(--vz-border);
}
.cc__btn--ghost:hover {
  border-color: var(--vz-border2);
  color: var(--vz-text);
}
.cc__btn--danger {
  background: transparent;
  color: var(--vz-text2);
  border-color: var(--vz-border);
}
.cc__btn--danger:not(:disabled):hover {
  border-color: var(--vz-red, #e55);
  color: var(--vz-red, #e55);
}

/* List */
.cc__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--vz-border);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
}
.cc__item-wrap {
  display: flex;
  flex-direction: column;
  background: var(--vz-bg);
}
.cc__item-wrap + .cc__item-wrap {
  border-top: 1px solid var(--vz-border);
}

.cc__item {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: background 0.15s;
}
.cc__item:hover {
  background: var(--vz-surface);
}
.cc__item--editing,
.cc__item--expanded {
  background: var(--vz-surface) !important;
}

.cc__item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cc__editing-badge {
  font-size: 0.75rem;
  font-family: var(--vz-font-mono);
  color: var(--vz-text3);
  letter-spacing: 0.05em;
}

.cc__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--vz-radius-sm);
  border: 1px solid var(--vz-border);
  background: transparent;
  color: var(--vz-text3);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}
.cc__icon-btn:hover {
  border-color: var(--vz-border2);
  color: var(--vz-text);
  background: var(--vz-surface2);
}

.cc__item-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.cc__client-id {
  font-family: var(--vz-font-mono);
  font-size: 0.85rem;
  color: var(--vz-text);
}
.cc__client-name {
  font-size: 0.85rem;
  color: var(--vz-text2);
}
.cc__date {
  font-size: 0.75rem;
  color: var(--vz-text3);
  margin-left: auto;
}
.cc__origins {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding-left: 1.4rem;
}
.cc__origin {
  display: inline-block;
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-sm);
  padding: 0.1rem 0.4rem;
  color: var(--vz-text2);
}
.cc__item-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Edit form */
.cc__edit-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.cc__edit-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cc__instr-intro {
  font-size: 0.85rem;
  color: var(--vz-text2);
  line-height: 1.6;
}
.cc__instr-intro code {
  font-family: var(--vz-font-mono);
  font-size: 0.8rem;
  background: var(--vz-surface2);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.cc__step {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cc__step-num {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vz-text);
}

.cc__step-desc {
  font-size: 0.83rem;
  color: var(--vz-text2);
  line-height: 1.65;
  margin: 0;
}

.cc__step-desc code {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  background: var(--vz-surface2);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.cc__snippet-wrap {
  position: relative;
}

.cc__snippet-copy {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--vz-radius-sm);
  border: 1px solid var(--vz-border2);
  background: var(--vz-surface2);
  color: var(--vz-text2);
  cursor: pointer;
  z-index: 1;
  white-space: nowrap;
  transition: color 0.15s;
}
.cc__snippet-copy:hover {
  color: var(--vz-text);
}

.cc__snippet {
  margin: 0;
  padding: 1rem 1.25rem;
  background: var(--vz-bg);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius);
  overflow-x: auto;
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  line-height: 1.7;
  color: var(--vz-text);
  white-space: pre;
}

.cc__empty {
  font-size: 0.875rem;
  color: var(--vz-text3);
  padding: 0.25rem 0;
}

/* Centered overlay for modal */
.cc__overlay--center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Delete modal */
.cc__modal {
  background: var(--vz-bg);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  padding: 1.75rem;
  width: 360px;
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

.cc-modal-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.cc-modal-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.cc-modal-enter-from,
.cc-modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.cc__modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vz-text);
  margin: 0;
}
.cc__modal-msg {
  font-size: 0.875rem;
  color: var(--vz-text2);
  line-height: 1.6;
  margin: 0;
}
.cc__modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

/* Toast stack */
.cc__toasts {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 200;
  pointer-events: none;
}

.cc__toast {
  pointer-events: all;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--vz-radius);
  border: 1px solid var(--vz-border);
  background: var(--vz-bg);
  font-size: 0.875rem;
  color: var(--vz-text);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  min-width: 240px;
  max-width: 360px;
}

.cc__toast--success {
  border-color: var(--vz-green, #22c55e);
}
.cc__toast--error {
  border-color: var(--vz-red, #e55);
}

.cc__toast-close {
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--vz-text3);
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
  padding: 0;
}
.cc__toast-close:hover {
  color: var(--vz-text);
}

.cc-toast-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.cc-toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.cc-toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.cc-toast-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Header row */
.cc__header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cc__btn--new {
  align-self: flex-start;
  white-space: nowrap;
}

/* Sidebar overlay */
.cc__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
}

.cc-overlay-enter-active,
.cc-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.cc-overlay-enter-from,
.cc-overlay-leave-to {
  opacity: 0;
}

/* Sidebar panel */
.cc__sidebar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  max-width: 100vw;
  background: var(--vz-bg);
  border-left: 1px solid var(--vz-border);
  z-index: 101;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.cc-sidebar-enter-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.cc-sidebar-leave-active {
  transition: transform 0.22s ease;
}
.cc-sidebar-enter-from,
.cc-sidebar-leave-to {
  transform: translateX(100%);
}

.cc__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--vz-border);
  position: sticky;
  top: 0;
  background: var(--vz-bg);
  z-index: 1;
}

.cc__sidebar-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vz-text);
  margin: 0;
}

.cc__sidebar-close {
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--vz-text3);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--vz-radius-sm);
  transition:
    color 0.15s,
    background 0.15s;
  line-height: 1;
}
.cc__sidebar-close:hover {
  color: var(--vz-text);
  background: var(--vz-surface2);
}

.cc__sidebar--wide {
  width: 540px;
}

.cc__sidebar-sub {
  font-size: 0.78rem;
  color: var(--vz-text3);
  margin: 0.2rem 0 0;
  font-family: var(--vz-font-mono);
}

.cc__sidebar .cc__form {
  padding: 1.5rem;
  flex: 1;
}

.cc__sidebar-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Salesforce config table */
.cc__sf-table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--vz-border);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius);
  overflow: hidden;
  margin-top: 0.5rem;
}

.cc__sf-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  background: var(--vz-bg);
  padding: 0.5rem 0.75rem;
}

.cc__sf-row--header {
  background: var(--vz-surface2);
  padding: 0.3rem 0.75rem;
}

.cc__sf-row--header .cc__sf-key {
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
  width: auto;
}

.cc__sf-key {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  color: var(--vz-text3);
  white-space: nowrap;
  width: 160px;
  flex-shrink: 0;
}

.cc__sf-val {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  color: var(--vz-text);
  word-break: break-all;
}

/* Ordered list inside steps */
.cc__step-list {
  margin: 0.5rem 0 0 1.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cc__step-list li {
  font-size: 0.83rem;
  color: var(--vz-text2);
  line-height: 1.6;
}

.cc__step-list li code {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  background: var(--vz-surface2);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

/* Instructions body */
.cc__instr-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}
</style>
