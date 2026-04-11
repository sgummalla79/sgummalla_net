import { inject, ref, watch, type App, type InjectionKey, type Ref } from "vue";
import { cssVarMap, resolveThemeValue, type VzenTheme } from "./tokens";
import { defaultTheme } from "./default";

// ── Injection key ─────────────────────────────────────────────────────────────
export const THEME_KEY: InjectionKey<{
  theme: Ref<VzenTheme>;
  setTheme: (t: VzenTheme) => void;
}> = Symbol("vzen-theme");

// ── Apply theme tokens → CSS custom properties ────────────────────────────────
export function applyTheme(
  theme: VzenTheme,
  target: HTMLElement = document.documentElement,
): void {
  for (const [path, cssVar] of Object.entries(cssVarMap)) {
    const value = resolveThemeValue(theme, path);
    if (value !== "") {
      target.style.setProperty(cssVar, value);
    }
  }
}

// ── Vue plugin ────────────────────────────────────────────────────────────────
export const ThemePlugin = {
  install(app: App, options: { theme?: VzenTheme } = {}) {
    const theme = ref<VzenTheme>(options.theme ?? defaultTheme);
    applyTheme(theme.value);
    watch(theme, (next) => applyTheme(next), { deep: true });
    app.provide(THEME_KEY, {
      theme,
      setTheme: (next: VzenTheme) => {
        theme.value = next;
      },
    });
  },
};

// ── Composable ────────────────────────────────────────────────────────────────
export function useTheme() {
  const ctx = inject(THEME_KEY);
  if (!ctx) {
    throw new Error(
      "[vZen] useTheme() must be called inside a component tree where ThemePlugin is installed.",
    );
  }
  return ctx;
}
