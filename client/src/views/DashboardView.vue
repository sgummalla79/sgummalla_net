<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import {
  fetchNeonUsage,
  fetchFlyUsage,
  type NeonUsage,
  type FlyUsage,
} from "../api/usage";

const router = useRouter();
const auth = useAuthStore();

const neon = ref<NeonUsage | null>(null);
const fly = ref<FlyUsage | null>(null);
const neonError = ref<string | null>(null);
const flyError = ref<string | null>(null);
const neonLoading = ref(true);
const flyLoading = ref(true);
const lastUpdated = ref<Date | null>(null);

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}

function fmt(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function load() {
  neonLoading.value = true;
  flyLoading.value = true;
  neonError.value = null;
  flyError.value = null;

  const [neonResult, flyResult] = await Promise.allSettled([
    fetchNeonUsage(),
    fetchFlyUsage(),
  ]);

  if (neonResult.status === "fulfilled") {
    neon.value = neonResult.value;
  } else {
    neonError.value =
      neonResult.reason instanceof Error
        ? neonResult.reason.message
        : "Failed to load";
  }

  if (flyResult.status === "fulfilled") {
    fly.value = flyResult.value;
  } else {
    flyError.value =
      flyResult.reason instanceof Error
        ? flyResult.reason.message
        : "Failed to load";
  }

  neonLoading.value = false;
  flyLoading.value = false;
  lastUpdated.value = new Date();
}

onMounted(load);
</script>

<template>
  <AppLayout
    active-page=""
    :is-owner="auth.isOwner"
    :is-authenticated="auth.isAuthenticated"
    :user-name="auth.fullName"
    :user-email="auth.email"
    :debug-mode="auth.debugMode"
    :scrollable="true"
    @logout="handleLogout"
    @profile="router.push({ name: 'profile' })"
    @toggle-debug="auth.toggleDebugMode"
    @usage="router.push({ name: 'dashboard' })"
  >
    <div class="vz-dash">
      <!-- Header -->
      <div class="vz-dash__header">
        <div>
          <h1 class="vz-dash__title">Usage Dashboard</h1>
          <p class="vz-dash__sub">Infrastructure usage for sgummalla.net</p>
        </div>
        <div class="vz-dash__actions">
          <p v-if="lastUpdated" class="vz-dash__updated">
            Updated {{ lastUpdated.toLocaleTimeString() }}
          </p>
          <button class="vz-dash__refresh" @click="load">
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
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div class="vz-dash__grid">
        <!-- ── NeonDB ──────────────────────────────────────────────── -->
        <div class="vz-dash__panel">
          <div class="vz-dash__panel-header">
            <div class="vz-dash__panel-title-row">
              <svg
                class="vz-dash__panel-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                style="color: #00e5a0"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
                />
                <path d="M11 7h2v6h-2zm0 8h2v2h-2z" />
              </svg>
              <span class="vz-dash__panel-title">NeonDB</span>
              <span class="vz-dash__panel-badge">Free Tier</span>
            </div>
            <p class="vz-dash__panel-sub">PostgreSQL storage — 512 MB limit</p>
          </div>

          <div v-if="neonLoading" class="vz-dash__loading">Loading…</div>
          <div v-else-if="neonError" class="vz-dash__error">
            {{ neonError }}
          </div>
          <template v-else-if="neon">
            <!-- Storage bar -->
            <div class="vz-dash__section">
              <div class="vz-dash__bar-header">
                <span class="vz-dash__bar-label">Total storage used</span>
                <span class="vz-dash__bar-value">
                  {{ fmt(neon.usedBytes) }} / {{ fmt(neon.limitBytes) }}
                </span>
              </div>
              <div class="vz-dash__bar-track">
                <div
                  class="vz-dash__bar-fill"
                  :class="
                    neon.usedPercent > 80 ? 'vz-dash__bar-fill--warn' : ''
                  "
                  :style="{ width: `${Math.min(neon.usedPercent, 100)}%` }"
                />
              </div>
              <p class="vz-dash__bar-pct">{{ neon.usedPercent }}% used</p>
            </div>

            <!-- Table breakdown -->
            <div class="vz-dash__section">
              <p class="vz-dash__section-title">Storage per table</p>
              <table class="vz-dash__table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th class="vz-dash__table-right">Total</th>
                    <th class="vz-dash__table-right">Data</th>
                    <th class="vz-dash__table-right">Indexes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in neon.tables" :key="t.name">
                    <td class="vz-dash__table-name">{{ t.name }}</td>
                    <td class="vz-dash__table-right">
                      {{ fmt(t.totalBytes) }}
                    </td>
                    <td class="vz-dash__table-right vz-dash__table-dim">
                      {{ fmt(t.tableBytes) }}
                    </td>
                    <td class="vz-dash__table-right vz-dash__table-dim">
                      {{ fmt(t.indexBytes) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- ── Fly.io ──────────────────────────────────────────────── -->
        <div class="vz-dash__panel">
          <div class="vz-dash__panel-header">
            <div class="vz-dash__panel-title-row">
              <svg
                class="vz-dash__panel-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                style="color: #8b5cf6"
              >
                <path
                  d="M21 16.5c0 2.485-4.03 4.5-9 4.5s-9-2.015-9-4.5V12c0 2.485 4.03 4.5 9 4.5s9-2.015 9-4.5v4.5z"
                />
                <path
                  d="M21 12c0 2.485-4.03 4.5-9 4.5S3 14.485 3 12V7.5C3 5.015 7.03 3 12 3s9 2.015 9 4.5V12z"
                />
              </svg>
              <span class="vz-dash__panel-title">Fly.io</span>
              <span class="vz-dash__panel-badge">{{
                fly?.app ?? "sgummalla-net"
              }}</span>
            </div>
            <p class="vz-dash__panel-sub">
              Machine metrics — last 5 min / 24 h
            </p>
          </div>

          <div v-if="flyLoading" class="vz-dash__loading">Loading…</div>
          <div v-else-if="flyError" class="vz-dash__error">{{ flyError }}</div>
          <template v-else-if="fly">
            <!-- Metric tiles -->
            <div class="vz-dash__tiles">
              <div class="vz-dash__tile">
                <p class="vz-dash__tile-label">CPU (user)</p>
                <p class="vz-dash__tile-value">
                  {{
                    fly.cpu.userPercent !== null
                      ? `${fly.cpu.userPercent}%`
                      : "—"
                  }}
                </p>
                <p class="vz-dash__tile-sub">last 5 min avg</p>
              </div>
              <div class="vz-dash__tile">
                <p class="vz-dash__tile-label">Memory</p>
                <p class="vz-dash__tile-value">
                  {{
                    fly.memory.usedBytes !== null
                      ? fmt(fly.memory.usedBytes)
                      : "—"
                  }}
                </p>
                <p class="vz-dash__tile-sub">
                  of
                  {{
                    fly.memory.totalBytes !== null
                      ? fmt(fly.memory.totalBytes)
                      : "—"
                  }}
                </p>
              </div>
              <div class="vz-dash__tile">
                <p class="vz-dash__tile-label">Network ↑</p>
                <p class="vz-dash__tile-value">
                  {{
                    fly.network.sentBytes24h !== null
                      ? fmt(fly.network.sentBytes24h)
                      : "—"
                  }}
                </p>
                <p class="vz-dash__tile-sub">sent — 24 h</p>
              </div>
              <div class="vz-dash__tile">
                <p class="vz-dash__tile-label">Network ↓</p>
                <p class="vz-dash__tile-value">
                  {{
                    fly.network.recvBytes24h !== null
                      ? fmt(fly.network.recvBytes24h)
                      : "—"
                  }}
                </p>
                <p class="vz-dash__tile-sub">received — 24 h</p>
              </div>
              <div class="vz-dash__tile">
                <p class="vz-dash__tile-label">HTTP requests</p>
                <p class="vz-dash__tile-value">
                  {{ fmtNum(fly.http.requests24h) }}
                </p>
                <p class="vz-dash__tile-sub">last 24 h</p>
              </div>
            </div>

            <!-- Billing link -->
            <div class="vz-dash__section">
              <p class="vz-dash__billing-note">
                Dollar costs are not available via the Fly.io API.
              </p>
              <a
                :href="fly.billingUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="vz-dash__billing-link"
              >
                View billing on Fly.io
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <path
                    d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                  />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </template>
        </div>

        <!-- ── MongoDB Atlas placeholder ──────────────────────────── -->
        <div class="vz-dash__panel vz-dash__panel--muted">
          <div class="vz-dash__panel-header">
            <div class="vz-dash__panel-title-row">
              <svg
                class="vz-dash__panel-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                style="color: #00ed64"
              >
                <path
                  d="M12 2C7.03 2 3 6.03 3 11c0 3.87 2.28 7.2 5.56 8.74L12 22l3.44-2.26C18.72 18.2 21 14.87 21 11c0-4.97-4.03-9-9-9zm0 16.5l-2.5-1.64C7.38 15.73 6 13.46 6 11c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.46-1.38 4.73-3.5 5.86L12 18.5z"
                />
              </svg>
              <span class="vz-dash__panel-title">MongoDB Atlas</span>
              <span class="vz-dash__panel-badge vz-dash__panel-badge--dim"
                >Coming soon</span
              >
            </div>
            <p class="vz-dash__panel-sub">
              Logging database — configure when ready
            </p>
          </div>
          <div class="vz-dash__placeholder">
            Storage, compute, and billing data will appear here once the logging
            database is connected.
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-dash {
  width: 100%;
  max-width: 1100px;
  animation: vz-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes vz-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Header ── */
.vz-dash__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--vz-border);
  gap: 1rem;
}

.vz-dash__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  line-height: 1;
  margin-bottom: 0.4rem;
}

.vz-dash__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
}

