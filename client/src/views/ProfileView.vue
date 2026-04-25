<script setup lang="ts">
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "home" });
}

const user = auth.user;
const joinedDate = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const initials = (user?.name ?? "")
  .split(" ")
  .map((w) => w[0])
  .join("")
  .slice(0, 2)
  .toUpperCase();
</script>

<template>
  <AppLayout
    :user-name="auth.fullName"
    :user-email="auth.email"
    @logout="handleLogout"
  >
    <div class="vz-profile">
      <div class="vz-profile__header">
        <div class="vz-profile__avatar">{{ initials }}</div>
        <div class="vz-profile__identity">
          <h1 class="vz-profile__name">{{ user?.name }}</h1>
          <p class="vz-profile__email">{{ user?.email }}</p>
          <span class="vz-profile__provider">via {{ user?.provider }}</span>
        </div>
      </div>

      <div class="vz-profile__grid">
        <div class="vz-profile__card">
          <p class="vz-profile__card-label">Full Name</p>
          <p class="vz-profile__card-value">{{ user?.name || "—" }}</p>
        </div>
        <div class="vz-profile__card">
          <p class="vz-profile__card-label">Email Address</p>
          <p class="vz-profile__card-value">{{ user?.email || "—" }}</p>
        </div>
        <div class="vz-profile__card">
          <p class="vz-profile__card-label">User ID</p>
          <p class="vz-profile__card-value vz-profile__card-value--mono">
            {{ user?.id || "—" }}
          </p>
        </div>
        <div class="vz-profile__card">
          <p class="vz-profile__card-label">Auth Provider</p>
          <p class="vz-profile__card-value">
            <span class="vz-profile__badge">{{ user?.provider }}</span>
          </p>
        </div>
        <div class="vz-profile__card">
          <p class="vz-profile__card-label">Session Status</p>
          <p class="vz-profile__card-value vz-profile__card-value--green">
            <span class="vz-profile__dot" /> Active
          </p>
        </div>
        <div class="vz-profile__card">
          <p class="vz-profile__card-label">Session Date</p>
          <p class="vz-profile__card-value">{{ joinedDate }}</p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-profile {
  width: 100%;
  max-width: 760px;
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

.vz-profile__header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--vz-border);
}

.vz-profile__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--vz-font-mono);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--vz-text);
  flex-shrink: 0;
}

.vz-profile__name {
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  line-height: 1;
}

.vz-profile__email {
  font-family: var(--vz-font-mono);
  font-size: 0.82rem;
  color: var(--vz-text2);
}

.vz-profile__provider {
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
}

.vz-profile__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--vz-border);
  border: 1px solid var(--vz-border);
  border-radius: var(--vz-radius-lg);
  overflow: hidden;
}

.vz-profile__card {
  background: var(--vz-bg);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: background 0.15s;
}

.vz-profile__card:hover {
  background: var(--vz-surface);
}

.vz-profile__card-label {
  font-family: var(--vz-font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
}

.vz-profile__card-value {
  font-size: 0.95rem;
  color: var(--vz-text);
  font-weight: 500;
}

.vz-profile__card-value--mono {
  font-family: var(--vz-font-mono);
  font-size: 0.78rem;
  word-break: break-all;
}

.vz-profile__card-value--green {
  color: var(--vz-green);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.vz-profile__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vz-green);
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

.vz-profile__badge {
  display: inline-block;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: var(--vz-radius-sm);
  background: var(--vz-surface2);
  color: var(--vz-text2);
  border: 1px solid var(--vz-border2);
}

@media (max-width: 600px) {
  .vz-profile__grid {
    grid-template-columns: 1fr;
  }
  .vz-profile__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
