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

function cleanSnippet(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/www\.tiktok\.com\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulSnippet(line: string): boolean {
  if (line.length < 12 || line.length > 280) return false;
  if (/tiktok\.com|uddg=|^https?:|^www\./i.test(line)) return false;
  return true;
}

function snippetForLine(lines: string[], index: number): string {
  for (let j = index - 1; j >= Math.max(0, index - 6); j--) {
    const line = lines[j].trim();
    const numbered = line.match(RESULT_TITLE);
    const candidate = cleanSnippet(numbered ? numbered[1] : line);
    if (isUsefulSnippet(candidate)) return candidate;
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

async function fetchDdgLiteMarkdown(
  query: string,
  offset = 0,
): Promise<string> {
  const params = new URLSearchParams({ q: query });
  if (offset > 0) params.set("s", String(offset));
  const ddg = `https://lite.duckduckgo.com/lite/?${params.toString()}`;
  const reader = `https://r.jina.ai/${ddg}`;
  const res = await fetch(reader, {
    headers: {
      Accept: "text/markdown",
      "X-Timeout": "8",
    },
    signal: AbortSignal.timeout(9_000),
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
  offset = 0,
): Promise<void> {
  if (into.size >= limit) return;
  const md = await fetchDdgLiteMarkdown(query, offset);
  for (const stub of extractVideoStubs(md)) {
    const key = stubKey(stub.url);
    if (into.has(key)) continue;
    into.set(key, stub);
    if (into.size >= limit) break;
  }
}

/** First page is enough to render. Extra pages fill in afterward. */
export async function findTikTokVideoStubs(
  keyword: string,
  limit = 24,
  onUpdate?: (stubs: VideoStub[]) => void,
): Promise<VideoStub[]> {
  const trimmed = keyword.trim();
  const primary = `site:tiktok.com inurl:video ${trimmed}`;
  const stubs = new Map<string, VideoStub>();

  const publish = () => {
    onUpdate?.([...stubs.values()].slice(0, limit));
  };

  try {
    await collectStubsFromQuery(primary, stubs, limit, 0);
    publish();
  } catch {
    /* try a second query below */
  }

  if (stubs.size < 4) {
    try {
      await collectStubsFromQuery(
        `"${trimmed}" site:tiktok.com inurl:video`,
        stubs,
        limit,
        0,
      );
      publish();
    } catch {
      /* keep whatever the first page found */
    }
  }

  if (stubs.size < limit) {
    void collectStubsFromQuery(primary, stubs, limit, 10)
      .then(() => publish())
      .catch(() => undefined);
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