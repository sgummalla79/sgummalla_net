<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { AppLayout, Button } from "@vzen/ui";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const metaContent = ref<string | null>(null);
const metaLabel = ref("");

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}

async function fetchMeta(type: "saml" | "oidc") {
  const url =
    type === "saml"
      ? "/api/saml/idp-metadata"
      : "/api/oidc/.well-known/openid-configuration";
  metaLabel.value = url;
  try {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();

    if (!res.ok) {
      try {
        const json = JSON.parse(text) as { error?: string };
        metaContent.value = `⚠ ${json.error ?? "Server error"}`;
      } catch {
        metaContent.value = `⚠ Error ${res.status}`;
      }
      return;
    }

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
    metaContent.value = "⚠ Failed to connect to server";
  }
}
</script>

<template>
  <AppLayout
    active-page="configuration"
    :user-name="auth.fullName"
    :user-email="auth.email"
    @profile="router.push({ name: 'profile' })"
    :scrollable="true"
    @logout="handleLogout"
  >
    <div class="vz-config">
      <div class="vz-config__section-header">
        <p class="vz-config__eyebrow">Configuration</p>
        <h1 class="vz-config__title">Protocol Metadata</h1>
        <p class="vz-config__sub">
          Inspect the raw configuration documents for each protocol.
        </p>
      </div>

      <div class="vz-config__meta-row">
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

      <div v-if="metaContent" class="vz-config__meta-viewer">
        <div class="vz-config__meta-header">
          <span class="vz-config__meta-label">{{ metaLabel }}</span>
        </div>
        <pre class="vz-config__meta-body">{{ metaContent }}</pre>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-config {
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

.vz-config__section-header {
  margin-bottom: 1.5rem;
}

.vz-config__eyebrow {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vz-text3);
  margin-bottom: 0.35rem;
}

.vz-config__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  margin-bottom: 0.4rem;
  line-height: 1;
}

.vz-config__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
  line-height: 1.6;
}

.vz-config__meta-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.vz-config__meta-viewer {
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
}

.vz-config__meta-header {
  padding: 0.65rem 1rem;
  background: var(--vz-surface);
  border-bottom: 1px solid var(--vz-border);
}

.vz-config__meta-label {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  color: var(--vz-text2);
}

.vz-config__meta-body {
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
</style>
