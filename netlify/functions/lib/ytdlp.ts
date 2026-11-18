import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const YTDLP_CANDIDATES = [
  path.join(process.cwd(), "netlify/functions-bin/yt-dlp"),
  path.join("/var/task", "netlify/functions-bin/yt-dlp"),
  path.resolve("netlify/functions-bin/yt-dlp"),
];

const YTDLP =
  YTDLP_CANDIDATES.find((p) => existsSync(p)) ?? YTDLP_CANDIDATES[0];

export interface YtDlpVideo {
  id: string;
  title?: string;
  description?: string;
  webpage_url?: string;
  url?: string;
  uploader?: string;
  uploader_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  repost_count?: number;
  duration?: number;
  thumbnails?: Array<{ url?: string; id?: string }>;
}

export async function fetchUserFeed(
  username: string,
  limit = 24,
): Promise<YtDlpVideo[]> {
  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const { stdout } = await execFileAsync(
    YTDLP,
    [
      "--no-warnings",
      "--flat-playlist",
      `--playlist-end=${limit}`,
      "--dump-json",
      profileUrl,
    ],
    { maxBuffer: 32 * 1024 * 1024, timeout: 90_000 },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as YtDlpVideo);
}