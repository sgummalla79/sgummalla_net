import { Router, type Request, type Response } from "express";
import neon from "../lib/db_neon.js";

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

export default router;
