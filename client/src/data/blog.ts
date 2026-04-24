export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  tags: string[];
  description: string;
  content: string;
}

// Import article HTML bodies
import salesforceWidgetContent from "./articles/chainlit-salesforce";

export const articles: BlogArticle[] = [
  {
    id: "salesforce-widget-integration",
    slug: "salesforce-widget-integration",
    title: "Third-Party Widget Integration — Salesforce Experience Cloud",
    subtitle:
      "LWC · Visualforce · Canvas — Capabilities, Constraints & Recommendation",
    date: "April 24, 2026",
    tags: ["Salesforce", "Experience Cloud", "LWC", "LWS"],
    description:
      "A technical architecture reference for integrating any external third-party widget into Salesforce Experience Cloud. Covers LWC and Lightning Web Security constraints, the Visualforce full-screen overlay approach, Salesforce Canvas, and Head Markup injection — with a full capability matrix and a clear recommendation.",
    content: salesforceWidgetContent,
  },
];

export function findArticle(slug: string): BlogArticle | undefined {
  return articles.find((a) => a.slug === slug);
}
