/**
 * Converts a URL to its Jina markdown URL equivalent
 */
export function getJinaUrl(url: string): string {
  const jinaPrefix = 'https://r.jina.ai/';
  return url.startsWith(jinaPrefix) ? url : `${jinaPrefix}${url}`;
}

/**
 * Fetches markdown content from a URL using Jina
 */
export async function getMarkdownFromUrl(url: string): Promise<string> {
  const jinaUrl = getJinaUrl(url);
  const response = await fetch(jinaUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch markdown from ${jinaUrl}: ${response.statusText}`);
  }
  return response.text();
}
