<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useTheme } from "../theme/plugin";
import { defaultTheme, lightTheme } from "../theme/default";
import NavBar from "../components/NavBar.vue";
import NavLink from "../components/NavLink.vue";
import NavAvatar from "../components/NavAvatar.vue";
import SymbolLayer from "../components/SymbolLayer.vue";
import logoLight from "../assets/logo-light.svg";
import logoDark from "../assets/logo-dark.svg";

// ── Nav tiers — single source of truth ───────────────────────────────────────
// Add / remove items here only. No view should build its own nav list.

const OWNER_NAV = [
  { name: "auths", label: "Applications", href: "/auths" },
  { name: "configuration", label: "Configuration", href: "/configuration" },
  { name: "copilot-clients", label: "Clients", href: "/copilot-clients" },
  { name: "blog", label: "Blog", href: "/blog" },
];

const AUTH_NAV = [
  { name: "copilot-clients", label: "Clients", href: "/copilot-clients" },
  { name: "blog", label: "Blog", href: "/blog" },
];

const GUEST_NAV = [{ name: "blog", label: "Blog", href: "/blog" }];

const props = withDefaults(
  defineProps<{
    brand?: string;
    scrollable?: boolean;
    userName?: string;
    userEmail?: string;
    activePage?: string;
    isOwner?: boolean;
    isAuthenticated?: boolean;
    navLinks?: Array<{ name: string; label: string; href: string }>;
  }>(),
  {
    brand: "Sgummalla Works",
    scrollable: false,
    activePage: "",
    isOwner: false,
    isAuthenticated: false,
  },
);

const effectiveNavLinks = computed(
  () =>
    props.navLinks ??
    (props.isOwner ? OWNER_NAV : props.isAuthenticated ? AUTH_NAV : GUEST_NAV),
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
const THEME_STORAGE_KEY = "sgw-theme-mode";
const themeMode = ref<"dark" | "light">(
  (localStorage.getItem(THEME_STORAGE_KEY) as "dark" | "light") ?? "dark",
);
setTheme(themeMode.value === "light" ? lightTheme : defaultTheme);

function toggleTheme() {
  themeMode.value = themeMode.value === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, themeMode.value);
  setTheme(themeMode.value === "light" ? lightTheme : defaultTheme);
}

// ── Copilot sidebar ───────────────────────────────────────────────────────────

const copilotOpen = ref(false);
const copilotLoaded = ref(false);
const copilotPinned = ref(false);

function openCopilot() {
  copilotOpen.value = true;
  copilotLoaded.value = true;
}

function togglePin() {
  copilotPinned.value = !copilotPinned.value;
  if (copilotPinned.value) openCopilot();
}
</script>

<template>
  <div class="vz-shell" :class="{ 'vz-shell--scrollable': scrollable }">
    <SymbolLayer />

    <NavBar dot-color="green">
      <template #brand>
        <div class="vz-nav-brand-inner">
          <img
            :src="themeMode === 'light' ? logoLight : logoDark"
            alt="Sgummalla Works"
            class="vz-nav-logo"
          />
          <span class="vz-nav-slogan"
            >Ideas in Motion, Think. Build. Demo.</span
          >
        </div>
      </template>
      <template #links>
        <NavLink
          v-for="link in effectiveNavLinks"
          :key="link.name"
          :href="link.href"
          :active="activePage === link.name"
        >
          {{ link.label }}
        </NavLink>
        <button
          v-if="isAuthenticated"
          class="vz-nav-link vz-nav-copilot-btn"
          :class="{ 'vz-nav-link--active': copilotOpen }"
          title="AI Copilot"
          @click="copilotOpen && !copilotPinned ? copilotOpen = false : openCopilot()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </button>
      </template>

      <template #right>
        <a v-if="!userName" href="/login" class="vz-nav-signin">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10,17 15,12 10,7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Sign In
        </a>
        <NavAvatar
          v-bind="
            userName && userEmail ? { name: userName, email: userEmail } : {}
          "
          :guest="!userName"
          :theme-mode="themeMode"
          @profile="handleProfile"
          @logout="emit('logout')"
          @toggle-theme="toggleTheme"
        />
      </template>
    </NavBar>

    <!-- Body — sidebar sits beside main so content adjusts rather than overlaps -->
    <div class="vz-shell__body">
      <main class="vz-shell__main">
        <slot />
      </main>

      <div
        v-if="isAuthenticated && copilotLoaded"
        class="vz-copilot-sidebar"
        :class="{ 'vz-copilot-sidebar--open': copilotOpen }"
      >
          <div class="vz-copilot-header">
            <span class="vz-copilot-title">AI Copilot</span>
            <div class="vz-copilot-actions">
              <button
                class="vz-copilot-pin"
                :class="{ 'vz-copilot-pin--active': copilotPinned }"
                :title="copilotPinned ? 'Unpin' : 'Pin'"
                @click="togglePin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22" />
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                </svg>
              </button>
              <button class="vz-copilot-close" @click="copilotOpen = false; copilotPinned = false">✕</button>
            </div>
          </div>
          <iframe
            src="/copilot/"
            class="vz-copilot-frame"
            allow="microphone"
          />
        </div>
    </div>

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
.vz-nav-brand-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
}

