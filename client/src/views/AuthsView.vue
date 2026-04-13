<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout, AuthCard, Button } from "@vzen/ui";
import { useAuthStore } from "../stores/auth";
import { getPortals, launchExperienceCloud, type Portal } from "../api/portals";

const router = useRouter();
const auth = useAuthStore();
const portals = ref<Portal[]>([]);
const launching = ref<string | null>(null);

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
</style>
