<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps<{
  name: string;
  email: string;
  themeMode?: "dark" | "light";
}>();

defineEmits<{
  profile: [];
  logout: [];
  "toggle-theme": [];
}>();

const open = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const initials = props.name
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
      <span class="vz-avatar-initials">{{ initials }}</span>
    </button>

    <transition name="vz-dropdown">
      <div v-if="open" class="vz-avatar-dropdown">
        <!-- User info header -->
        <div class="vz-avatar-header">
          <div class="vz-avatar-header__initials">{{ initials }}</div>
          <div class="vz-avatar-header__info">
            <div class="vz-avatar-header__name">{{ name }}</div>
            <div class="vz-avatar-header__email">{{ email }}</div>
          </div>
        </div>

        <div class="vz-avatar-divider" />

        <!-- Menu items -->
        <button
          class="vz-avatar-item"
          @click="
            () => {
              open = false;
              $emit('profile');
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
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          Profile
        </button>

        <!-- Theme toggle -->
        <button
          v-if="themeMode !== undefined"
          class="vz-avatar-item vz-avatar-item--theme"
          @click="
            () => {
              $emit('toggle-theme');
            }
          "
        >
          <!-- Sun icon — shown when in dark mode, switching to light -->
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
          <!-- Moon icon — shown when in light mode, switching to dark -->
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

.vz-avatar-initials {
  font-family: var(--vz-font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--vz-text);
  user-select: none;
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
