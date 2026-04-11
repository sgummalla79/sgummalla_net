// ── Theme system ─────────────────────────────────────────────────────────────
export type { VzenTheme } from "./theme/tokens";
export { cssVarMap, resolveThemeValue } from "./theme/tokens";
export { defaultTheme, lightTheme } from "./theme/default";
export { ThemePlugin, useTheme, THEME_KEY, applyTheme } from "./theme/plugin";
export { default as ThemeProvider } from "./theme/ThemeProvider.vue";

// ── Components ───────────────────────────────────────────────────────────────
export * from "./components/index";

// ── Layouts (added in Module 4) ───────────────────────────────────────────────
// export * from './layouts/index'
