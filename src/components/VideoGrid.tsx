import type { VideoSummary } from "../lib/types";
import { VideoCard } from "./VideoCard";

export function VideoGrid({
  videos,
  loading,
}: {
  videos: VideoSummary[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="video-grid skeleton-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="video-card" aria-hidden />
        ))}
      </div>
    );
  }

  if (!videos.length) {
    return <p className="muted">No videos found.</p>;
  }

  return (
    <div className="video-grid">
      {videos.map((v) => (
        <VideoCard key={`${v.authorUsername}-${v.id}`} video={v} />
      ))}
    </div>
  );
}