import { Router, type Request, type Response } from "express";
import neon from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router: import("express").Router = Router();

// ── GET /api/articles ─────────────────────────────────────────────────────────
// Returns list without content (for blog index)

router.get("/", async (_req: Request, res: Response) => {
  const articles = await neon<
    {
      slug: string;
      title: string;
      subtitle: string;
      date: string;
      tags: string[];
      description: string;
    }[]
  >`
    SELECT slug, title, subtitle, date, tags, description
    FROM articles
    WHERE published = true
    ORDER BY created_at DESC
  `;
  res.json(articles);
});

// ── GET /api/articles/:slug ───────────────────────────────────────────────────
// Returns single article with full content

router.get("/:slug", async (req: Request, res: Response) => {
  const [article] = await neon<
    {
      slug: string;
      title: string;
      subtitle: string;
      date: string;
      tags: string[];
      description: string;
      content: string;
    }[]
  >`
    SELECT slug, title, subtitle, date, tags, description, content
    FROM articles
    WHERE slug = ${req.params.slug}
      AND published = true
  `;
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(article);
});

// ── GET /api/articles/drafts ──────────────────────────────────────────────────
// Owner only — list unpublished articles

router.get("/drafts", requireAuth, async (_req: Request, res: Response) => {
  const articles = await neon<
    {
      slug: string;
      title: string;
      subtitle: string;
      date: string;
      tags: string[];
      description: string;
    }[]
  >`
    SELECT slug, title, subtitle, date, tags, description
    FROM articles
    WHERE published = false
    ORDER BY created_at DESC
  `;
  res.json(articles);
});

// ── GET /api/articles/drafts/:slug ────────────────────────────────────────────
// Owner only — single draft with full content for preview

router.get("/drafts/:slug", requireAuth, async (req: Request, res: Response) => {
  const [article] = await neon<
    {
      slug: string;
      title: string;
      subtitle: string;
      date: string;
      tags: string[];
      description: string;
      content: string;
    }[]
  >`
    SELECT slug, title, subtitle, date, tags, description, content
    FROM articles
    WHERE slug = ${req.params.slug}
      AND published = false
  `;
  if (!article) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  res.json(article);
});

// ── PATCH /api/articles/drafts/:slug/publish ──────────────────────────────────
// Owner only — publish a draft article

router.patch("/drafts/:slug/publish", requireAuth, async (req: Request, res: Response) => {
  const result = await neon`
    UPDATE articles
    SET published  = true,
        updated_at = now()
    WHERE slug    = ${req.params.slug}
      AND published = false
    RETURNING slug
  `;
  if (result.length === 0) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  res.json({ ok: true, slug: req.params.slug });
});

export default router;
