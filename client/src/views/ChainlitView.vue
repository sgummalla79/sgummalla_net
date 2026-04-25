<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "home" });
}

onMounted(() => {
  const script = document.createElement("script");
  script.src = "/chainlit-app/copilot/index.js";
  script.onload = () => {
    (window as any).mountChainlitWidget({
      chainlitServer: `${window.location.origin}/chainlit-app`,
      theme: document.documentElement.classList.contains("light")
        ? "light"
        : "dark",
    });
  };
  document.head.appendChild(script);
});

onUnmounted(() => {
  document.querySelector('script[src*="copilot/index.js"]')?.remove();
});
</script>

<template>
  <AppLayout
    active-page="chainlit"
    :user-name="auth.fullName"
    :user-email="auth.email"
    @profile="router.push({ name: 'profile' })"
    @logout="handleLogout"
  >
    <div class="vz-ai">
      <div class="vz-ai__header">
        <h1 class="vz-ai__title">AI Pilot</h1>
        <p class="vz-ai__sub">Ask anything — powered by GPT-4o.</p>
      </div>
      <div class="vz-ai__hint">
        <span class="vz-ai__hint-dot" />
        Chat widget is ready — click the button in the bottom right corner.
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-ai {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.vz-ai__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  line-height: 1;
  margin-bottom: 0.4rem;
}

.vz-ai__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
  line-height: 1.6;
}

.vz-ai__hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--vz-text3);
}

.vz-ai__hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vz-green);
  flex-shrink: 0;
  animation: vz-pulse 2.5s ease-in-out infinite;
}

@keyframes vz-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
</style>
