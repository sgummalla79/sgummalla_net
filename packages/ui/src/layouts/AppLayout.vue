<script setup lang="ts">
import NavBar from "../components/NavBar.vue";
import SymbolLayer from "../components/SymbolLayer.vue";

const props = withDefaults(
  defineProps<{
    brand?: string;
    activePage?: string;
    themeMode?: "dark" | "light";
    userLabel?: string;
    scrollable?: boolean;
  }>(),
  {
    brand: "vZen Solutions",
    activePage: "",
    themeMode: "dark",
    scrollable: false,
  },
);

defineEmits<{ "toggle-theme": []; logout: [] }>();
</script>

<template>
  <div class="vz-shell" :class="{ 'vz-shell--scrollable': props.scrollable }">
    <SymbolLayer />

    <NavBar
      :brand="props.brand"
      dot-color="green"
      @toggle-theme="$emit('toggle-theme')"
    >
      <template #links>
        <slot name="nav-links" />
      </template>
      <template #right>
        <span v-if="props.userLabel" class="vz-shell__user-label">{{
          props.userLabel
        }}</span>
        <slot name="nav-right" />
      </template>
    </NavBar>

    <main class="vz-shell__main">
      <slot />
    </main>

    <footer class="vz-shell__footer">
      <slot name="footer">
        <span class="vz-shell__footer-left"
          >vZen Solutions · Identity Gateway</span
        >
        <div class="vz-shell__footer-right">
          <span class="vz-shell__footer-dot" />
          Live
        </div>
      </slot>
    </footer>
  </div>
</template>

<style scoped>
.vz-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: var(--vz-bg, #0c0c0c);
  position: relative;
  overflow: hidden;
}

/* Scrollable variant — for pages like AuthsView */
.vz-shell--scrollable {
  height: auto;
  min-height: 100vh;
  overflow: visible;
}

.vz-shell__main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  overflow: hidden;
}

.vz-shell--scrollable .vz-shell__main {
  overflow: visible;
  align-items: flex-start;
  padding: 3rem 2rem 4rem;
}

.vz-shell__user-label {
  font-family: var(--vz-font-mono, monospace);
  font-size: 0.82rem;
  color: var(--vz-text, #efefef);
}

.vz-shell__footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 2rem;
  border-top: 1px solid var(--vz-border, rgba(255, 255, 255, 0.08));
}

.vz-shell__footer-left {
  font-family: var(--vz-font-mono, monospace);
  font-size: 0.69rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vz-text3, rgba(255, 255, 255, 0.3));
}

.vz-shell__footer-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--vz-font-mono, monospace);
  font-size: 0.69rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vz-text3, rgba(255, 255, 255, 0.3));
}

.vz-shell__footer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vz-green, #5ae89a);
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

@media (max-width: 680px) {
  .vz-shell {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .vz-shell__main {
    padding: 1.75rem 1.25rem;
    align-items: flex-start;
  }
  .vz-shell__footer {
    padding: 0.85rem 1.25rem;
  }
}
</style>
