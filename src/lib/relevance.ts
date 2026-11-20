import type { VideoSummary } from "./types";

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9#@]+/i)
    .map((t) => t.replace(/^[@#]/, ""))
    .filter((t) => t.length > 1);
}

/** Higher is more relevant. Mixes caption/username match with engagement, like TikTok search. */
export function relevanceScore(video: VideoSummary, query: string): number {
  const q = query.trim().toLowerCase();
  const words = tokens(q);
  const caption = `${video.desc ?? ""}`.toLowerCase();
  const handle = `${video.authorUsername ?? ""} ${video.authorNickname ?? ""}`.toLowerCase();
  const haystack = `${caption} ${handle}`;

  let text = 0;
  if (q.length > 1 && haystack.includes(q)) text += 12;
  for (const word of words) {
    if (caption.includes(word)) text += 4;
    if (caption.includes(`#${word}`)) text += 3;
    if (handle.includes(word)) text += 2;
  }

  const plays = Math.log10((video.playCount ?? 0) + 1);
  const likes = Math.log10((video.likeCount ?? 0) + 1);
  const comments = Math.log10((video.commentCount ?? 0) + 1);

  return text * 10 + plays * 3 + likes * 2 + comments;
}

export function sortByRelevance(
  items: VideoSummary[],
  query: string,
): VideoSummary[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: relevanceScore(item, query),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}

export function dedupeVideos(items: VideoSummary[]): VideoSummary[] {
  const seen = new Set<string>();
  const out: VideoSummary[] = [];
  for (const item of items) {
    const key = item.id || item.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}