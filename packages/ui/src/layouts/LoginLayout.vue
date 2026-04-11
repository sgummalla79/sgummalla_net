<script setup lang="ts">
import SymbolLayer from "../components/SymbolLayer.vue";

withDefaults(
  defineProps<{
    brand?: string;
  }>(),
  {
    brand: "vZen Solutions",
  },
);
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
        <span>{{ brand }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.vz-login-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--vz-bg, #0c0c0c);
  color: var(--vz-text, #efefef);
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
  z-index: 1;
}

.vz-login-page__footer {
  position: relative;
  z-index: 1;
  padding: 1rem 2rem;
  font-family: "Geist Mono", monospace;
  font-size: 0.69rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3, rgba(255, 255, 255, 0.3));
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--vz-border, rgba(255, 255, 255, 0.08));
}
</style>
