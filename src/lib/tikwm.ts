import type { SearchResponse, UserSummary, VideoSummary } from "./types";
import { findTikTokVideoUrls, findUserVideoUrls } from "./webDiscovery";

const TIKWM_API = "https://www.tikwm.com/api";

type TikwmAuthor = {
  unique_id?: string;
  nickname?: string;
  avatar?: string;
};

export type TikwmVideo = {
  id?: string;
  video_id?: string;
  title?: string;
  cover?: string;
  origin_cover?: string;
  duration?: number;
  play?: string;
  play_count?: number;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  author?: TikwmAuthor;
};

type TikwmEnvelope<T> = {
  code: number;
  msg?: string;
  data?: T;
};

function mapVideo(item: TikwmVideo, pageUrl?: string): VideoSummary {
  const id = String(item.id ?? item.video_id ?? "");
  const username = item.author?.unique_id ?? "unknown";
  const url =
    pageUrl ?? `https://www.tiktok.com/@${username}/video/${id}`;
  return {
    id,
    desc: item.title ?? "",
    authorUsername: username,
    authorNickname: item.author?.nickname ?? username,
    authorAvatar: item.author?.avatar,
    cover: item.cover ?? item.origin_cover,
    playCount: item.play_count,
    likeCount: item.digg_count,
    commentCount: item.comment_count,
    shareCount: item.share_count,
    duration: item.duration,
    url,
    playUrl: item.play,
  };
}

async function tikwmRequest<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`TikWM request failed (${res.status})`);
  }
  const body = (await res.json()) as TikwmEnvelope<T>;
  if (body.code !== 0 || body.data === undefined) {
    throw new Error(body.msg ?? "TikWM returned no data");
  }
  return body.data;
}

export async function resolveVideoUrl(tiktokUrl: string): Promise<VideoSummary> {
  const data = await tikwmRequest<TikwmVideo>(
    `${TIKWM_API}/?url=${encodeURIComponent(tiktokUrl)}`,
  );
  return mapVideo(data, tiktokUrl);
}

export async function fetchUserPosts(
  username: string,
  count = 24,
): Promise<VideoSummary[]> {
  const data = await tikwmRequest<{ videos?: TikwmVideo[] }>(
    `${TIKWM_API}/user/posts?unique_id=${encodeURIComponent(username)}&count=${count}`,
  );
  const videos = data.videos ?? [];
  if (!videos.length) throw new Error("No videos returned");
  return videos.map((v) => mapVideo(v));
}

export async function fetchUserInfo(
  username: string,
): Promise<UserSummary | null> {
  try {
    const data = await tikwmRequest<{
      user?: {
        unique_id?: string;
        nickname?: string;
        avatar?: string;
        signature?: string;
        verified?: boolean;
        follower_count?: number;
        following_count?: number;
        heart_count?: number;
        video_count?: number;
      };
    }>(`${TIKWM_API}/user/info?unique_id=${encodeURIComponent(username)}`);
    const u = data.user;
    if (!u?.unique_id) return null;
    return {
      username: u.unique_id,
      nickname: u.nickname ?? u.unique_id,
      avatar: u.avatar,
      signature: u.signature,
      verified: u.verified,
      stats: {
        followerCount: u.follower_count,
        followingCount: u.following_count,
        heartCount: u.heart_count,
        videoCount: u.video_count,
      },
    };
  } catch {
    return null;
  }
}

export async function searchVideos(keyword: string): Promise<VideoSummary[]> {
  const params = new URLSearchParams({
    keywords: keyword,
    count: "24",
    cursor: "0",
    web: "1",
    hd: "1",
  });
  const post = await fetch(`${TIKWM_API}/feed/search`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: params,
  });
  if (post.ok) {
    const body = (await post.json()) as TikwmEnvelope<{ videos?: TikwmVideo[] }>;
    if (body.code === 0 && body.data?.videos?.length) {
      return body.data.videos.map((v) => mapVideo(v));
    }
  }

  const data = await tikwmRequest<{ videos?: TikwmVideo[] }>(
    `${TIKWM_API}/feed/search?keywords=${encodeURIComponent(keyword)}&count=24&cursor=0`,
  );
  return (data.videos ?? []).map((v) => mapVideo(v));
}

