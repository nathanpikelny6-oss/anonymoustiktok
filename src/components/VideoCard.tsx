import { Link } from "react-router-dom";
import type { VideoSummary } from "../lib/types";
import { formatCount } from "../lib/api";

export function VideoCard({ video }: { video: VideoSummary }) {
  return (
    <Link
      className="video-card"
      to={`/watch/${video.id}`}
      state={{ video }}
      title={video.desc || video.url}
    >
      <div className="thumb-wrap">
        {video.cover ? (
          <img src={video.cover} alt="" loading="lazy" />
        ) : (
          <div className="thumb-fallback">Tap to watch</div>
        )}
      </div>
      <div className="card-body">
        <p className="card-title">{video.desc || "TikTok video"}</p>
        <div className="card-meta">
          <span>@{video.authorUsername}</span>
          <span>{formatCount(video.likeCount)} likes</span>
          <span>{formatCount(video.playCount)} views</span>
        </div>
      </div>
    </Link>
  );
}