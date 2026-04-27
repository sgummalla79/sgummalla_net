# Article Writing Guide

Guidelines for writing and publishing blog articles on sgummalla.net.

---

## Content Policy

- **GA features only** — cover Generally Available (GA) features only. Never disclose pre-release, beta, roadmap, or confidential information.
- **No confidential information** — never publish proprietary, internal, or non-public company information.
- **Align with official documentation** — content must be consistent with public-facing product documentation.
- **Share responsibly** — follow the organisation's Share Article URLs in Channels guidelines when distributing article links.

---

## Disclaimer

Every article automatically displays the following disclaimer at the bottom — no manual action needed. It is rendered by `BlogArticleView.vue`:

> The information in this article is based on generally available (GA) features and publicly accessible documentation at the time of publication. It does not represent official guidance from any employer or organisation and does not disclose any confidential, pre-release, or proprietary information. Product features, behaviour, and documentation may change over time. Please refer to the latest official documentation and verify all information before making any technical or business decisions.

---

## Terminology — Use Neutral Language

Avoid prescriptive or opinionated language. Use neutral, architectural framing instead:

| Avoid | Use instead |
|---|---|
| Recommendation | Architecture Guidance / Integration Approach |
| Decision | Architecture Guidance |
| Primary Recommendation | Primary Approach |
| I recommend | This approach suits / This pattern works well for |
| You should | Consider / This is suited to |
| Best practice | Common pattern / Established approach |

---

## Font Sizes

Use these sizes in the article CSS (`BlogArticleView.vue`):

| Element | Size |
|---|---|
| Base body text | 16px |
| Content text (callout, grid, flow, decision-tree) | 15px |
| Small content (step detail, pros/cons li, option-card li) | 14px |
| Section title | 24px |
| Doc header h1 | 32px |
| Doc header subtitle | 16px |
| Approach/guidance h3 | 22px |
| Option card h4 | 16px |
| Uppercase decorative labels (section-label, meta-tag, badge) | 10–12px (intentionally small) |
| LWS diagram / ASCII art code blocks | 13px (structured layout, leave as-is) |
| Line height | 1.8 |

---

## Article Structure

- Add a `date` field in `client/src/data/blog.ts` — displayed automatically as "Published [date]"
- Section labels follow the pattern `NN — Section Name` (e.g. `07 — Architecture Guidance`)
- Each section uses `section-label` (small uppercase) + `section-title` (large heading)
- Use `callout` blocks (info / warning / danger / success) for important notes
- Use `decision-tree` for if/then guidance — avoid framing it as personal decisions

---

## Adding a New Article

1. Create `client/src/data/articles/<slug>.ts` exporting an HTML string
2. Add the article entry to `client/src/data/blog.ts`
3. Follow the font sizes and terminology guidelines above
4. The disclaimer and published date are rendered automatically — no need to include them in the HTML
