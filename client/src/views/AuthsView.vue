<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout, AuthCard, Button } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import { getPortals, type Portal } from "../api/portals";
import { getSfFrontdoorUrl, type FrontdoorLog } from "../api/salesforceExchange";

const router = useRouter();
const auth = useAuthStore();
const portals = ref<Portal[]>([]);
const launching = ref<string | null>(null);
const selectedClientId = ref<Record<string, string>>({});

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}

async function launch(portal: Portal) {
  if (portal.disabled) return;
  if (portal.protocol === "token-exchange") {
    const clientId = selectedClientId.value[portal.id];
    if (clientId) await openLogModal(clientId);
    return;
  }
  if (!portal.external && portal.launchUrl) {
    router.push(portal.launchUrl);
    return;
  }
  launching.value = portal.id;
  try {
    if (portal.launchUrl) {
      window.open(portal.launchUrl, "_blank", "noopener,noreferrer");
    }
  } finally {
    launching.value = null;
  }
}

onMounted(async () => {
  portals.value = await getPortals();
  // Pre-select first client for each token-exchange portal
  portals.value.forEach((p) => {
    if (p.protocol === "token-exchange" && p.clients?.length) {
      selectedClientId.value[p.id] = p.clients[0].id;
    }
  });
});

// ── Log modal ─────────────────────────────────────────────────────────────────

interface LogModal {
  open: boolean;
  loading: boolean;
  visibleLines: FrontdoorLog[];
  url: string | null;
  error: string | null;
}

const logModal = ref<LogModal>({
  open: false,
  loading: false,
  visibleLines: [],
  url: null,
  error: null,
});

async function openLogModal(clientId: string) {
  logModal.value = { open: true, loading: true, visibleLines: [], url: null, error: null };

  try {
    const result = await getSfFrontdoorUrl(clientId);
    logModal.value.loading = false;

    // Stagger log lines for a live-replay effect
    for (let i = 0; i < result.logs.length; i++) {
      await new Promise((r) => setTimeout(r, 130));
      logModal.value.visibleLines = result.logs.slice(0, i + 1);
    }

    logModal.value.url = result.url;
  } catch (err) {
    logModal.value.loading = false;
    logModal.value.error =
      err instanceof Error ? err.message : "Token exchange failed";
  }
}

function closeLogModal() {
  logModal.value.open = false;
}

function openSalesforce() {
  if (logModal.value.url) {
    window.open(logModal.value.url, "_blank", "noopener,noreferrer");
    closeLogModal();
  }
}

function iconFor(status: FrontdoorLog["status"]) {
  if (status === "ok") return "✓";
  if (status === "cached") return "↻";
  return "→";
}
</script>

<template>
  <AppLayout
    active-page="auths"
    :is-owner="auth.isOwner"
    :is-authenticated="auth.isAuthenticated"
    :user-name="auth.fullName"
    :user-email="auth.email"
    @profile="router.push({ name: 'profile' })"
    :scrollable="true"
    @logout="handleLogout"
  >
    <div class="vz-auths">
      <div class="vz-auths__section-header">
        <h1 class="vz-auths__title">Integrations</h1>
        <p class="vz-auths__sub">
          Configured authentication integrations and their entry points.
        </p>
      </div>

      <div class="vz-auths__grid">
        <AuthCard
          v-for="portal in portals"
          :key="portal.id"
          :title="portal.name"
          :description="portal.description"
          :protocol="portal.protocol"
          :status="portal.disabled ? 'inactive' : 'active'"
          :class="{ 'vz-auth-card--disabled': portal.disabled }"
        >
          <template #action>
            <!-- Disabled: coming soon label -->
            <span v-if="portal.disabled" class="vz-coming-soon">Coming soon</span>

            <!-- Token Exchange: client selector + launch -->
            <div v-else-if="portal.protocol === 'token-exchange'" class="vz-te-action">
              <select
                v-if="(portal.clients?.length ?? 0) > 1"
                v-model="selectedClientId[portal.id]"
                class="vz-te-select"
              >
                <option
                  v-for="c in portal.clients"
                  :key="c.id"
                  :value="c.id"
                >{{ c.label }}</option>
              </select>
              <Button
                variant="ghost"
                :loading="logModal.open && logModal.loading"
                @click="launch(portal)"
              >
                Login ↗
              </Button>
            </div>

            <!-- Normal launch -->
            <Button
              v-else
              variant="ghost"
              :loading="launching === portal.id"
              @click="launch(portal)"
            >
              {{ portal.name }} ↗
            </Button>
          </template>
        </AuthCard>
      </div>
    </div>
  </AppLayout>

  <!-- Token Exchange log modal -->
  <Teleport to="body">
    <Transition name="sf-fade">
      <div v-if="logModal.open" class="sf-overlay" @click.self="closeLogModal">
        <div class="sf-modal">
          <div class="sf-modal__header">
            <span class="sf-modal__title">Salesforce Login · Token Exchange</span>
            <button class="sf-modal__close" @click="closeLogModal">✕</button>
          </div>

          <div class="sf-modal__body">
            <!-- Pending spinner -->
            <div v-if="logModal.loading" class="sf-log-line sf-log-line--pending">
              <span class="sf-spinner">◌</span>
              <span>Connecting to Salesforce...</span>
            </div>

            <!-- Replayed log entries -->
            <TransitionGroup name="sf-line">
              <div
                v-for="(entry, i) in logModal.visibleLines"
                :key="i"
                class="sf-log-line"
                :class="`sf-log-line--${entry.status}`"
              >
                <span class="sf-log-icon">{{ iconFor(entry.status) }}</span>
                <span>{{ entry.step }}</span>
              </div>
            </TransitionGroup>

            <!-- Error -->
            <div v-if="logModal.error" class="sf-log-line sf-log-line--error">
              <span class="sf-log-icon">✗</span>
              <span>{{ logModal.error }}</span>
            </div>
          </div>

          <div v-if="logModal.url" class="sf-modal__footer">
            <button class="sf-btn-open" @click="openSalesforce">
              Open Salesforce ↗
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.vz-auths {
  width: 100%;
  max-width: 720px;
  animation: vz-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  padding-bottom: 2rem;
}

