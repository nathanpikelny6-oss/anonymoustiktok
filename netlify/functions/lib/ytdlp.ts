import { execFile } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const YTDLP_CANDIDATES = [
  path.join(process.cwd(), "netlify/functions-bin/yt-dlp"),
  path.join("/tmp", "netlify/functions-bin/yt-dlp"),
  path.join("/var/task", "netlify/functions-bin/yt-dlp"),
  path.resolve("netlify/functions-bin/yt-dlp"),
];

export const YTDLP =
  YTDLP_CANDIDATES.find((p) => existsSync(p)) ?? YTDLP_CANDIDATES[0];

/** Prefer ~540p to keep function responses within size limits when needed */
const VIDEO_FORMAT =
  "bytevc1_540p_344361-1/best[filesize_approx<8M]/best[ext=mp4]/b";

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

function videoCachePath(pageUrl: string): string {
  const id = pageUrl.match(/video\/(\d+)/)?.[1] ?? "unknown";
  return path.join("/tmp", `peektok-${id}.mp4`);
}

export async function ensureVideoCached(
  pageUrl: string,
): Promise<{ filePath: string; size: number }> {
  const filePath = videoCachePath(pageUrl);
  if (!existsSync(filePath)) {
    await execFileAsync(
      YTDLP,
      ["--no-warnings", "-f", VIDEO_FORMAT, "-o", filePath, pageUrl],
      { timeout: 120_000 },
    );
  }
  const size = statSync(filePath).size;
  return { filePath, size };
}

export function parseByteRange(
  rangeHeader: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!rangeHeader?.startsWith("bytes=")) return null;
  const [rawStart, rawEnd] = rangeHeader.replace(/bytes=/, "").split("-");
  const start = rawStart ? Number.parseInt(rawStart, 10) : 0;
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export async function readVideoRange(
  filePath: string,
  start: number,
  end: number,
): Promise<Buffer> {
  const length = end - start + 1;
  const buf = Buffer.alloc(length);
  const stream = createReadStream(filePath, { start, end });
  let offset = 0;
  for await (const chunk of stream) {
    const part = chunk as Buffer;
    part.copy(buf, offset);
    offset += part.length;
  }
  return buf;
}

export async function readVideoWhole(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}