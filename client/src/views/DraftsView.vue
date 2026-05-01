<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import { listDrafts, type Article } from "../api/articles";

const router = useRouter();
const auth = useAuthStore();
const drafts = ref<Article[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    drafts.value = await listDrafts();
  } finally {
    loading.value = false;
  }
});

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "login" });
}
</script>

<template>
  <AppLayout
    active-page="drafts"
    :is-owner="auth.isOwner"
    :is-authenticated="auth.isAuthenticated"
    :user-name="auth.fullName"
    :user-email="auth.email"
    :scrollable="true"
    @profile="router.push({ name: 'profile' })"
    @logout="handleLogout"
  >
    <div class="vz-drafts">
      <div class="vz-drafts__header">
        <h1 class="vz-drafts__title">Drafts</h1>
        <p class="vz-drafts__sub">
          Unpublished articles — preview and publish when ready.
        </p>
      </div>

      <div v-if="loading" class="vz-drafts__empty">Loading…</div>
      <div v-else-if="drafts.length === 0" class="vz-drafts__empty">
        No drafts — all articles are published.
      </div>

      <div v-else class="vz-drafts__list">
        <article
          v-for="draft in drafts"
          :key="draft.slug"
          class="vz-drafts__item"
          @click="router.push(`/drafts/${draft.slug}`)"
        >
          <div class="vz-drafts__item-top">
            <span class="vz-drafts__badge">Draft</span>
            <span class="vz-drafts__date">{{ draft.date }}</span>
            <div class="vz-drafts__tags">
              <span
                v-for="tag in draft.tags"
                :key="tag"
                class="vz-drafts__tag"
                >{{ tag }}</span
              >
            </div>
          </div>
          <h2 class="vz-drafts__item-title">{{ draft.title }}</h2>
          <p class="vz-drafts__item-subtitle">{{ draft.subtitle }}</p>
          <p class="vz-drafts__item-desc">{{ draft.description }}</p>
          <div class="vz-drafts__preview-link">Preview & Publish →</div>
        </article>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-drafts {
  width: 100%;
  max-width: 860px;
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

.vz-drafts__header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--vz-border);
}

.vz-drafts__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  line-height: 1;
  margin-bottom: 0.4rem;
}

.vz-drafts__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
}

.vz-drafts__empty {
  color: var(--vz-text3);
  font-size: 0.875rem;
  padding: 2rem 0;
}

.vz-drafts__list {
  display: flex;
  flex-direction: column;
}

.vz-drafts__item {
  padding: 2rem 0;
  border-bottom: 1px solid var(--vz-border);
  cursor: pointer;
  transition: opacity 0.15s;
}

.vz-drafts__item:last-child {
  border-bottom: none;
}

.vz-drafts__item:hover .vz-drafts__item-title {
  opacity: 0.8;
}

.vz-drafts__item-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.vz-drafts__badge {
  font-family: var(--vz-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: var(--vz-radius-sm);
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.vz-drafts__date {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--vz-text3);
  text-transform: uppercase;
}

.vz-drafts__tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.vz-drafts__tag {
  font-family: var(--vz-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: var(--vz-radius-sm);
  background: var(--vz-surface2);
  color: var(--vz-text3);
  border: 1px solid var(--vz-border);
}

.vz-drafts__item-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--vz-text);
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
  line-height: 1.35;
  transition: opacity 0.15s;
}

.vz-drafts__item-subtitle {
  font-size: 0.75rem;
  color: var(--vz-text3);
  margin-bottom: 0.6rem;
  font-family: var(--vz-font-mono);
  letter-spacing: 0.02em;
}

.vz-drafts__item-desc {
  font-size: 0.9rem;
  color: var(--vz-text2);
  line-height: 1.65;
  margin-bottom: 1rem;
  max-width: 680px;
}

.vz-drafts__preview-link {
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: #f59e0b;
  opacity: 0.8;
}
</style>
