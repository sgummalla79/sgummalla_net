import client from "./client";

export interface Article {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  tags: string[];
  description: string;
  content?: string;
}

export async function listArticles(): Promise<Article[]> {
  const { data } = await client.get<Article[]>("/articles");
  return data;
}

export async function getArticle(slug: string): Promise<Article> {
  const { data } = await client.get<Article>(`/articles/${slug}`);
  return data;
}
