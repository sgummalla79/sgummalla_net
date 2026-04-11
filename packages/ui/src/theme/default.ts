import type { VzenTheme } from "./tokens";

export const defaultTheme: VzenTheme = {
  name: "vZen Dark",
  colors: {
    bg: "#0C0C0C",
    bg2: "#141414",
    surface: "rgba(255,255,255,0.05)",
    surface2: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.08)",
    border2: "rgba(255,255,255,0.12)",
    text: "#EFEFEF",
    text2: "rgba(255,255,255,0.6)",
    text3: "rgba(255,255,255,0.3)",
    navBg: "rgba(12,12,12,0.88)",
    green: "#5AE89A",
    greenDim: "rgba(90,232,154,0.1)",
    red: "#FF5A5A",
    redDim: "rgba(255,90,90,0.1)",
    symbolColor: "rgba(255,255,255,0.13)",
  },
  font: {
    sans: "'Inter', sans-serif",
    mono: "'Geist Mono', monospace",
    display: "'Bebas Neue', cursive",
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "10px",
  },
  tags: {
    jwt: { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.45)" },
    saml: { bg: "rgba(124,58,237,0.15)", text: "#A78BFA" },
    oidc: { bg: "rgba(37,99,235,0.15)", text: "#60A5FA" },
    auth0: { bg: "rgba(235,84,36,0.15)", text: "#FB923C" },
  },
};

export const lightTheme: VzenTheme = {
  name: "vZen Light",
  colors: {
    bg: "#F6F5F2",
    bg2: "#EEECEA",
    surface: "#FFFFFF",
    surface2: "#F0EEEB",
    border: "#E0DDD8",
    border2: "#CCCAC5",
    text: "#111111",
    text2: "#555550",
    text3: "#999990",
    navBg: "rgba(246,245,242,0.9)",
    green: "#1A7A45",
    greenDim: "rgba(26,122,69,0.08)",
    red: "#B83232",
    redDim: "rgba(184,50,50,0.08)",
    symbolColor: "rgba(0,0,0,0.07)",
  },
  font: {
    sans: "'Inter', sans-serif",
    mono: "'Geist Mono', monospace",
    display: "'Bebas Neue', cursive",
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "10px",
  },
  tags: {
    jwt: { bg: "rgba(0,0,0,0.06)", text: "#666" },
    saml: { bg: "rgba(124,58,237,0.08)", text: "#7C3AED" },
    oidc: { bg: "rgba(37,99,235,0.08)", text: "#2563EB" },
    auth0: { bg: "rgba(235,84,36,0.08)", text: "#EA580C" },
  },
};
