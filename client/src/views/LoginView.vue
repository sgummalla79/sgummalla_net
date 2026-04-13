<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  LoginLayout,
  Button,
  TextInput,
  StatusDot,
  ThemeToggle,
} from "@vzen/ui";
import { useAuthStore } from "../stores/auth";
import { initiateAuth0 } from "../api/auth";
import { useThemeToggle } from "../composables/useThemeToggle";

const router = useRouter();
const auth = useAuthStore();
const email = ref("");
const password = ref("");
const { mode: themeMode, toggle: toggleTheme } = useThemeToggle();

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
  <LoginLayout brand="vZen Solutions">
    <div class="vz-login-card">
      <div class="vz-login-card__brand">
        <StatusDot color="red" :pulse="true" :size="8" />
        <span class="vz-login-card__brand-name">vZen Solutions</span>
        <ThemeToggle :mode="themeMode" @toggle="toggleTheme" />
      </div>

      <div v-if="auth.error" class="vz-login-card__error" role="alert">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          style="flex-shrink: 0"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M8 5v3.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
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
        <Button type="submit" :loading="auth.loading" :full-width="true"
          >Sign In</Button
        >
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
      <span>SAML 2.0 · OAuth 2.0 · OIDC</span>
      <span>vZen Solutions</span>
    </template>
  </LoginLayout>
</template>

<style scoped>
.vz-login-card {
  width: 100%;
  max-width: 380px;
  animation: vz-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes vz-fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.vz-login-card__brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.3rem;
}

.vz-login-card__brand-name {
  font-family: var(--vz-font-mono);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vz-text);
  flex: 1;
}

.vz-login-card__sub {
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  color: var(--vz-text3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 1.75rem;
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
