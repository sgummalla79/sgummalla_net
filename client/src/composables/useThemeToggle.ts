import { ref } from "vue";
import { useTheme, defaultTheme, lightTheme } from "@vzen/ui";

export function useThemeToggle() {
  const mode = ref<"dark" | "light">("dark");
  const { setTheme } = useTheme();

  function toggle() {
    mode.value = mode.value === "dark" ? "light" : "dark";
    setTheme(mode.value === "light" ? lightTheme : defaultTheme);
  }

  return { mode, toggle };
}
