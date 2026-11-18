import { Link } from "react-router-dom";
import type { VideoSummary } from "../lib/types";
import { formatCount } from "../lib/api";
import { thumbnailUrl } from "../lib/thumb";

export function VideoCard({ video }: { video: VideoSummary }) {
  const thumb = thumbnailUrl(video);

  return (
    <Link
      className="video-card"
      to={`/watch/${video.id}`}
      state={{ video }}
      title={video.desc || video.url}
    >
      <div className="thumb-wrap">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (video.cover && e.currentTarget.src !== video.cover) {
                e.currentTarget.src = video.cover;
              }
            }}
          />
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