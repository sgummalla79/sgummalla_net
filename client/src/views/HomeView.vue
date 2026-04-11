<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { AppLayout, NavLink, Button, ThemeToggle } from "@vzen/ui";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const themeMode = ref<"dark" | "light">("dark");

function toggleTheme() {
  themeMode.value = themeMode.value === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", themeMode.value);
}

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}
</script>

<template>
  <AppLayout brand="vZen Solutions" :user-label="auth.email">
    <template #nav-links>
      <NavLink href="/home" :active="true">Home</NavLink>
      <NavLink href="/auths">Available Auths</NavLink>
    </template>

    <template #nav-right>
      <ThemeToggle :mode="themeMode" @toggle="toggleTheme" />
      <Button variant="ghost" @click="handleLogout">Sign out</Button>
    </template>

    <!-- Main content -->
    <div class="vz-home">
      <p class="vz-home__eyebrow">Welcome back</p>
      <h1 class="vz-home__headline">
        {{ auth.fullName }}<span class="vz-home__dot">.</span>
      </h1>
      <p class="vz-home__subline">Your session is active.</p>

      <div class="vz-home__status">
        <div class="vz-home__status-item">
          <span class="vz-home__status-dot" />
          Session active
        </div>
        <div class="vz-home__status-item">
          <span class="vz-home__status-provider">
            via {{ auth.user?.provider ?? "—" }}
          </span>
        </div>
      </div>

      <div class="vz-home__actions">
        <Button @click="$router.push({ name: 'auths' })">
          View Available Auths ↗
        </Button>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-home {
  width: 100%;
  max-width: 860px;
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

.vz-home__eyebrow {
  font-family: var(--vz-font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vz-text2);
  margin-bottom: 0.4rem;
}

.vz-home__headline {
  font-size: clamp(2.6rem, 6vw, 4rem);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--vz-text);
  margin-bottom: 0.5rem;
}

.vz-home__dot {
  color: #f5c842;
  animation: vz-pulse 2.5s ease-in-out infinite;
}

@keyframes vz-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.vz-home__subline {
  font-size: 1rem;
  color: var(--vz-text2);
  margin-bottom: 2rem;
}

.vz-home__status {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.vz-home__status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  color: var(--vz-text2);
}

.vz-home__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vz-green);
  animation: vz-pulse 2.5s ease-in-out infinite;
}

.vz-home__status-provider {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  color: var(--vz-text3);
  text-transform: capitalize;
}

.vz-home__actions {
  display: flex;
  gap: 0.75rem;
}
</style>
