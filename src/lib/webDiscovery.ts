export type VideoStub = {
  url: string;
  desc: string;
};

const TIKTOK_VIDEO_PATH =
  /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d+)/gi;

const UDDG_PARAM = /uddg=([^&\s")]+)/gi;

const RESULT_TITLE = /^\d+\.\[(.+?)\]\(/;

function normalizeTikTokUrl(username: string, videoId: string): string {
  return `https://www.tiktok.com/@${username}/video/${videoId}`;
}

function stubKey(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? url;
}

function snippetForLine(lines: string[], index: number): string {
  for (let j = index - 1; j >= Math.max(0, index - 5); j--) {
    const line = lines[j].trim();
    if (!line || line.startsWith("http") || line.includes("uddg=")) continue;
    const numbered = line.match(RESULT_TITLE);
    if (numbered) return numbered[1].replace(/\*\*/g, "").trim();
    if (line.length > 24 && line.length < 280) {
      return line.replace(/\*\*/g, "").trim();
    }
  }
  return "";
}

export function extractVideoStubs(text: string): VideoStub[] {
  const lines = text.split("\n");
  const byId = new Map<string, VideoStub>();

  const ingest = (raw: string, descHint = "") => {
    const match = raw.match(
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d+)/i,
    );
    if (!match) return;
    const url = normalizeTikTokUrl(match[1], match[2]);
    const key = match[2];
    if (byId.has(key)) return;
    byId.set(key, { url, desc: descHint });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const vm = line.match(
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.-]+)\/video\/(\d+)/i,
    );
    if (vm) {
      ingest(line, snippetForLine(lines, i));
    }
  }

  for (const match of text.matchAll(TIKTOK_VIDEO_PATH)) {
    ingest(match[0], "");
  }

  for (const match of text.matchAll(UDDG_PARAM)) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (!/\/video\/\d+/i.test(decoded)) continue;
      ingest(decoded, "");
    } catch {
      /* ignore */
    }
  }

  return [...byId.values()];
}

export function extractVideoUrls(text: string): string[] {
  return extractVideoStubs(text).map((s) => s.url);
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

async function collectStubsFromQuery(
  query: string,
  into: Map<string, VideoStub>,
  limit: number,
): Promise<void> {
  if (into.size >= limit) return;
  const md = await fetchDdgLiteMarkdown(query);
  for (const stub of extractVideoStubs(md)) {
    const key = stubKey(stub.url);
    if (into.has(key)) continue;
    into.set(key, stub);
    if (into.size >= limit) break;
  }
}

/** Find TikTok videos via DuckDuckGo (metadata from snippets; full resolve on watch). */
export async function findTikTokVideoStubs(
  keyword: string,
  limit = 16,
): Promise<VideoStub[]> {
  const trimmed = keyword.trim();
  const queries = [
    `site:tiktok.com inurl:video ${trimmed}`,
    `site:tiktok.com ${trimmed} video`,
    `site:tiktok.com ${trimmed}`,
  ];

  const stubs = new Map<string, VideoStub>();
  for (const q of queries) {
    try {
      await collectStubsFromQuery(q, stubs, limit);
    } catch {
      /* try next query shape */
    }
    if (stubs.size >= limit) break;
  }

  return [...stubs.values()].slice(0, limit);
}

export async function findTikTokVideoUrls(
  keyword: string,
  limit = 16,
): Promise<string[]> {
  return findTikTokVideoStubs(keyword, limit).map((s) => s.url);
}

export async function findUserVideoUrls(
  username: string,
  limit = 24,
): Promise<string[]> {
  const queries = [
    `site:tiktok.com/@${username}/video`,
    `site:tiktok.com inurl:video @${username}`,
  ];
  const stubs = new Map<string, VideoStub>();
  for (const q of queries) {
    try {
      await collectStubsFromQuery(q, stubs, limit * 2);
    } catch {
      /* continue */
    }
  }
  return [...stubs.values()]
    .filter((s) =>
      s.url.toLowerCase().includes(`/@${username.toLowerCase()}/`),
    )
    .slice(0, limit)
    .map((s) => s.url);
}