.vz-nav-logo {
  height: 26px;
  width: auto;
  display: block;
  object-fit: contain;
}

.vz-nav-signin {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--vz-font-sans);
  font-size: 0.825rem;
  font-weight: 500;
  color: var(--vz-green);
  text-decoration: none;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--vz-green);
  border-radius: var(--vz-radius-md);
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
  white-space: nowrap;
}

.vz-nav-signin:hover {
  color: var(--vz-bg);
  background: var(--vz-green);
  border-color: var(--vz-green);
}

.vz-nav-slogan {
  font-family: var(--vz-font-sans);
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--vz-text3);
  white-space: nowrap;
}

.vz-nav-copilot-btn {
  background: none;
  border: none;
  cursor: pointer;
  margin-left: auto;
  padding: 0 0.75rem;
}

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
  overflow-x: hidden;
  overflow-y: auto;
}

.vz-shell__body {
  display: flex;
  flex-direction: row;
  overflow: hidden;
  z-index: 1;
  min-height: 0;
}

.vz-shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  overflow: hidden;
  box-sizing: border-box;
}

.vz-shell--scrollable .vz-shell__body {
  overflow-y: auto;
}

.vz-shell--scrollable .vz-shell__main {
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

/* ── Copilot sidebar ─────────────────────────────────────────────────────── */

.vz-copilot-sidebar {
  width: 0;
  flex-shrink: 0;
  background: var(--vz-bg);
  border-left: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 200;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.vz-copilot-sidebar--open {
  width: 380px;
  border-left: 1px solid var(--vz-border);
}

.vz-copilot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--vz-border);
  flex-shrink: 0;
}

.vz-copilot-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.vz-copilot-pin {
  background: none;
  border: none;
  color: var(--vz-text3);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--vz-radius-sm);
  transition: color 0.15s, background 0.15s;
  line-height: 1;
  display: flex;
  align-items: center;
}

.vz-copilot-pin:hover {
  color: var(--vz-text);
  background: var(--vz-surface2);
}

.vz-copilot-pin--active {
  color: var(--vz-green);
}

.vz-copilot-pin--active:hover {
  color: var(--vz-green);
}

.vz-copilot-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vz-text);
  letter-spacing: 0.01em;
}

.vz-copilot-close {
  background: none;
  border: none;
  color: var(--vz-text3);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--vz-radius-sm);
  transition: color 0.15s, background 0.15s;
  line-height: 1;
}

.vz-copilot-close:hover {
  color: var(--vz-text);
  background: var(--vz-surface2);
}

.vz-copilot-frame {
  flex: 1;
  border: none;
  width: 100%;
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
  .vz-copilot-sidebar--open {
    width: 100vw;
  }
}
</style>
