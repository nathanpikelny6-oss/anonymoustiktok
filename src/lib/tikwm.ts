import type { SearchResponse, UserSummary, VideoSummary } from "./types";
import {
  findTikTokVideoStubs,
  findUserVideoUrls,
  type VideoStub,
} from "./webDiscovery";
import { dedupeVideos, sortByRelevance } from "./relevance";
import { readSearchProvider, type SearchProvider } from "./providers";

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

type ChallengeHit = {
  id?: string;
  cha_name?: string;
  view_count?: number;
};

function hashtagScore(name: string, keyword: string): number {
  const tag = name.toLowerCase();
  const compact = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const words = keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
  let score = 0;
  if (tag === compact) score += 20;
  if (compact && tag.includes(compact)) score += 8;
  for (const word of words) {
    if (tag.includes(word)) score += 4;
  }
  return score;
}

/** TikWM hashtag feed. Browser-friendly, includes covers and MP4 links. */
export async function searchHashtagVideos(keyword: string): Promise<VideoSummary[]> {
  const compact = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const queries = [...new Set([compact, keyword.trim()].filter((q) => q.length > 1))];
  let challenges: ChallengeHit[] = [];

  for (const query of queries) {
    const data = await tikwmRequest<{ challenge_list?: ChallengeHit[] }>(
      `${TIKWM_API}/challenge/search?keywords=${encodeURIComponent(query)}&count=10&cursor=0`,
    );
    challenges = data.challenge_list ?? [];
    if (challenges.length) break;
  }

  const challenge = [...challenges].sort(
    (a, b) =>
      hashtagScore(b.cha_name ?? "", keyword) - hashtagScore(a.cha_name ?? "", keyword) ||
      (b.view_count ?? 0) - (a.view_count ?? 0),
  )[0];
  if (!challenge?.id) return [];

  const posts = await tikwmRequest<{ videos?: TikwmVideo[] }>(
    `${TIKWM_API}/challenge/posts?challenge_id=${encodeURIComponent(challenge.id)}&count=20&cursor=0`,
  );
  return (posts.videos ?? []).map((video) => mapVideo(video));
}

const TIKWM_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResolveHandlers = {
  onVideo?: (video: VideoSummary) => void;
  onResults?: (videos: VideoSummary[], source?: string) => void;
};

/** TikWM free tier allows ~1 request/sec; parallel calls fail with rate limits. */
async function resolveMany(
  urls: string[],
  handlers?: ResolveHandlers,
): Promise<VideoSummary[]> {
  const results: VideoSummary[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < urls.length; i++) {
    try {
      const video = await resolveVideoUrl(urls[i]);
      if (seenIds.has(video.id)) continue;
      seenIds.add(video.id);
      results.push(video);
      handlers?.onVideo?.(video);
    } catch {
      /* skip bad links / rate limits */
    }
    if (i < urls.length - 1) {
      await sleep(TIKWM_DELAY_MS);
    }
  }
  return results;
}

function stubToVideo(stub: VideoStub): VideoSummary {
  const match = stub.url.match(/@([^/]+)\/video\/(\d+)/);
  const username = match?.[1] ?? "unknown";
  const id = match?.[2] ?? "";
  return {
    id,
    url: stub.url,
    desc: stub.desc || "TikTok video",
    authorUsername: username,
    authorNickname: username,
  };
}

const SEARCH_CACHE_PREFIX = "peektok-search:";

function readSearchCache(keyword: string, provider: SearchProvider): VideoSummary[] | null {
  try {
    const raw = sessionStorage.getItem(
      `${SEARCH_CACHE_PREFIX}${provider}:${keyword.toLowerCase()}`,
    );
    if (!raw) return null;
    const items = JSON.parse(raw) as VideoSummary[];
    return Array.isArray(items) && items.length ? items : null;
  } catch {
    return null;
  }
}

function writeSearchCache(
  keyword: string,
  provider: SearchProvider,
  items: VideoSummary[],
): void {
  try {
    sessionStorage.setItem(
      `${SEARCH_CACHE_PREFIX}${provider}:${keyword.toLowerCase()}`,
      JSON.stringify(items.slice(0, 24)),
    );
  } catch {
    /* private mode or quota */
  }
}

export async function searchKeyword(
  keyword: string,
  handlers?: ResolveHandlers,
  provider: SearchProvider = readSearchProvider(),
): Promise<VideoSummary[]> {
  let hashtagItems: VideoSummary[] = [];
  let webItems: VideoSummary[] = [];

  const publish = (source: string) => {
    const merged = dedupeVideos([
      ...hashtagItems,
      ...sortByRelevance(webItems, keyword),
    ]);
    if (!merged.length) return merged;
    writeSearchCache(keyword, provider, merged);
    handlers?.onResults?.(merged, source);
    return merged;
  };

  const cached = readSearchCache(keyword, provider);
  if (cached?.length) handlers?.onResults?.(cached, provider);

  const useHashtag = provider === "hashtag" || provider === "auto";
  const useWeb = provider === "web" || provider === "auto";

  if (useHashtag) {
    try {
      hashtagItems = await searchHashtagVideos(keyword);
      if (hashtagItems.length) publish("hashtag");
    } catch {
      hashtagItems = [];
    }
  }

  const needWeb = useWeb && (provider === "web" || hashtagItems.length < 6);
  if (needWeb) {
    await findTikTokVideoStubs(keyword, 18, (next) => {
      webItems = next.map((stub) => stubToVideo(stub));
      publish(provider === "web" ? "web" : "auto");
    });
  }

  const listed = publish(provider) ?? [];
  return listed.length ? listed : (cached ?? []);
}

async function loadSeedDiscover(): Promise<VideoSummary[]> {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const res = await fetch(`${base}seeds.json`);
  const urls = (await res.json()) as string[];
  return resolveMany(urls.slice(0, 12));
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

export async function searchQuery(
  q: string,
  handlers?: ResolveHandlers,
): Promise<SearchResponse> {
  const parsed = parseTikTokInput(q);

  if (parsed.kind === "url") {
    const video = await resolveVideoUrl(parsed.value);
    return { items: [video], source: "url" };
  }

  if (parsed.kind === "username") {
    return fetchUser(parsed.value, handlers)
      .then(({ user, items }) => ({
        user,
        items,
        source: items.length ? "profile" : "empty",
      }))
      .catch(() => ({ items: [], source: "empty" as const }));
  }

  try {
    const provider = readSearchProvider();
    const items = await searchKeyword(parsed.value, handlers, provider);
    if (items.length) return { items, source: provider };
  } catch {
    /* show empty */
  }

  return { items: [], source: "empty" };
}

export async function fetchUser(
  username: string,
  handlers?: ResolveHandlers,
): Promise<{
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
    const urls = await findUserVideoUrls(username, 16);
    items = urls.map((url) => stubToVideo({ url, desc: "" }));
    for (const video of items) handlers?.onVideo?.(video);
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