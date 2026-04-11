<script setup lang="ts">
import SymbolLayer from "../components/SymbolLayer.vue";

defineProps<{
  brand?: string;
  themeMode?: "dark" | "light";
}>();

defineEmits<{ "toggle-theme": [] }>();
</script>

<template>
  <div class="vz-login-page">
    <SymbolLayer />

    <div class="vz-login-page__main">
      <slot />
    </div>

    <div class="vz-login-page__footer">
      <slot name="footer">
        <span>SAML 2.0 · OAuth 2.0 · OIDC</span>
        <span>{{ brand ?? "vZen Solutions" }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.vz-login-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--vz-bg);
  position: relative;
  overflow: hidden;
}

.vz-login-page__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  z-index: 2;
}

.vz-login-page__footer {
  position: relative;
  z-index: 2;
  padding: 1rem 2rem;
  font-family: var(--vz-font-mono);
  font-size: 0.69rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--vz-border);
}

@media (max-width: 520px) {
  .vz-login-page {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .vz-login-page__main {
    padding: 1.5rem 1.25rem;
    align-items: flex-start;
  }
}
</style>
