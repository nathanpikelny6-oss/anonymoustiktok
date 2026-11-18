import type { SearchResponse, UserSummary, VideoSummary } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

function apiUrl(path: string, params?: Record<string, string>) {
  const base = API_BASE.replace(/\/$/, "");
  const url = new URL(`${base}/api${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  // When API_BASE is empty, use same-origin relative path (Netlify deploy).
  if (!API_BASE) {
    const relative = new URL(`/api${path}`, window.location.origin);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        relative.searchParams.set(k, v);
      }
    }
    return relative;
  }
  return url;
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await fetch(apiUrl(path, params));
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTrending(): Promise<SearchResponse> {
  return getJson("/trending");
}

export async function searchQuery(q: string): Promise<SearchResponse> {
  return getJson<SearchResponse>("/search", { q });
}

export async function fetchUser(username: string): Promise<{
  user: UserSummary;
  items: VideoSummary[];
}> {
  return getJson(`/user/${encodeURIComponent(username)}`);
}

export async function fetchVideoByUrl(url: string): Promise<{ video: VideoSummary }> {
  return getJson("/video", { url });
}

/** Proxied MP4 play URL (no TikTok iframe). */
export function videoPlayUrl(tiktokPageUrl: string): string {
  return apiUrl("/play", { url: tiktokPageUrl }).toString();
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