<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import {
  fetchNeonUsage, fetchFlyUsage, fetchFirestoreUsage,
  type NeonUsage, type FlyUsage, type FirestoreUsage, type DailyCount,
} from "../api/usage";

const router = useRouter();
const auth  = useAuthStore();

type Section = "neon" | "fly" | "firestore";
const active = ref<Section>("neon");

const neon      = ref<NeonUsage | null>(null);
const fly       = ref<FlyUsage | null>(null);
const firestore = ref<FirestoreUsage | null>(null);
const neonErr   = ref<string | null>(null);
const flyErr    = ref<string | null>(null);
const fsErr     = ref<string | null>(null);
const loading   = ref(true);
const lastUpdated = ref<Date | null>(null);

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576)    return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024)       return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortDay(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
// One series per table/collection, grouped by day.

interface ChartSeries { label: string; color: string; days: DailyCount[] }

function buildChart(series: ChartSeries[], days: string[]) {
  const H = 120, PAD_BOTTOM = 20, PAD_TOP = 8;
  const maxVal = Math.max(1, ...series.flatMap(s => s.days.map(d => d.count)));
  const W_PER_GROUP = 52;
  const BAR_W = series.length > 1 ? Math.floor((W_PER_GROUP - 4) / series.length) : W_PER_GROUP - 4;
  const totalW = days.length * W_PER_GROUP;

  const bars = series.flatMap((s, si) =>
    days.map((day, di) => {
      const val = s.days.find(d => d.day === day)?.count ?? 0;
      const barH = Math.max(2, ((val / maxVal) * (H - PAD_BOTTOM - PAD_TOP)));
      const x = di * W_PER_GROUP + 2 + si * (BAR_W + 1);
      const y = H - PAD_BOTTOM - barH;
      return { x, y, w: BAR_W, h: barH, color: s.color, label: `${s.label}: ${val}`, day, val };
    })
  );

  const labels = days.map((day, di) => ({
    x: di * W_PER_GROUP + W_PER_GROUP / 2,
    y: H - 4,
    text: shortDay(day),
  }));

  return { bars, labels, totalW, H };
}

const neonChartDays = computed(() => {
  if (!neon.value?.activity?.[0]) return [];
  return neon.value.activity[0].days.map(d => d.day);
});

const neonChart = computed(() => {
  if (!neon.value?.activity) return null;
  return buildChart(neon.value.activity, neonChartDays.value);
});

const fsChartDays = computed(() => {
  if (!firestore.value?.collections?.[0]?.activity) return [];
  return firestore.value.collections[0].activity.map(d => d.day);
});

const FS_COLORS: Record<string, string> = {
  api_logs: "#60a5fa", page_views: "#34d399", auth_events: "#f59e0b", sf_ops: "#a78bfa",
};

const fsChart = computed(() => {
  if (!firestore.value?.collections) return null;
  const series = firestore.value.collections.map(c => ({
    label: c.label,
    color: FS_COLORS[c.name] ?? "#94a3b8",
    days: c.activity,
  }));
  return buildChart(series, fsChartDays.value);
});

// ── Legend ────────────────────────────────────────────────────────────────────

const neonLegend = computed(() => neon.value?.activity ?? []);
const fsLegend = computed(() =>
  (firestore.value?.collections ?? []).map(c => ({ label: c.label, color: FS_COLORS[c.name] ?? "#94a3b8" }))
);

// ── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true;
  neonErr.value = flyErr.value = fsErr.value = null;

  const [nr, fr, fsr] = await Promise.allSettled([fetchNeonUsage(), fetchFlyUsage(), fetchFirestoreUsage()]);

  neon.value      = nr.status  === "fulfilled" ? nr.value  : null;
  fly.value       = fr.status  === "fulfilled" ? fr.value  : null;
  firestore.value = fsr.status === "fulfilled" ? fsr.value : null;
  if (nr.status  === "rejected") neonErr.value = nr.reason  instanceof Error ? nr.reason.message  : "Failed";
  if (fr.status  === "rejected") flyErr.value  = fr.reason  instanceof Error ? fr.reason.message  : "Failed";
  if (fsr.status === "rejected") fsErr.value   = fsr.reason instanceof Error ? fsr.reason.message : "Failed";

  loading.value = false;
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

      <!-- Page header -->
      <div class="vz-dash__top">
        <div>
          <h1 class="vz-dash__title">Usage Dashboard</h1>
          <p class="vz-dash__sub">Infrastructure usage for sgummalla.net</p>
        </div>
        <div class="vz-dash__actions">
          <p v-if="lastUpdated" class="vz-dash__updated">Updated {{ lastUpdated.toLocaleTimeString() }}</p>
          <button class="vz-dash__refresh" @click="load">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div class="vz-dash__layout">

        <!-- Side nav -->
        <nav class="vz-dash__sidenav">
          <button
            v-for="item in [
              { key: 'neon',      label: 'NeonDB',    color: '#00e5a0' },
              { key: 'firestore', label: 'Firestore', color: '#ffca28' },
              { key: 'fly',       label: 'Fly.io',    color: '#8b5cf6' },
            ]"
            :key="item.key"
            class="vz-dash__navitem"
            :class="{ 'vz-dash__navitem--active': active === item.key }"
            @click="active = item.key as Section"
          >
            <span class="vz-dash__navdot" :style="{ background: item.color }" />
            {{ item.label }}
          </button>
        </nav>

        <!-- Main content -->
        <div class="vz-dash__content">

          <!-- ── NeonDB ──────────────────────────────────── -->
          <div v-if="active === 'neon'" class="vz-dash__panel">
            <div class="vz-dash__panel-header">
              <div class="vz-dash__panel-title-row">
                <svg class="vz-dash__panel-icon" viewBox="0 0 24 24" fill="currentColor" style="color:#00e5a0">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  <path d="M11 7h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                <span class="vz-dash__panel-title">NeonDB</span>
                <span class="vz-dash__panel-badge">PostgreSQL · Free Tier · 512 MB limit</span>
              </div>
            </div>

            <div v-if="loading" class="vz-dash__loading">Loading…</div>
            <div v-else-if="neonErr" class="vz-dash__error">{{ neonErr }}</div>
            <template v-else-if="neon">

              <!-- Storage bar -->
              <div class="vz-dash__section">
                <p class="vz-dash__section-title">Storage</p>
                <div class="vz-dash__bar-header">
                  <span class="vz-dash__bar-label">Used</span>
                  <span class="vz-dash__bar-value">{{ fmt(neon.usedBytes) }} / {{ fmt(neon.limitBytes) }}</span>
                </div>
                <div class="vz-dash__bar-track">
                  <div class="vz-dash__bar-fill" :class="neon.usedPercent > 80 ? 'vz-dash__bar-fill--warn' : ''" :style="{ width: `${Math.min(neon.usedPercent, 100)}%` }" />
                </div>
                <p class="vz-dash__bar-pct">{{ neon.usedPercent }}% used</p>
              </div>

              <!-- Table breakdown -->
              <div class="vz-dash__section">
                <p class="vz-dash__section-title">Tables</p>
                <table class="vz-dash__table">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th class="vz-dash__tc">Rows</th>
                      <th class="vz-dash__tc">Total size</th>
                      <th class="vz-dash__tc">Data</th>
                      <th class="vz-dash__tc">Indexes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in neon.tables" :key="t.name">
                      <td class="vz-dash__tname">{{ t.name }}</td>
                      <td class="vz-dash__tc">{{ fmtNum(t.rowCount) }}</td>
                      <td class="vz-dash__tc">{{ fmt(t.totalBytes) }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">{{ fmt(t.tableBytes) }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">{{ fmt(t.indexBytes) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 7-day activity chart -->
              <div v-if="neonChart" class="vz-dash__section">
                <p class="vz-dash__section-title">Records created — last 7 days</p>
                <div class="vz-dash__chart-wrap">
                  <svg :viewBox="`0 0 ${neonChart.totalW} ${neonChart.H}`" preserveAspectRatio="none" class="vz-dash__chart-svg">
                    <rect
                      v-for="(b, i) in neonChart.bars" :key="i"
                      :x="b.x" :y="b.y" :width="b.w" :height="b.h"
                      :fill="b.color" rx="2" opacity="0.85"
                    >
                      <title>{{ b.label }}</title>
                    </rect>
                    <text v-for="(l, i) in neonChart.labels" :key="i" :x="l.x" :y="l.y" text-anchor="middle" class="vz-dash__chart-label">{{ l.text }}</text>
                  </svg>
                  <div class="vz-dash__legend">
                    <span v-for="s in neonLegend" :key="s.table" class="vz-dash__legend-item">
                      <span class="vz-dash__legend-dot" :style="{ background: s.color }" />
                      {{ s.label }}
                    </span>
                  </div>
                </div>
              </div>

            </template>
          </div>

          <!-- ── Firestore ───────────────────────────────── -->
          <div v-else-if="active === 'firestore'" class="vz-dash__panel">
            <div class="vz-dash__panel-header">
              <div class="vz-dash__panel-title-row">
                <svg class="vz-dash__panel-icon" viewBox="0 0 24 24" fill="currentColor" style="color:#ffca28">
                  <path d="M6.5 2h11L21 8.5 12 22 3 8.5 6.5 2zm1.25 2L5.2 8h13.6l-2.55-4H7.75zM12 18.5l7-9H5l7 9z"/>
                </svg>
                <span class="vz-dash__panel-title">Firestore</span>
                <span class="vz-dash__panel-badge">sgummallaworks · Free Tier · 1 GB / 50K reads / 20K writes per day</span>
              </div>
            </div>

            <div v-if="loading" class="vz-dash__loading">Loading…</div>
            <div v-else-if="fsErr" class="vz-dash__error">{{ fsErr }}</div>
            <template v-else-if="firestore">

              <!-- Collection breakdown -->
              <div class="vz-dash__section">
                <p class="vz-dash__section-title">Collections — {{ fmtNum(firestore.totalDocuments) }} total documents</p>
                <table class="vz-dash__table">
                  <thead>
                    <tr>
                      <th>Collection</th>
                      <th class="vz-dash__tc">Documents</th>
                      <th class="vz-dash__tc">TTL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="col in firestore.collections" :key="col.name">
                      <td class="vz-dash__tname">
                        <span class="vz-dash__tname-dot" :style="{ background: FS_COLORS[col.name] ?? '#94a3b8' }" />
                        {{ col.label }}
                      </td>
                      <td class="vz-dash__tc">{{ col.count !== null ? fmtNum(col.count) : '—' }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">{{ col.ttl }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 7-day activity chart -->
              <div v-if="fsChart" class="vz-dash__section">
                <p class="vz-dash__section-title">Documents created — last 7 days</p>
                <div class="vz-dash__chart-wrap">
                  <svg :viewBox="`0 0 ${fsChart.totalW} ${fsChart.H}`" preserveAspectRatio="none" class="vz-dash__chart-svg">
                    <rect
                      v-for="(b, i) in fsChart.bars" :key="i"
                      :x="b.x" :y="b.y" :width="b.w" :height="b.h"
                      :fill="b.color" rx="2" opacity="0.85"
                    >
                      <title>{{ b.label }}</title>
                    </rect>
                    <text v-for="(l, i) in fsChart.labels" :key="i" :x="l.x" :y="l.y" text-anchor="middle" class="vz-dash__chart-label">{{ l.text }}</text>
                  </svg>
                  <div class="vz-dash__legend">
                    <span v-for="s in fsLegend" :key="s.label" class="vz-dash__legend-item">
                      <span class="vz-dash__legend-dot" :style="{ background: s.color }" />
                      {{ s.label }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="vz-dash__section">
                <a :href="firestore.consoleUrl" target="_blank" rel="noopener noreferrer" class="vz-dash__ext-link">
                  Open Firebase Console
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>

            </template>
          </div>

          <!-- ── Fly.io ──────────────────────────────────── -->
          <div v-else class="vz-dash__panel">
            <div class="vz-dash__panel-header">
              <div class="vz-dash__panel-title-row">
                <svg class="vz-dash__panel-icon" viewBox="0 0 24 24" fill="currentColor" style="color:#8b5cf6">
                  <path d="M21 16.5c0 2.485-4.03 4.5-9 4.5s-9-2.015-9-4.5V12c0 2.485 4.03 4.5 9 4.5s9-2.015 9-4.5v4.5z"/>
                  <path d="M21 12c0 2.485-4.03 4.5-9 4.5S3 14.485 3 12V7.5C3 5.015 7.03 3 12 3s9 2.015 9 4.5V12z"/>
                </svg>
                <span class="vz-dash__panel-title">Fly.io</span>
                <span class="vz-dash__panel-badge">{{ fly?.app ?? 'sgummalla-net' }} · metrics last 5 min / 24 h</span>
              </div>
            </div>

            <div v-if="loading" class="vz-dash__loading">Loading…</div>
            <div v-else-if="flyErr" class="vz-dash__error">{{ flyErr }}</div>
            <template v-else-if="fly">

              <div class="vz-dash__section">
                <p class="vz-dash__section-title">Machine metrics</p>
                <table class="vz-dash__table">
                  <thead><tr><th>Metric</th><th class="vz-dash__tc">Value</th><th class="vz-dash__tc vz-dash__tdim">Window</th></tr></thead>
                  <tbody>
                    <tr>
                      <td class="vz-dash__tname">CPU (user)</td>
                      <td class="vz-dash__tc">{{ fly.cpu.userPercent !== null ? `${fly.cpu.userPercent}%` : '—' }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">5 min avg</td>
                    </tr>
                    <tr>
                      <td class="vz-dash__tname">Memory used</td>
                      <td class="vz-dash__tc">{{ fly.memory.usedBytes !== null ? fmt(fly.memory.usedBytes) : '—' }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">of {{ fly.memory.totalBytes !== null ? fmt(fly.memory.totalBytes) : '—' }}</td>
                    </tr>
                    <tr>
                      <td class="vz-dash__tname">Network sent</td>
                      <td class="vz-dash__tc">{{ fly.network.sentBytes24h !== null ? fmt(fly.network.sentBytes24h) : '—' }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">24 h</td>
                    </tr>
                    <tr>
                      <td class="vz-dash__tname">Network received</td>
                      <td class="vz-dash__tc">{{ fly.network.recvBytes24h !== null ? fmt(fly.network.recvBytes24h) : '—' }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">24 h</td>
                    </tr>
                    <tr>
                      <td class="vz-dash__tname">HTTP requests</td>
                      <td class="vz-dash__tc">{{ fmtNum(fly.http.requests24h) }}</td>
                      <td class="vz-dash__tc vz-dash__tdim">24 h</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="vz-dash__section">
                <p class="vz-dash__billing-note">Dollar costs are not available via the Fly.io API.</p>
                <a :href="fly.billingUrl" target="_blank" rel="noopener noreferrer" class="vz-dash__ext-link">
                  View billing on Fly.io
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>

            </template>
          </div>

        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
/* ── Layout ── */
.vz-dash {
  width: 100%;
  max-width: 1080px;
  animation: vz-rise 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes vz-rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.vz-dash__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.75rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--vz-border);
}

.vz-dash__title {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  line-height: 1;
  margin-bottom: 0.35rem;
}

.vz-dash__sub {
  font-size: 0.88rem;
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
}

.vz-dash__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--vz-text3);
  background: none;
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-md);
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.vz-dash__refresh:hover { color: var(--vz-text); border-color: var(--vz-border2); }

/* ── Two-column layout ── */
.vz-dash__layout {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 700px) {
  .vz-dash__layout { grid-template-columns: 1fr; }
}

/* ── Side nav ── */
.vz-dash__sidenav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 1rem;
}

.vz-dash__navitem {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.75rem;
  font-family: var(--vz-font-sans);
  font-size: 0.875rem;
  color: var(--vz-text2);
  background: none;
  border: none;
  border-radius: var(--vz-radius-md);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.vz-dash__navitem:hover { background: var(--vz-surface); color: var(--vz-text); }
.vz-dash__navitem--active {
  background: var(--vz-surface2);
  color: var(--vz-text);
  font-weight: 500;
}

.vz-dash__navdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Panel ── */
.vz-dash__panel {
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
}

.vz-dash__panel-header {
  padding: 1rem 1.4rem;
  border-bottom: 1px solid var(--vz-border);
  background: var(--vz-surface);
}

.vz-dash__panel-title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.vz-dash__panel-icon { width: 18px; height: 18px; flex-shrink: 0; }

.vz-dash__panel-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vz-text);
}

.vz-dash__panel-badge {
  font-family: var(--vz-font-mono);
  font-size: 0.63rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: var(--vz-radius-sm);
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  color: var(--vz-text3);
}

.vz-dash__loading { padding: 1.5rem 1.4rem; font-family: var(--vz-font-mono); font-size: 0.78rem; color: var(--vz-text3); }
.vz-dash__error   { padding: 1.5rem 1.4rem; font-family: var(--vz-font-mono); font-size: 0.78rem; color: var(--vz-red); }

/* ── Section ── */
.vz-dash__section {
  padding: 1rem 1.4rem;
  border-bottom: 1px solid var(--vz-border);
}
.vz-dash__section:last-child { border-bottom: none; }

.vz-dash__section-title {
  font-family: var(--vz-font-mono);
  font-size: 0.67rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
  margin-bottom: 0.75rem;
}

/* ── Storage bar ── */
.vz-dash__bar-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.45rem; }
.vz-dash__bar-label  { font-size: 0.82rem; color: var(--vz-text2); }
.vz-dash__bar-value  { font-family: var(--vz-font-mono); font-size: 0.78rem; color: var(--vz-text); }
.vz-dash__bar-track  { height: 6px; background: var(--vz-surface2); border-radius: 99px; overflow: hidden; }
.vz-dash__bar-fill   { height: 100%; background: #00e5a0; border-radius: 99px; transition: width 0.4s; }
.vz-dash__bar-fill--warn { background: var(--vz-amber); }
.vz-dash__bar-pct    { font-family: var(--vz-font-mono); font-size: 0.67rem; color: var(--vz-text3); margin-top: 0.25rem; }

/* ── Table ── */
.vz-dash__table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }

.vz-dash__table th,
.vz-dash__table td { padding: 0.5rem 0.75rem; text-align: left; vertical-align: middle; }

.vz-dash__table th:first-child,
.vz-dash__table td:first-child { padding-left: 0; }

.vz-dash__table th:last-child,
.vz-dash__table td:last-child { padding-right: 0; }

.vz-dash__table thead tr { border-bottom: 1px solid var(--vz-border2); }

.vz-dash__table th {
  font-family: var(--vz-font-mono);
  font-size: 0.63rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3);
  font-weight: 600;
  white-space: nowrap;
}

.vz-dash__table td { border-bottom: 1px solid var(--vz-border); color: var(--vz-text); }
.vz-dash__table tbody tr:last-child td { border-bottom: none; }
.vz-dash__table tbody tr:hover td { background: var(--vz-surface); }

.vz-dash__tname {
  font-family: var(--vz-font-mono);
  font-size: 0.76rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.vz-dash__tname-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.vz-dash__tc   { text-align: right; font-family: var(--vz-font-mono); font-size: 0.76rem; white-space: nowrap; }
.vz-dash__tdim { color: var(--vz-text3); }

/* ── Bar chart ── */
.vz-dash__chart-wrap { display: flex; flex-direction: column; gap: 0.75rem; }

.vz-dash__chart-svg {
  width: 100%;
  height: 120px;
  display: block;
}

.vz-dash__chart-label {
  font-size: 9px;
  fill: var(--vz-text3);
  font-family: var(--vz-font-mono, monospace);
}

.vz-dash__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.vz-dash__legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  color: var(--vz-text3);
}

.vz-dash__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Misc ── */
.vz-dash__billing-note {
  font-size: 0.78rem;
  color: var(--vz-text3);
  margin-bottom: 0.6rem;
}

.vz-dash__ext-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--vz-text2);
  text-decoration: none;
  transition: color 0.15s;
}
.vz-dash__ext-link:hover { color: var(--vz-text); }
</style>
