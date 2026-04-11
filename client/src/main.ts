import { createApp } from "vue";
import { createPinia } from "pinia";
import { ThemePlugin, defaultTheme } from "@vzen/ui";
import "virtual:uno.css";
import "./assets/css/base.css";

import App from "./App.vue";
import router from "./router/index";

const app = createApp(App);

// ── Pinia ─────────────────────────────────────────────────────────────────────
app.use(createPinia());

// ── Theme ─────────────────────────────────────────────────────────────────────
// Swap defaultTheme for any VzenTheme to change the entire app appearance
app.use(ThemePlugin, { theme: defaultTheme });

// ── Router ────────────────────────────────────────────────────────────────────
app.use(router);

app.mount("#app");
