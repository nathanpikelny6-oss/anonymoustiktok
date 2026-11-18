import type { VideoSummary } from "./types";

export function thumbnailUrl(video: Pick<VideoSummary, "cover" | "coverLocal">): string | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  if (video.coverLocal) {
    return `${base}${video.coverLocal}`;
  }
  return video.cover;
}