.vz-dash__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.vz-dash__updated {
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  color: var(--vz-text3);
  letter-spacing: 0.04em;
}

.vz-dash__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  color: var(--vz-text3);
  background: none;
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-md);
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.vz-dash__refresh:hover {
  color: var(--vz-text);
  border-color: var(--vz-border2);
}

/* ── Grid ── */
.vz-dash__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .vz-dash__grid {
    grid-template-columns: 1fr;
  }
}

/* ── Panel ── */
.vz-dash__panel {
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.vz-dash__panel--muted {
  opacity: 0.6;
}

.vz-dash__panel-header {
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid var(--vz-border);
  background: var(--vz-surface);
}

.vz-dash__panel-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.2rem;
}

.vz-dash__panel-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.vz-dash__panel-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vz-text);
}

.vz-dash__panel-badge {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: var(--vz-radius-sm);
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  color: var(--vz-text3);
}

.vz-dash__panel-badge--dim {
  opacity: 0.6;
}

.vz-dash__panel-sub {
  font-size: 0.78rem;
  color: var(--vz-text3);
}

.vz-dash__loading,
.vz-dash__error {
  padding: 1.5rem 1.4rem;
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  color: var(--vz-text3);
}

.vz-dash__error {
  color: var(--vz-red);
}

/* ── Section ── */
.vz-dash__section {
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid var(--vz-border);
}

