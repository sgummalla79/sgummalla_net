<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useStorage } from "@vueuse/core";
import { useRouter } from "vue-router";
import { AppLayout, AuthCard, Button } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import { getPortals, launchExperienceCloud, type Portal } from "../api/portals";

const router = useRouter();
const auth = useAuthStore();
const portals = ref<Portal[]>([]);
const launching = ref<string | null>(null);
const ecPortal = ref<"support" | "help">("support");

const themeMode = useStorage("sgw-theme-mode", "dark");
const selectColorScheme = computed(() =>
  themeMode.value === "dark" ? "dark" : "light",
);

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "home" });
}

const chainlitMounted = ref(false);

async function launchChainlit() {
  const res = await fetch("/api/auth/chainlit-token", { credentials: "include" });
  if (!res.ok) return;
  const { token } = await res.json();

  if (chainlitMounted.value) {
    (window as any).toggleChainlitCopilot();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/chainlit-app/copilot/index.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Chainlit copilot script"));
    document.head.appendChild(s);
  });

  (window as any).mountChainlitWidget({
    chainlitServer: window.location.origin + "/chainlit-app",
    accessToken: token,
    theme: themeMode.value === "dark" ? "dark" : "light",
  });
  chainlitMounted.value = true;
}

async function launch(portal: Portal) {
  launching.value = portal.id;
  try {
    if (portal.id === "experience-cloud") {
      await launchExperienceCloud(ecPortal.value);
    } else if (portal.id === "chainlit-pilot") {
      await launchChainlit();
    } else if (portal.external && portal.launchUrl) {
      window.open(portal.launchUrl, "_blank", "noopener,noreferrer");
    }
  } finally {
    launching.value = null;
  }
}

onMounted(async () => {
  portals.value = await getPortals();
});
</script>

<template>
  <AppLayout
    active-page="auths"
    :user-name="auth.fullName"
    :user-email="auth.email"
    @profile="router.push({ name: 'profile' })"
    :scrollable="true"
    @logout="handleLogout"
  >
    <div class="vz-auths">
      <div class="vz-auths__section-header">
        <h1 class="vz-auths__title">Applications</h1>
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
            <div v-if="portal.id === 'experience-cloud'" class="vz-ec-action">
              <select
                v-model="ecPortal"
                class="vz-ec-select"
                :style="{ colorScheme: selectColorScheme }"
              >
                <option value="support">Support Portal</option>
                <option value="help">Help Portal</option>
              </select>
              <Button
                variant="ghost"
                :loading="launching === portal.id"
                @click="launch(portal)"
              >
                {{ portal.name }} ↗
              </Button>
            </div>
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

@media (max-width: 680px) {
  .vz-auths__grid {
    grid-template-columns: 1fr;
  }
}

.vz-ec-action {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.vz-ec-select {
  width: 100%;
  padding: 0.35rem 0.6rem;
  font-size: 0.85rem;
  font-family: var(--vz-font-sans);
  color: var(--vz-text);
  background-color: transparent;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
  padding-right: 2rem;
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius);
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

/* Fallback for Windows/Firefox where option elements accept direct CSS */
.vz-ec-select option {
  background-color: var(--vz-bg);
  color: var(--vz-text);
}

.vz-ec-select:focus {
  border-color: var(--vz-border2);
}
</style>
