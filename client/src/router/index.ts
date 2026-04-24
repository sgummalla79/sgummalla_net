import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { useAuthStore } from "../stores/auth";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/auths",
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/auths",
    name: "auths",
    component: () => import("../views/AuthsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/configuration",
    name: "configuration",
    component: () => import("../views/ConfigurationView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("../views/ProfileView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/chainlit",
    name: "chainlit",
    component: () => import("../views/ChainlitView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/blog",
    name: "blog",
    component: () => import("../views/BlogView.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/blog/:slug",
    name: "blog-article",
    component: () => import("../views/BlogArticleView.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/auths",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// ── Navigation guard ──────────────────────────────────────────────────────────

router.beforeEach(async (to) => {
  // If a SAMLRequest lands on any Vue route, forward it to the server SSO endpoint
  if (to.query["SAMLRequest"]) {
    const params = new URLSearchParams();
    params.set("SAMLRequest", to.query["SAMLRequest"] as string);
    if (to.query["RelayState"])
      params.set("RelayState", to.query["RelayState"] as string);
    if (to.query["SigAlg"]) params.set("SigAlg", to.query["SigAlg"] as string);
    if (to.query["Signature"])
      params.set("Signature", to.query["Signature"] as string);
    window.location.href = `/api/saml/sso?${params.toString()}`;
    return false;
  }

  const auth = useAuthStore();

  // Bootstrap once — checks existing session cookie silently
  await auth.bootstrap();

  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !auth.isAuthenticated) {
    return { name: "login" };
  }

  if (!requiresAuth && auth.isAuthenticated && to.name === "login") {
    return { name: "auths" };
  }

  return true;
});

export default router;
