import type { SearchResponse, UserSummary, VideoSummary } from "./types";
import { resolveVideoUrl } from "./tikwm";

export {
  fetchTrending,
  fetchUser,
  parseTikTokInput,
  resolveVideoUrl,
  searchQuery,
} from "./tikwm";

export async function fetchVideoByUrl(
  url: string,
): Promise<{ video: VideoSummary }> {
  const video = await resolveVideoUrl(url);
  return { video };
}

export function videoPlayUrl(video: VideoSummary): string {
  return video.playUrl ?? "";
}

export function parseVideoIdFromUrl(url: string): string | null {
  const match = url.match(/video\/(\d+)/);
  return match?.[1] ?? null;
}

export function formatCount(n?: number): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export type { SearchResponse, UserSummary, VideoSummary };