.vz-dash__section:last-child {
  border-bottom: none;
}

.vz-dash__section-title {
  font-family: var(--vz-font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
  margin-bottom: 0.75rem;
}

/* ── Storage bar ── */
.vz-dash__bar-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.vz-dash__bar-label {
  font-size: 0.82rem;
  color: var(--vz-text2);
}

.vz-dash__bar-value {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  color: var(--vz-text);
}

.vz-dash__bar-track {
  height: 6px;
  background: var(--vz-surface2);
  border-radius: 99px;
  overflow: hidden;
}

.vz-dash__bar-fill {
  height: 100%;
  background: #00e5a0;
  border-radius: 99px;
  transition: width 0.4s;
}

.vz-dash__bar-fill--warn {
  background: var(--vz-amber);
}

.vz-dash__bar-pct {
  font-family: var(--vz-font-mono);
  font-size: 0.68rem;
  color: var(--vz-text3);
  margin-top: 0.3rem;
}

/* ── Table ── */
.vz-dash__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.vz-dash__table thead tr {
  border-bottom: 1px solid var(--vz-border);
}

.vz-dash__table th {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3);
  padding: 0 0 0.4rem;
  text-align: left;
  font-weight: 600;
}

.vz-dash__table td {
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--vz-border);
  color: var(--vz-text);
}

.vz-dash__table tbody tr:last-child td {
  border-bottom: none;
}
.vz-dash__table tbody tr:hover td {
  color: var(--vz-text);
  background: var(--vz-surface);
}

.vz-dash__table-name {
  font-family: var(--vz-font-mono);
  font-size: 0.76rem;
}

.vz-dash__table-right {
  text-align: right;
  font-family: var(--vz-font-mono);
  font-size: 0.76rem;
}

.vz-dash__table-dim {
  color: var(--vz-text3);
}

/* ── Metric tiles ── */
.vz-dash__tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--vz-border);
  margin: 0;
}

.vz-dash__tile {
  background: var(--vz-bg);
  padding: 1rem 1.1rem;
  transition: background 0.12s;
}

.vz-dash__tile:hover {
  background: var(--vz-surface);
}

.vz-dash__tile-label {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3);
  margin-bottom: 0.3rem;
}

.vz-dash__tile-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--vz-text);
  line-height: 1.2;
  font-family: var(--vz-font-mono);
}

.vz-dash__tile-sub {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  color: var(--vz-text3);
  margin-top: 0.15rem;
}

/* ── Billing ── */
.vz-dash__billing-note {
  font-size: 0.78rem;
  color: var(--vz-text3);
  margin-bottom: 0.6rem;
}

.vz-dash__billing-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: #8b5cf6;
  text-decoration: none;
  transition: opacity 0.15s;
}

.vz-dash__billing-link:hover {
  opacity: 0.75;
}

/* ── Placeholder ── */
.vz-dash__placeholder {
  padding: 1.5rem 1.4rem;
  font-size: 0.82rem;
  color: var(--vz-text3);
  line-height: 1.6;
}
</style>
