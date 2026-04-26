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

interface Toast { id: number; message: string; type: "success" | "error" }
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

const form = ref({ client_id: "", client_secret: "", name: "", allowed_origins: "" });

const editSidebarOpen = ref(false);
const editTarget = ref<CopilotClient | null>(null);
const editForm = ref({ client_id: "", client_secret: "", name: "", allowed_origins: "" });
const savingId = ref(false);
const deletingId = ref<string | null>(null);
const deleteTarget = ref<CopilotClient | null>(null);

const sidebarOpen = ref(false);
const expandedId = ref<string | null>(null);
const copiedSnippet = ref<string | null>(null);

const copilotServer = computed(() => `${window.location.origin}/copilot`);
const expandedClient = computed(() =>
  clients.value.find((c) => c.client_id === expandedId.value) ?? null,
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
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function snippetFrontend(clientId: string) {
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

// ── Create ────────────────────────────────────────────────────────────────────

function openSidebar() {
  form.value = { client_id: "", client_secret: "", name: "", allowed_origins: "" };
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
      name: form.value.name || undefined,
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
      client_id: editForm.value.client_id || undefined,
      client_secret: editForm.value.client_secret || undefined,
      name: editForm.value.name || undefined,
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
              Register apps that can embed the AI copilot widget. Click a client to view integration instructions.
            </p>
          </div>
          <button class="cc__btn cc__btn--primary cc__btn--new" @click="openSidebar">
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
                <label class="cc__label">Name <span class="cc__req">*</span></label>
                <input v-model="form.name" class="cc__input" placeholder="My App" required />
              </div>
              <div class="cc__field">
                <label class="cc__label">Client ID <span class="cc__req">*</span></label>
                <div class="cc__input-group">
                  <input v-model="form.client_id" class="cc__input" placeholder="my-app" required />
                  <button type="button" class="cc__input-action" @click="generateClientId">Generate</button>
                  <button
                    type="button"
                    class="cc__input-action cc__input-action--copy"
                    :class="{ 'cc__input-action--copied': copiedField === 'client_id' }"
                    :disabled="!form.client_id"
                    @click="copyField('client_id', form.client_id)"
                  >
                    <svg v-if="copiedField !== 'client_id'" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span v-else>✓</span>
                  </button>
                </div>
              </div>
              <div class="cc__field">
                <label class="cc__label">Client Secret <span class="cc__req">*</span></label>
                <div class="cc__input-group">
                  <input
                    v-model="form.client_secret"
                    class="cc__input cc__input--mono"
                    placeholder="your-secret-key"
                    required
                  />
                  <button type="button" class="cc__input-action" @click="generateClientSecret">Generate</button>
                  <button
                    type="button"
                    class="cc__input-action cc__input-action--copy"
                    :class="{ 'cc__input-action--copied': copiedField === 'client_secret' }"
                    :disabled="!form.client_secret"
                    @click="copyField('client_secret', form.client_secret)"
                  >
                    <svg v-if="copiedField !== 'client_secret'" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span v-else>✓</span>
                  </button>
                </div>
                <span class="cc__hint">Stored encrypted — never retrievable in plaintext.</span>
              </div>
              <div class="cc__field">
                <label class="cc__label">Allowed Origins</label>
                <input
                  v-model="form.allowed_origins"
                  class="cc__input"
                  placeholder="https://app.example.com, https://other.example.com"
                />
                <span class="cc__hint">Comma-separated. Leave empty to allow all.</span>
              </div>

              <p v-if="formError" class="cc__error">{{ formError }}</p>

              <div class="cc__sidebar-actions">
                <button class="cc__btn cc__btn--primary" type="submit" :disabled="submitting">
                  {{ submitting ? "Creating…" : "Create Client" }}
                </button>
                <button class="cc__btn cc__btn--ghost" type="button" @click="closeSidebar">
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
          <div v-if="expandedId" class="cc__overlay" @click="expandedId = null" />
        </Transition>
        <Transition name="cc-sidebar">
          <div v-if="expandedId && expandedClient" class="cc__sidebar cc__sidebar--wide">
            <div class="cc__sidebar-header">
              <div>
                <h2 class="cc__sidebar-title">Integration Guide</h2>
                <p class="cc__sidebar-sub">
                  <code>{{ expandedClient.client_id }}</code>
                  <span v-if="expandedClient.name"> · {{ expandedClient.name }}</span>
                </p>
              </div>
              <button class="cc__sidebar-close" @click="expandedId = null">✕</button>
            </div>

            <div class="cc__instr-body">
              <p class="cc__instr-intro">
                Follow these steps to embed the AI copilot widget in your web app.
                The <strong>client_secret stays on your server</strong> — it never touches the browser.
              </p>

              <div class="cc__step">
                <div class="cc__step-num">Step 1 — Store your client secret</div>
                <p class="cc__step-desc">
                  Add your <code>client_secret</code> to your server's environment variables.
                  Never commit it to source control or send it to the browser.
                </p>
                <div class="cc__snippet-wrap">
                  <button class="cc__snippet-copy" @click="copySnippet('env', snippetEnv())">
                    {{ copiedSnippet === 'env' ? '✓ Copied' : 'Copy' }}
                  </button>
                  <pre class="cc__snippet"><code>{{ snippetEnv() }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 2 — Install the JWT library</div>
                <p class="cc__step-desc">
                  Your backend needs to sign a short-lived assertion JWT. Install <code>jsonwebtoken</code>:
                </p>
                <div class="cc__snippet-wrap">
                  <button class="cc__snippet-copy" @click="copySnippet('install', snippetInstall())">
                    {{ copiedSnippet === 'install' ? '✓ Copied' : 'Copy' }}
                  </button>
                  <pre class="cc__snippet"><code>{{ snippetInstall() }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 3 — Add a token endpoint to your backend</div>
                <p class="cc__step-desc">
                  This endpoint signs an assertion with your <code>client_secret</code>, exchanges it
                  for a Chainlit access token, and returns it to your frontend.
                  Only authenticated users should be able to call it.
                </p>
                <div class="cc__snippet-wrap">
                  <button class="cc__snippet-copy" @click="copySnippet('be', snippetBackend(expandedClient.client_id))">
                    {{ copiedSnippet === 'be' ? '✓ Copied' : 'Copy' }}
                  </button>
                  <pre class="cc__snippet"><code>{{ snippetBackend(expandedClient.client_id) }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 4 — Add the widget to your frontend</div>
                <p class="cc__step-desc">
                  Paste this into any HTML page. It loads the widget script, fetches the access token
                  from your backend endpoint, and mounts the floating chat button.
                </p>
                <div class="cc__snippet-wrap">
                  <button class="cc__snippet-copy" @click="copySnippet('fe', snippetFrontend(expandedClient.client_id))">
                    {{ copiedSnippet === 'fe' ? '✓ Copied' : 'Copy' }}
                  </button>
                  <pre class="cc__snippet"><code>{{ snippetFrontend(expandedClient.client_id) }}</code></pre>
                </div>
              </div>

              <div class="cc__step">
                <div class="cc__step-num">Step 5 — Test it</div>
                <p class="cc__step-desc">
                  Open your page in a browser. A chat bubble should appear in the bottom-right corner.
                  Click it — you should see the copilot greet you. If the widget does not appear,
                  check the browser console for errors and verify your <code>/copilot-token</code>
                  endpoint returns a valid <code>access_token</code>.
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
            <div class="cc__item" :class="{ 'cc__item--expanded': expandedId === client.client_id }">
              <div class="cc__item-main">
                <span class="cc__client-name">{{ client.name || client.client_id }}</span>
              </div>

              <div v-if="editTarget?.client_id !== client.client_id" class="cc__item-actions">
                <button class="cc__icon-btn" title="Integration instructions" @click.stop="toggleExpand(client.client_id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </button>
                <button class="cc__btn cc__btn--ghost" @click.stop="startEdit(client)">Edit</button>
                <button class="cc__btn cc__btn--danger" :disabled="deletingId === client.client_id" @click.stop="requestDelete(client)">
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
            <input v-model="editForm.name" class="cc__input" placeholder="My App" required />
          </div>
          <div class="cc__field">
            <label class="cc__label">Client ID <span class="cc__req">*</span></label>
            <div class="cc__input-group">
              <input v-model="editForm.client_id" class="cc__input" placeholder="my-app" required />
              <button type="button" class="cc__input-action cc__input-action--copy"
                :class="{ 'cc__input-action--copied': copiedField === 'edit_client_id' }"
                :disabled="!editForm.client_id"
                @click="copyField('edit_client_id', editForm.client_id)">
                <svg v-if="copiedField !== 'edit_client_id'" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span v-else>✓</span>
              </button>
            </div>
          </div>
          <div class="cc__field">
            <label class="cc__label">New Client Secret</label>
            <div class="cc__input-group">
              <input v-model="editForm.client_secret" class="cc__input cc__input--mono" placeholder="Leave blank to keep current" />
              <button type="button" class="cc__input-action" @click="generateClientSecret">Generate</button>
              <button type="button" class="cc__input-action cc__input-action--copy"
                :class="{ 'cc__input-action--copied': copiedField === 'edit_secret' }"
                :disabled="!editForm.client_secret"
                @click="copyField('edit_secret', editForm.client_secret)">
                <svg v-if="copiedField !== 'edit_secret'" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span v-else>✓</span>
              </button>
            </div>
            <span class="cc__hint">Leave blank to keep the current secret.</span>
          </div>
          <div class="cc__field">
            <label class="cc__label">Allowed Origins</label>
            <input v-model="editForm.allowed_origins" class="cc__input" placeholder="https://app.example.com, https://other.example.com" />
            <span class="cc__hint">Comma-separated. Leave empty to allow all.</span>
          </div>

          <div class="cc__sidebar-actions">
            <button class="cc__btn cc__btn--primary" type="submit" :disabled="savingId">
              {{ savingId ? "Saving…" : "Save Changes" }}
            </button>
            <button class="cc__btn cc__btn--ghost" type="button" @click="cancelEdit">Cancel</button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>

  <!-- Delete confirmation modal -->
  <Teleport to="body">
    <Transition name="cc-overlay">
      <div v-if="deleteTarget" class="cc__overlay cc__overlay--center" @click="cancelDelete">
        <Transition name="cc-modal">
          <div class="cc__modal" @click.stop>
            <h3 class="cc__modal-title">Delete client?</h3>
            <p class="cc__modal-msg">
              <strong>{{ deleteTarget.name || deleteTarget.client_id }}</strong> will be permanently removed.
              Any apps using it will stop working.
            </p>
            <div class="cc__modal-actions">
              <button class="cc__btn cc__btn--danger" @click="confirmDelete">Yes, delete</button>
              <button class="cc__btn cc__btn--ghost" @click="cancelDelete">Cancel</button>
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
          <button class="cc__toast-close" @click="removeToast(toast.id)">✕</button>
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
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Fade */
.cc-fade-enter-active, .cc-fade-leave-active { transition: opacity 0.2s; }
.cc-fade-enter-from, .cc-fade-leave-to { opacity: 0; }


/* Header */
.cc__header { margin-bottom: 1.75rem; }
.cc__title { font-size: 2rem; font-weight: 600; letter-spacing: -0.03em; color: var(--vz-text); margin-bottom: 0.4rem; line-height: 1; }
.cc__sub { font-size: 0.92rem; color: var(--vz-text2); line-height: 1.6; }

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
.cc__banner-msg { font-size: 0.9rem; color: var(--vz-text); }
.cc__secret-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
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
.cc__copy-btn:hover { opacity: 0.8; }
.cc__dismiss { font-size: 0.78rem; color: var(--vz-text3); background: none; border: none; cursor: pointer; align-self: flex-start; padding: 0; }
.cc__dismiss:hover { color: var(--vz-text2); }

/* Card */
.cc__card { background: var(--vz-bg); border: 1px solid var(--vz-border); border-radius: var(--vz-radius-lg); padding: 1.5rem; margin-bottom: 1.25rem; }
.cc__card-title { font-size: 1rem; font-weight: 600; color: var(--vz-text); margin-bottom: 1.25rem; }

/* Form */
.cc__form { display: flex; flex-direction: column; gap: 1rem; }
.cc__row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 600px) { .cc__row { grid-template-columns: 1fr; } }
.cc__field { display: flex; flex-direction: column; gap: 0.35rem; }
.cc__label { font-family: var(--vz-font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--vz-text3); }
.cc__req { color: var(--vz-red, #e55); }
.cc__input { background: var(--vz-surface); border: 1px solid var(--vz-border); border-radius: var(--vz-radius); padding: 0.5rem 0.75rem; font-size: 0.9rem; color: var(--vz-text); font-family: var(--vz-font-sans); outline: none; transition: border-color 0.15s; }
.cc__input:focus { border-color: var(--vz-border2); }
.cc__input::placeholder { color: var(--vz-text3); }
.cc__input--mono { font-family: var(--vz-font-mono); font-size: 0.82rem; }

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
  transition: background 0.15s, color 0.15s;
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
.cc__hint { font-size: 0.75rem; color: var(--vz-text3); }
.cc__error { font-size: 0.85rem; color: var(--vz-red, #e55); }

/* Buttons */
.cc__btn { font-size: 0.875rem; font-weight: 500; padding: 0.45rem 1rem; border-radius: var(--vz-radius); border: 1px solid transparent; cursor: pointer; transition: opacity 0.15s, border-color 0.15s, color 0.15s; }
.cc__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cc__btn--primary { background: var(--vz-green, #22c55e); color: #000; border-color: var(--vz-green, #22c55e); align-self: flex-start; }
.cc__btn--primary:not(:disabled):hover { opacity: 0.85; }
.cc__btn--ghost { background: transparent; color: var(--vz-text2); border-color: var(--vz-border); }
.cc__btn--ghost:hover { border-color: var(--vz-border2); color: var(--vz-text); }
.cc__btn--danger { background: transparent; color: var(--vz-text2); border-color: var(--vz-border); }
.cc__btn--danger:not(:disabled):hover { border-color: var(--vz-red, #e55); color: var(--vz-red, #e55); }

/* List */
.cc__list { display: flex; flex-direction: column; gap: 1px; background: var(--vz-border); border: 1px solid var(--vz-border); border-radius: var(--vz-radius-lg); overflow: hidden; }
.cc__item-wrap { display: flex; flex-direction: column; background: var(--vz-bg); }
.cc__item-wrap + .cc__item-wrap { border-top: 1px solid var(--vz-border); }

.cc__item {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: background 0.15s;
}
.cc__item:hover { background: var(--vz-surface); }
.cc__item--editing, .cc__item--expanded { background: var(--vz-surface) !important; }

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
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.cc__icon-btn:hover {
  border-color: var(--vz-border2);
  color: var(--vz-text);
  background: var(--vz-surface2);
}

.cc__item-top { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }


.cc__client-id { font-family: var(--vz-font-mono); font-size: 0.85rem; color: var(--vz-text); }
.cc__client-name { font-size: 0.85rem; color: var(--vz-text2); }
.cc__date { font-size: 0.75rem; color: var(--vz-text3); margin-left: auto; }
.cc__origins { display: flex; flex-wrap: wrap; gap: 0.35rem; padding-left: 1.4rem; }
.cc__origin { display: inline-block; font-family: var(--vz-font-mono); font-size: 0.7rem; background: var(--vz-surface2); border: 1px solid var(--vz-border); border-radius: var(--vz-radius-sm); padding: 0.1rem 0.4rem; color: var(--vz-text2); }
.cc__item-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

/* Edit form */
.cc__edit-form { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
.cc__edit-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.cc__instr-intro {
  font-size: 0.85rem;
  color: var(--vz-text2);
  line-height: 1.6;
}
.cc__instr-intro code { font-family: var(--vz-font-mono); font-size: 0.8rem; background: var(--vz-surface2); padding: 0.1rem 0.3rem; border-radius: 3px; }

.cc__step { display: flex; flex-direction: column; gap: 0.5rem; }

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

.cc__snippet-wrap { position: relative; }

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
.cc__snippet-copy:hover { color: var(--vz-text); }

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

.cc__empty { font-size: 0.875rem; color: var(--vz-text3); padding: 0.25rem 0; }

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
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
}

.cc-modal-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16,1,0.3,1); }
.cc-modal-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.cc-modal-enter-from, .cc-modal-leave-to { opacity: 0; transform: scale(0.95); }

.cc__modal-title { font-size: 1rem; font-weight: 600; color: var(--vz-text); margin: 0; }
.cc__modal-msg { font-size: 0.875rem; color: var(--vz-text2); line-height: 1.6; margin: 0; }
.cc__modal-actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }

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
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
  min-width: 240px;
  max-width: 360px;
}

.cc__toast--success { border-color: var(--vz-green, #22c55e); }
.cc__toast--error   { border-color: var(--vz-red, #e55); }

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
.cc__toast-close:hover { color: var(--vz-text); }

.cc-toast-enter-active { transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1); }
.cc-toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.cc-toast-enter-from   { opacity: 0; transform: translateY(8px); }
.cc-toast-leave-to     { opacity: 0; transform: translateY(4px); }

/* Header row */
.cc__header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cc__btn--new { align-self: flex-start; white-space: nowrap; }

/* Sidebar overlay */
.cc__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
}

.cc-overlay-enter-active, .cc-overlay-leave-active { transition: opacity 0.25s ease; }
.cc-overlay-enter-from, .cc-overlay-leave-to { opacity: 0; }

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

.cc-sidebar-enter-active { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.cc-sidebar-leave-active  { transition: transform 0.22s ease; }
.cc-sidebar-enter-from, .cc-sidebar-leave-to { transform: translateX(100%); }

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
  transition: color 0.15s, background 0.15s;
  line-height: 1;
}
.cc__sidebar-close:hover { color: var(--vz-text); background: var(--vz-surface2); }

.cc__sidebar--wide { width: 540px; }

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

/* Instructions body */
.cc__instr-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}
</style>
