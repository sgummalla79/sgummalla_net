<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout, NavLink, AuthCard, Button, ThemeToggle } from "@vzen/ui";
import { useAuthStore } from "../stores/auth";
import { useThemeToggle } from "../composables/useThemeToggle";
import { getPortals, launchExperienceCloud, type Portal } from "../api/portals";

const router = useRouter();
const auth = useAuthStore();
const { mode: themeMode, toggle: toggleTheme } = useThemeToggle();
const portals = ref<Portal[]>([]);
const launching = ref<string | null>(null);
const metaContent = ref<string | null>(null);
const metaLabel = ref("");

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}

async function launch(portal: Portal) {
  launching.value = portal.id;
  try {
    if (portal.id === "experience-cloud") {
      await launchExperienceCloud();
    } else if (portal.external && portal.launchUrl) {
      window.open(portal.launchUrl, "_blank", "noopener,noreferrer");
    }
  } finally {
    launching.value = null;
  }
}

async function fetchMeta(type: "saml" | "oidc") {
  const url =
    type === "saml"
      ? "/api/saml/metadata"
      : "/api/.well-known/openid-configuration";
  metaLabel.value = url;
  try {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    metaContent.value =
      type === "oidc"
        ? (() => {
            try {
              return JSON.stringify(JSON.parse(text), null, 2);
            } catch {
              return text;
            }
          })()
        : text;
  } catch {
    metaContent.value = "Error loading metadata";
  }
}

onMounted(async () => {
  portals.value = await getPortals();
});
</script>

<template>
  <AppLayout brand="vZen Solutions" :user-label="auth.email" :scrollable="true">
    <template #nav-links>
      <NavLink href="/home">Home</NavLink>
      <NavLink href="/auths" :active="true">Available Auths</NavLink>
    </template>

    <template #nav-right>
      <ThemeToggle :mode="themeMode" @toggle="toggleTheme" />
      <Button variant="ghost" @click="handleLogout">Sign out</Button>
    </template>

    <div class="vz-auths">
      <div class="vz-auths__section-header">
        <p class="vz-auths__eyebrow">Identity Gateway</p>
        <h1 class="vz-auths__title">Available Auths</h1>
        <p class="vz-auths__sub">
          All configured authentication protocols and their entry points.
        </p>
      </div>

      <div class="vz-auths__grid">
        <AuthCard
          v-for="portal in portals"
          :key="portal.id"
          :title="portal.name"
          :description="portal.description"
          :protocol="portal.protocol"
          status="active"
        >
          <template #action>
            <Button
              variant="ghost"
              :loading="launching === portal.id"
              @click="launch(portal)"
            >
              Open {{ portal.name }} ↗
            </Button>
          </template>
        </AuthCard>
      </div>

      <div class="vz-auths__divider" />

      <div class="vz-auths__section-header">
        <p class="vz-auths__eyebrow">Configuration</p>
        <h2 class="vz-auths__title vz-auths__title--sm">Protocol Metadata</h2>
        <p class="vz-auths__sub">
          Inspect the raw configuration documents for each protocol.
        </p>
      </div>

      <div class="vz-auths__meta-row">
        <Button variant="ghost" @click="fetchMeta('saml')"
          >SAML Metadata</Button
        >
        <Button variant="ghost" @click="fetchMeta('oidc')"
          >OAuth / OIDC Config</Button
        >
        <Button v-if="metaContent" variant="ghost" @click="metaContent = null"
          >Clear ✕</Button
        >
      </div>

      <div v-if="metaContent" class="vz-auths__meta-viewer">
        <div class="vz-auths__meta-header">
          <span class="vz-auths__meta-label">{{ metaLabel }}</span>
        </div>
        <pre class="vz-auths__meta-body">{{ metaContent }}</pre>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-auths {
  width: 100%;
  max-width: 900px;
  animation: vz-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  padding-bottom: 2rem;
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

.vz-auths__section-header {
  margin-bottom: 1.5rem;
}

.vz-auths__eyebrow {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vz-text3);
  margin-bottom: 0.35rem;
}

.vz-auths__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  margin-bottom: 0.4rem;
  line-height: 1;
}

.vz-auths__title--sm {
  font-size: 1.3rem;
}

.vz-auths__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
  line-height: 1.6;
}

.vz-auths__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--vz-border);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
  margin-bottom: 1rem;
}

.vz-auths__divider {
  height: 1px;
  background: var(--vz-border);
  margin: 2.5rem 0;
}

.vz-auths__meta-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.vz-auths__meta-viewer {
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
}

.vz-auths__meta-header {
  padding: 0.65rem 1rem;
  background: var(--vz-surface);
  border-bottom: 1px solid var(--vz-border);
}

.vz-auths__meta-label {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  color: var(--vz-text2);
}

.vz-auths__meta-body {
  width: 100%;
  min-height: 200px;
  background: var(--vz-bg2);
  color: var(--vz-text2);
  padding: 1rem 1.1rem;
  font-family: var(--vz-font-mono);
  font-size: 0.76rem;
  line-height: 1.7;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 680px) {
  .vz-auths__grid {
    grid-template-columns: 1fr;
  }
}
</style>
