const TIKTOK_VIDEO_PATH =
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d+)/gi;

const UDDG_PARAM = /uddg=([^&\s")]+)/gi;

function normalizeTikTokUrl(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

function addVideoUrl(urls: Set<string>, raw: string): void {
  const match = raw.match(
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d+)/i,
  );
  if (!match) return;
  urls.add(normalizeTikTokUrl(match[1], match[2]));
}

export function extractVideoUrls(text: string): string[] {
  const urls = new Set<string>();

  for (const match of text.matchAll(TIKTOK_VIDEO_PATH)) {
    addVideoUrl(urls, match[0]);
  }

  for (const match of text.matchAll(UDDG_PARAM)) {
    try {
      addVideoUrl(urls, decodeURIComponent(match[1]));
    } catch {
      /* ignore malformed redirects */
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

async function collectFromQuery(
  query: string,
  into: Set<string>,
  limit: number,
): Promise<void> {
  if (into.size >= limit) return;
  const md = await fetchDdgLiteMarkdown(query);
  for (const url of extractVideoUrls(md)) {
    into.add(url);
    if (into.size >= limit) break;
  }
}

/** Find TikTok video page URLs via DuckDuckGo (through a reader proxy). */
export async function findTikTokVideoUrls(
  keyword: string,
  limit = 16,
): Promise<string[]> {
  const trimmed = keyword.trim();
  const queries = [
    `site:tiktok.com inurl:video ${trimmed}`,
    `site:tiktok.com ${trimmed}`,
  ];

  const urls = new Set<string>();
  for (const q of queries) {
    try {
      await collectFromQuery(q, urls, limit);
    } catch {
      /* try next query shape */
    }
    if (urls.size >= limit) break;
  }

  return [...urls].slice(0, limit);
}

export async function findUserVideoUrls(
  username: string,
  limit = 24,
): Promise<string[]> {
  const queries = [
    `site:tiktok.com/@${username}/video`,
    `site:tiktok.com inurl:video @${username}`,
  ];
  const urls = new Set<string>();
  for (const q of queries) {
    try {
      await collectFromQuery(q, urls, limit * 2);
    } catch {
      /* continue */
    }
  }
  const filtered = [...urls].filter((u) =>
    u.toLowerCase().includes(`/@${username.toLowerCase()}/`),
  );
  return filtered.slice(0, limit);
}