async function resolveMany(urls: string[], concurrency = 4): Promise<VideoSummary[]> {
  const results: VideoSummary[] = [];
  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const i = index++;
      const url = urls[i];
      try {
        results.push(await resolveVideoUrl(url));
      } catch {
        /* skip bad links */
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()),
  );
  return results;
}

export async function searchVideosViaWeb(keyword: string): Promise<VideoSummary[]> {
  const urls = await findTikTokVideoUrls(keyword, 16);
  if (!urls.length) return [];
  return resolveMany(urls);
}

async function loadSeedDiscover(): Promise<VideoSummary[]> {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const res = await fetch(`${base}seeds.json`);
  const urls = (await res.json()) as string[];
  const batch = urls.slice(0, 12);
  const results = await Promise.all(
    batch.map((url) =>
      resolveVideoUrl(url).catch(() => null),
    ),
  );
  return results.filter((v): v is VideoSummary => v !== null);
}

export function parseTikTokInput(raw: string): {
  kind: "url" | "username" | "keyword";
  value: string;
} {
  const trimmed = raw.trim();
  if (/tiktok\.com/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return { kind: "url", value: trimmed };
  }
  if (/^@([a-zA-Z0-9._]{2,30})$/.test(trimmed)) {
    return { kind: "username", value: trimmed.slice(1) };
  }
  return { kind: "keyword", value: trimmed };
}

async function loadBundledDiscover(): Promise<VideoSummary[]> {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const res = await fetch(`${base}discover.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`discover.json (${res.status})`);
  const items = (await res.json()) as VideoSummary[];
  return items.filter((v) => v.id && v.playUrl);
}

export async function fetchTrending(): Promise<SearchResponse> {
  try {
    const bundled = await loadBundledDiscover();
    if (bundled.length) {
      return { items: bundled, source: "bundled" };
    }
  } catch {
    /* try live fallbacks */
  }

  try {
    const items = await fetchUserPosts("tiktok", 18);
    return { items, source: "tikwm-feed" };
  } catch {
    const items = await loadSeedDiscover();
    return {
      items,
      source: items.length ? "seed-resolve" : "empty",
    };
  }
}

export async function searchQuery(q: string): Promise<SearchResponse> {
  const parsed = parseTikTokInput(q);

  if (parsed.kind === "url") {
    const video = await resolveVideoUrl(parsed.value);
    return { items: [video], source: "url" };
  }

  if (parsed.kind === "username") {
    return fetchUser(parsed.value)
      .then(({ user, items }) => ({
        user,
        items,
        source: items.length ? "profile" : "empty",
      }))
      .catch(() => ({ items: [], source: "empty" as const }));
  }

  try {
    const items = await searchVideos(parsed.value);
    if (items.length) return { items, source: "tikwm-search" };
  } catch {
    /* TikWM search often blocked in the browser */
  }

  try {
    const items = await searchVideosViaWeb(parsed.value);
    if (items.length) return { items, source: "web-search" };
  } catch {
    /* show empty */
  }

  return { items: [], source: "empty" };
}

export async function fetchUser(username: string): Promise<{
  user: UserSummary;
  items: VideoSummary[];
}> {
  let user = await fetchUserInfo(username);
  let items: VideoSummary[] = [];

  try {
    items = await fetchUserPosts(username, 24);
  } catch {
    items = [];
  }

  if (!items.length) {
    const urls = await findUserVideoUrls(username, 20);
    items = await resolveMany(urls);
    if (!user && items.length) {
      const first = items[0];
      user = {
        username: first.authorUsername,
        nickname: first.authorNickname,
        avatar: first.authorAvatar,
      };
    }
  }

  if (!user) {
    user = {
      username,
      nickname: username,
    };
  }

  if (!items.length && !user.avatar) {
    throw new Error("User not found");
  }

  return { user, items };
}