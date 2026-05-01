<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps<{
  name?: string;
  email?: string;
  themeMode?: "dark" | "light";
  guest?: boolean;
  isOwner?: boolean;
}>();

defineEmits<{
  profile: [];
  configuration: [];
  "article-drafts": [];
  logout: [];
  "toggle-theme": [];
}>();

const open = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const isGuest = props.guest || !props.name;

const initials = isGuest
  ? ""
  : (props.name ?? "")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

function toggle() {
  open.value = !open.value;
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", handleClickOutside));
onUnmounted(() =>
  document.removeEventListener("mousedown", handleClickOutside),
);
</script>

<template>
  <div ref="containerRef" class="vz-avatar-wrap">
    <button class="vz-avatar-btn" :aria-expanded="open" @click="toggle">
      <!-- Brand icon — shown for both guest and authenticated users without a photo -->
      <img
        :src="
          themeMode === 'light' ? '/favicon-dark.png' : '/favicon-light.png'
        "
        alt="Profile"
        class="vz-avatar-icon"
      />
    </button>

    <transition name="vz-dropdown">
      <div v-if="open" class="vz-avatar-dropdown">
        <!-- Authenticated: user info header + profile + theme + logout -->
        <template v-if="!isGuest">
          <div class="vz-avatar-header">
            <div class="vz-avatar-header__initials">{{ initials }}</div>
            <div class="vz-avatar-header__info">
              <div class="vz-avatar-header__name">{{ name }}</div>
              <div class="vz-avatar-header__email">{{ email }}</div>
            </div>
          </div>
          <div class="vz-avatar-divider" />

          <button
            class="vz-avatar-item"
            @click="() => { open = false; $emit('profile'); }"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Profile
          </button>

          <button
            v-if="props.isOwner"
            class="vz-avatar-item"
            @click="() => { open = false; $emit('article-drafts'); }"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            Article Drafts
          </button>

          <button
            class="vz-avatar-item"
            @click="() => { open = false; $emit('configuration'); }"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configuration
          </button>
        </template>

        <!-- Theme toggle — always shown -->
        <button
          v-if="themeMode !== undefined"
          class="vz-avatar-item vz-avatar-item--theme"
          @click="() => { open = false; $emit('toggle-theme'); }"
        >
          <svg
            v-if="themeMode === 'dark'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
          <span class="vz-avatar-item__label">
            {{ themeMode === "dark" ? "Switch to Light" : "Switch to Dark" }}
          </span>
          <span class="vz-avatar-item__badge">
            {{ themeMode === "dark" ? "Dark" : "Light" }}
          </span>
        </button>

        <!-- Authenticated: logout -->
        <template v-if="!isGuest">
          <div class="vz-avatar-divider" />
          <button
            class="vz-avatar-item vz-avatar-item--danger"
            @click="
              () => {
                open = false;
                $emit('logout');
              }
            "
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.vz-avatar-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.vz-avatar-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.vz-avatar-btn:hover {
  border-color: var(--vz-text2);
  background: var(--vz-surface);
}

.vz-avatar-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

/* Dropdown */
.vz-avatar-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 220px;
  background: var(--vz-bg2);
  border: 1px solid var(--vz-border2);
  border-radius: var(--vz-radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  z-index: 100;
}

.vz-avatar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  background: var(--vz-surface);
}

.vz-avatar-header__initials {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--vz-text);
  flex-shrink: 0;
}

.vz-avatar-header__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vz-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vz-avatar-header__email {
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  color: var(--vz-text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vz-avatar-divider {
  height: 1px;
  background: var(--vz-border);
}

.vz-avatar-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 1rem;
  font-size: 0.875rem;
  font-family: var(--vz-font-sans);
  color: var(--vz-text2);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.12s,
    color 0.12s;
}

.vz-avatar-item:hover {
  background: var(--vz-surface);
  color: var(--vz-text);
}

.vz-avatar-item--danger:hover {
  color: var(--vz-red);
  background: var(--vz-red-dim);
}

.vz-avatar-item__label {
  flex: 1;
}

.vz-avatar-item__badge {
  font-family: var(--vz-font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vz-text3);
  background: var(--vz-surface2);
  border: 1px solid var(--vz-border);
  border-radius: 4px;
  padding: 0.1em 0.45em;
  line-height: 1.6;
}

.vz-avatar-item--theme:hover .vz-avatar-item__badge {
  border-color: var(--vz-border2);
  color: var(--vz-text2);
}

/* Transition */
.vz-dropdown-enter-active,
.vz-dropdown-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.vz-dropdown-enter-from,
.vz-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