@keyframes vz-rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.vz-auths__section-header { margin-bottom: 1.5rem; }

.vz-auths__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  margin-bottom: 0.4rem;
  line-height: 1;
}

.vz-auths__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
  line-height: 1.6;
}

.vz-auths__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.vz-auths__grid :deep(.vz-auth-card) {
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-md);
  padding: 0.75rem 1rem;
  gap: 0.35rem;
}

.vz-auths__grid :deep(.vz-auth-card__title) { font-size: 0.875rem; }

.vz-auths__grid :deep(.vz-auth-card__desc) {
  font-size: 0.78rem;
  line-height: 1.5;
}

.vz-auths__grid :deep(.vz-auth-card__action) { margin-top: 0.25rem; }

/* Disabled tiles */
.vz-auths__grid :deep(.vz-auth-card.vz-auth-card--disabled) {
  opacity: 0.45;
  pointer-events: none;
  user-select: none;
}

.vz-coming-soon {
  font-family: var(--vz-font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3);
}

/* Token Exchange action row: select + button */
.vz-te-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vz-te-select {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
  font-family: var(--vz-font-mono);
  color: var(--vz-text);
  background: var(--vz-surface);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-sm);
  padding: 0.25rem 0.4rem;
  cursor: pointer;
  outline: none;
}
.vz-te-select:focus { border-color: var(--vz-border2); }

@media (max-width: 680px) {
  .vz-auths__grid { grid-template-columns: 1fr; }
}

/* ── Log modal ──────────────────────────────────────────────────────────────── */

.sf-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sf-modal {
  background: #0b1120;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  width: 420px;
  max-width: 94vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  font-family: ui-monospace, 'SF Mono', 'Fira Code', monospace;
}

.sf-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sf-modal__title {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.sf-modal__close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.15rem 0.3rem;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.sf-modal__close:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.07);
}

.sf-modal__body {
  padding: 1rem;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.sf-log-line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.78rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.55);
}

.sf-log-icon {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  font-size: 0.75rem;
}

.sf-log-line--ok    .sf-log-icon { color: #4ade80; }
.sf-log-line--ok                  { color: rgba(255, 255, 255, 0.75); }
.sf-log-line--cached .sf-log-icon { color: #fbbf24; }
.sf-log-line--cached               { color: rgba(255, 255, 255, 0.6); }
.sf-log-line--info  .sf-log-icon  { color: #60a5fa; }
.sf-log-line--error .sf-log-icon  { color: #f87171; }
.sf-log-line--error                { color: #f87171; }
.sf-log-line--pending              { color: rgba(255, 255, 255, 0.35); }

.sf-spinner {
  display: inline-block;
  animation: sf-spin 1.2s linear infinite;
  font-size: 0.8rem;
  color: #60a5fa;
}

@keyframes sf-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.sf-modal__footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  justify-content: flex-end;
}

.sf-btn-open {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 1.1rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.sf-btn-open:hover { background: #2563eb; }

/* Modal enter/leave */
.sf-fade-enter-active, .sf-fade-leave-active { transition: opacity 0.2s; }
.sf-fade-enter-from,   .sf-fade-leave-to     { opacity: 0; }

/* Log line enter */
.sf-line-enter-active { transition: opacity 0.18s, transform 0.18s; }
.sf-line-enter-from   { opacity: 0; transform: translateX(-6px); }
</style>
