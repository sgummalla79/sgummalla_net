<script lang="ts">
import { defineComponent, provide, ref, watch } from "vue";
import { defaultTheme } from "./default";
import { applyTheme, THEME_KEY } from "./plugin";
import type { VzenTheme } from "./tokens";

export default defineComponent({
  name: "ThemeProvider",

  props: {
    theme: {
      type: Object as () => VzenTheme,
      default: () => defaultTheme,
    },
  },

  setup(props) {
    const theme = ref<VzenTheme>(props.theme);
    const setTheme = (next: VzenTheme) => {
      theme.value = next;
    };

    provide(THEME_KEY, { theme, setTheme });
    watch(theme, (next) => applyTheme(next), { deep: true, immediate: true });

    return { theme, setTheme };
  },

  render() {
    return this.$slots.default?.();
  },
});
</script>
