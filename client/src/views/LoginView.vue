<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { AppLayout, Button, TextInput } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import { initiateAuth0 } from "../api/auth";

const router = useRouter();
const auth = useAuthStore();
const email = ref("");
const password = ref("");

async function handleLogin() {
  try {
    await auth.login(email.value, password.value);
    await router.push({ name: "auths" });
  } catch {
    // error is set in the store
  }
}
</script>

<template>
  <AppLayout
    :nav-links="[{ name: 'blog', label: 'Blog', href: '/blog' }]"
    active-page=""
  >
    <div class="vz-login-card">
      <div v-if="auth.error" class="vz-login-card__error" role="alert">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          style="flex-shrink: 0"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="8" cy="11" r=".75" fill="currentColor" />
        </svg>
        {{ auth.error }}
      </div>

      <form class="vz-login-card__form" @submit.prevent="handleLogin">
        <TextInput
          v-model="email"
          type="email"
          name="email"
          placeholder="Email address"
          autocomplete="email"
          :required="true"
          @focus="auth.clearError()"
        />
        <TextInput
          v-model="password"
          type="password"
          name="password"
          placeholder="Password"
          autocomplete="current-password"
          :required="true"
          @focus="auth.clearError()"
        />
        <Button type="submit" :loading="auth.loading" :full-width="true">Sign In</Button>
      </form>

      <div class="vz-login-card__divider">
        <span class="vz-login-card__divider-line" />
        <span class="vz-login-card__divider-text">or</span>
        <span class="vz-login-card__divider-line" />
      </div>

      <Button variant="ghost" :full-width="true" @click="initiateAuth0">
        <span class="vz-auth0-dot" />
        Continue with Auth0
      </Button>
    </div>

    <template #footer>
      <span>Ideas in Motion, Think. Build. Demo.</span>
    </template>
  </AppLayout>
</template>

<style scoped>
.vz-login-card {
  width: 100%;
  max-width: 380px;
  animation: vz-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes vz-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.vz-login-card__error {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--vz-red-dim);
  border: 1px solid var(--vz-red);
  border-radius: var(--vz-radius-md);
  padding: 0.65rem 0.85rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: var(--vz-red);
  line-height: 1.5;
}

.vz-login-card__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.vz-login-card__divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0;
}

.vz-login-card__divider-line {
  flex: 1;
  height: 1px;
  background: var(--vz-border);
}

.vz-login-card__divider-text {
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
}

.vz-auth0-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #eb5424;
  flex-shrink: 0;
}
</style>
