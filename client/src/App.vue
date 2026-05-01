<script setup lang="ts">
// Route-level transitions — no imports needed here
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <transition name="page">
      <component :is="Component" :key="route.path" />
    </transition>
  </router-view>
</template>
