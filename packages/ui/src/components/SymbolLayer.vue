<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Show or hide individual symbols */
    showPi?: boolean;
    showInfinity?: boolean;
    showPhi?: boolean;
    showAtom?: boolean;
  }>(),
  {
    showPi: true,
    showInfinity: true,
    showPhi: true,
    showAtom: true,
  },
);
</script>

<template>
  <!-- π — top left -->
  <div v-if="showPi" class="vz-symbol vz-symbol--pi" aria-hidden="true">π</div>

  <!-- ∞ — middle right -->
  <div
    v-if="showInfinity"
    class="vz-symbol vz-symbol--infinity"
    aria-hidden="true"
  >
    ∞
  </div>

  <!-- φ — bottom left -->
  <div v-if="showPhi" class="vz-symbol vz-symbol--phi" aria-hidden="true">
    φ
  </div>

  <!-- atom — top right (SVG) -->
  <div v-if="showAtom" class="vz-symbol vz-symbol--atom" aria-hidden="true">
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <ellipse
        cx="100"
        cy="100"
        rx="90"
        ry="30"
        fill="none"
        stroke="currentColor"
        stroke-width="5"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="90"
        ry="30"
        fill="none"
        stroke="currentColor"
        stroke-width="5"
        transform="rotate(60 100 100)"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="90"
        ry="30"
        fill="none"
        stroke="currentColor"
        stroke-width="5"
        transform="rotate(120 100 100)"
      />
      <circle cx="100" cy="100" r="14" fill="currentColor" />
      <circle cx="100" cy="70" r="7" fill="currentColor" />
      <circle cx="178" cy="145" r="7" fill="currentColor" />
      <circle cx="22" cy="145" r="7" fill="currentColor" />
    </svg>
  </div>
</template>

<style scoped>
.vz-symbol {
  position: absolute;
  pointer-events: none;
  user-select: none;
  z-index: 0;
  font-family: var(--vz-font-display);
  line-height: 1;
  color: var(--vz-symbol-color);
}

/* π — top left */
.vz-symbol--pi {
  font-size: 680px;
  left: -100px;
  top: -20%;
  transform: rotate(-10deg);
}

/* ∞ — middle right */
.vz-symbol--infinity {
  font-size: 680px;
  right: -120px;
  top: 60%;
  transform: translateY(-50%) rotate(-15deg);
}

/* φ — bottom left */
.vz-symbol--phi {
  font-size: 520px;
  bottom: -80px;
  left: -40px;
  transform: rotate(-10deg);
}

/* atom — top right */
.vz-symbol--atom {
  width: 480px;
  height: 480px;
  top: -60px;
  right: -60px;
  transform: rotate(15deg);
  opacity: 0.13;
  color: var(--vz-text);
}

/* Responsive */
@media (max-width: 680px) {
  .vz-symbol--pi {
    font-size: 360px;
    left: -60px;
  }

  .vz-symbol--infinity {
    font-size: 360px;
    right: -60px;
  }

  .vz-symbol--phi {
    font-size: 280px;
    left: -30px;
    bottom: -40px;
  }

  .vz-symbol--atom {
    width: 260px;
    height: 260px;
    right: -30px;
    top: -30px;
  }
}
</style>
