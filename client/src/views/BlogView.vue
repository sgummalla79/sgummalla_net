<script setup lang="ts">
import { useRouter } from "vue-router";
import { AppLayout } from "@sgw/ui";
import { useAuthStore } from "../stores/auth";
import { articles } from "../data/blog";

const router = useRouter();
const auth = useAuthStore();

async function handleLogout() {
  await auth.logout();
  await router.push({ name: "home" });
}
</script>

<template>
  <AppLayout
    active-page="blog"
    :is-owner="auth.isOwner"
    :is-authenticated="auth.isAuthenticated"
    :user-name="auth.fullName"
    :user-email="auth.email"
    :scrollable="true"
    @profile="router.push({ name: 'profile' })"
    @logout="handleLogout"
  >
    <div class="vz-blog">
      <div class="vz-blog__header">
        <h1 class="vz-blog__title">Blog</h1>
        <p class="vz-blog__sub">Technical articles and architecture guides.</p>
      </div>

      <div class="vz-blog__list">
        <article
          v-for="article in articles"
          :key="article.id"
          class="vz-blog__item"
          @click="router.push(`/blog/${article.slug}`)"
        >
          <div class="vz-blog__item-top">
            <span class="vz-blog__date">{{ article.date }}</span>
            <div class="vz-blog__tags">
              <span
                v-for="tag in article.tags"
                :key="tag"
                class="vz-blog__tag"
                >{{ tag }}</span
              >
            </div>
          </div>
          <h2 class="vz-blog__item-title">{{ article.title }}</h2>
          <p class="vz-blog__item-subtitle">{{ article.subtitle }}</p>
          <p class="vz-blog__item-desc">{{ article.description }}</p>
          <div class="vz-blog__read">Read article →</div>
        </article>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.vz-blog {
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

.vz-blog__header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--vz-border);
}

.vz-blog__title {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--vz-text);
  line-height: 1;
  margin-bottom: 0.4rem;
}

.vz-blog__sub {
  font-size: 0.92rem;
  color: var(--vz-text2);
}

.vz-blog__list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.vz-blog__item {
  padding: 2rem 0;
  border-bottom: 1px solid var(--vz-border);
  cursor: pointer;
  transition: background 0.15s;
}

.vz-blog__item:last-child {
  border-bottom: none;
}

.vz-blog__item:hover .vz-blog__item-title {
  color: var(--vz-text);
  opacity: 0.8;
}

.vz-blog__item:hover .vz-blog__read {
  opacity: 1;
}

.vz-blog__item-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.vz-blog__date {
  font-family: var(--vz-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--vz-text3);
  text-transform: uppercase;
}

.vz-blog__tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.vz-blog__tag {
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

.vz-blog__item-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--vz-text);
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
  line-height: 1.35;
  transition: opacity 0.15s;
}

.vz-blog__item-subtitle {
  font-size: 0.85rem;
  color: var(--vz-text3);
  margin-bottom: 0.6rem;
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

.vz-blog__item-desc {
  font-size: 0.9rem;
  color: var(--vz-text2);
  line-height: 1.65;
  margin-bottom: 1rem;
  max-width: 680px;
}

.vz-blog__read {
  font-family: var(--vz-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--vz-text3);
  opacity: 0.6;
  transition: opacity 0.15s;
}
</style>
