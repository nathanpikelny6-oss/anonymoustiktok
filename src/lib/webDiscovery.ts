const TIKTOK_VIDEO =
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d+)/gi;

function normalizeTikTokUrl(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

function extractVideoUrls(text: string): string[] {
  const urls = new Set<string>();
  for (const match of text.matchAll(TIKTOK_VIDEO)) {
    const username = match[1];
    const id = match[2];
    if (username && id) {
      urls.add(normalizeTikTokUrl(username, id));
    }
  }
  return [...urls];
}

async function fetchDdgLiteMarkdown(query: string): Promise<string> {
  const ddg = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const reader = `https://r.jina.ai/${ddg}`;
  const res = await fetch(reader, {
    headers: { Accept: "text/markdown" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`Web search unavailable (${res.status})`);
  }
  return res.text();
}

/** Find TikTok video page URLs via DuckDuckGo (through a reader proxy). */
export async function findTikTokVideoUrls(
  keyword: string,
  limit = 16,
): Promise<string[]> {
  const q = `site:tiktok.com ${keyword}`;
  const md = await fetchDdgLiteMarkdown(q);
  return extractVideoUrls(md).slice(0, limit);
}

export async function findUserVideoUrls(
  username: string,
  limit = 24,
): Promise<string[]> {
  const q = `site:tiktok.com/@${username}/video`;
  const md = await fetchDdgLiteMarkdown(q);
  const filtered = extractVideoUrls(md).filter((u) =>
    u.toLowerCase().includes(`/@${username.toLowerCase()}/`),
  );
  return filtered.slice(0, limit);
}