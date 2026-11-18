import { fetchUserFeed, type YtDlpVideo } from "./ytdlp.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface VideoSummary {
  id: string;
  desc: string;
  authorUsername: string;
  authorNickname: string;
  authorAvatar?: string;
  cover?: string;
  playCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  duration?: number;
  url: string;
}

export interface UserSummary {
  username: string;
  nickname: string;
  avatar?: string;
  signature?: string;
  verified?: boolean;
  stats?: {
    followerCount?: number;
    followingCount?: number;
    heartCount?: number;
    videoCount?: number;
  };
}

function mapYtDlp(v: YtDlpVideo): VideoSummary {
  const id = v.id;
  const username =
    v.uploader ??
    v.webpage_url?.match(/tiktok\.com\/@([^/]+)/)?.[1] ??
    "unknown";
  const url =
    v.webpage_url ??
    v.url ??
    `https://www.tiktok.com/@${username}/video/${id}`;

  const cover =
    v.thumbnails?.find((t) => t.id === "cover")?.url ??
    v.thumbnails?.[0]?.url;

  return {
    id,
    desc: v.description ?? v.title ?? "",
    authorUsername: username,
    authorNickname: username,
    cover,
    playCount: v.view_count,
    likeCount: v.like_count,
    commentCount: v.comment_count,
    shareCount: v.repost_count,
    duration: v.duration,
    url,
  };
}

function extractUniversalData(html: string): unknown | null {
  const match = html.match(
    /id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(\{.*?\})<\/script>/s,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function fetchProfileHtml(username: string): Promise<string> {
  const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  return res.text();
}

export async function loadUser(username: string): Promise<UserSummary | null> {
  const html = await fetchProfileHtml(username);
  const data = extractUniversalData(html) as {
    __DEFAULT_SCOPE__?: {
      "webapp.user-detail"?: {
        userInfo?: {
          user?: {
            uniqueId?: string;
            nickname?: string;
            avatarLarger?: string;
            signature?: string;
            verified?: boolean;
          };
          stats?: {
            followerCount?: number;
            followingCount?: number;
            heartCount?: number;
            videoCount?: number;
          };
        };
        statusCode?: number;
      };
    };
  } | null;

  const detail = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
  const user = detail?.userInfo?.user;
  const stats = detail?.userInfo?.stats;

  if (!user?.uniqueId || (detail?.statusCode ?? 0) !== 0) return null;

  return {
    username: user.uniqueId,
    nickname: user.nickname ?? user.uniqueId,
    avatar: user.avatarLarger,
    signature: user.signature,
    verified: user.verified,
    stats: stats
      ? {
          followerCount: stats.followerCount,
          followingCount: stats.followingCount,
          heartCount: stats.heartCount,
          videoCount: stats.videoCount,
        }
      : undefined,
  };
}

export async function loadUserVideos(
  username: string,
  limit = 24,
): Promise<VideoSummary[]> {
  const items = await fetchUserFeed(username, limit);
  return items.map(mapYtDlp);
}

export async function resolveVideo(url: string): Promise<VideoSummary | null> {
  const id = url.match(/video\/(\d+)/)?.[1];
  const username = url.match(/@([^/]+)/)?.[1];

  if (username && id) {
    const feed = await fetchUserFeed(username, 80);
    const hit = feed.find((v) => v.id === id);
    if (hit) return mapYtDlp(hit);
  }

  if (id) {
    return {
      id,
      desc: "",
      authorUsername: username ?? "unknown",
      authorNickname: username ?? "unknown",
      url: url.startsWith("http")
        ? url
        : `https://www.tiktok.com/@${username ?? "user"}/video/${id}`,
    };
  }

  return null;
}

export async function searchVideos(
  keyword: string,
): Promise<{ items: VideoSummary[]; source: string }> {
  const stalk = await loadUser(keyword.replace(/^@/, ""));
  if (stalk) {
    const feed = await loadUserVideos(stalk.username, 24);
    return { items: feed, source: "user-feed" };
  }

  const discovery = await loadUserVideos("tiktok", 48);
  const needle = keyword.toLowerCase();
  const filtered = discovery.filter((v) => v.desc.toLowerCase().includes(needle));
  if (filtered.length) {
    return { items: filtered.slice(0, 24), source: "discover-filter" };
  }

  return { items: [], source: "empty" };
}

export function parseTikTokInput(raw: string): {
  kind: "url" | "username" | "keyword";
  value: string;
} {
  const trimmed = raw.trim();
  if (/tiktok\.com/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return { kind: "url", value: trimmed };
  }
  if (/^@?[a-zA-Z0-9._]{2,30}$/.test(trimmed)) {
    return {
      kind: "username",
      value: trimmed.replace(/^@/, ""),
    };
  }
  return { kind: "keyword", value: trimmed };
}