<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useTheme } from "../theme/plugin";
import { defaultTheme, lightTheme } from "../theme/default";
import NavBar from "../components/NavBar.vue";
import NavLink from "../components/NavLink.vue";
import NavAvatar from "../components/NavAvatar.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import SymbolLayer from "../components/SymbolLayer.vue";

const props = withDefaults(
  defineProps<{
    brand?: string;
    scrollable?: boolean;
    userName?: string;
    userEmail?: string;
    activePage?: string;
    navLinks?: Array<{ name: string; label: string; href: string }>;
  }>(),
  {
    brand: "vZen Solutions",
    scrollable: false,
    activePage: "",
    navLinks: () => [
      { name: "home", label: "Home", href: "/home" },
      { name: "auths", label: "Applications", href: "/auths" },
      { name: "configuration", label: "Configuration", href: "/configuration" },
    ],
  },
);

const emit = defineEmits<{
  logout: [];
  profile: [];
}>();

const router = useRouter();

function handleProfile() {
  emit("profile");
  router.push("/profile");
}

const { setTheme } = useTheme();
const THEME_STORAGE_KEY = "vzen-theme-mode";
const themeMode = ref<"dark" | "light">(
  (localStorage.getItem(THEME_STORAGE_KEY) as "dark" | "light") ?? "dark",
);
setTheme(themeMode.value === "light" ? lightTheme : defaultTheme);

function toggleTheme() {
  themeMode.value = themeMode.value === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, themeMode.value);
  setTheme(themeMode.value === "light" ? lightTheme : defaultTheme);
}
</script>

<template>
  <div class="vz-shell" :class="{ 'vz-shell--scrollable': scrollable }">
    <SymbolLayer />

    <NavBar :brand="brand ?? 'vZen Solutions'" dot-color="green">
      <template #links>
        <NavLink
          v-for="link in props.navLinks"
          :key="link.name"
          :href="link.href"
          :active="activePage === link.name"
        >
          {{ link.label }}
        </NavLink>
      </template>

      <template #right>
        <ThemeToggle :mode="themeMode" @toggle="toggleTheme" />
        <NavAvatar
          v-if="userName && userEmail"
          :name="userName"
          :email="userEmail"
          @profile="handleProfile"
          @logout="emit('logout')"
        />
      </template>
    </NavBar>

    <main class="vz-shell__main">
      <slot />
    </main>

    <footer class="vz-shell__footer">
      <slot name="footer">
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
