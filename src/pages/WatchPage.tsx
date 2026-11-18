import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  fetchVideoByUrl,
  formatCount,
  videoPlayUrl,
} from "../lib/api";
import type { VideoSummary } from "../lib/types";

export function WatchPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const urlParam = params.get("url") ?? "";
  const initial = (location.state as { video?: VideoSummary } | null)?.video;

  const [video, setVideo] = useState<VideoSummary | null>(initial ?? null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageUrl = useMemo(() => {
    if (urlParam) return urlParam;
    if (video?.url) return video.url;
    if (id) return `https://www.tiktok.com/@tiktok/video/${id}`;
    return "";
  }, [urlParam, video?.url, id]);

  const playSrc = video ? videoPlayUrl(video) : "";

  useEffect(() => {
    if (!pageUrl) return;
    let cancelled = false;
    setMetaLoading(true);
  setError(null);
    (async () => {
      try {
        const res = await fetchVideoByUrl(pageUrl);
        if (!cancelled) setVideo(res.video);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load video");
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageUrl]);

  if (!pageUrl) {
    return <p className="muted">Missing video id.</p>;
  }

  return (
    <section className="watch-layout">
      <div>
        {playSrc ? (
          <video
            className="video-player"
            controls
            playsInline
            preload="metadata"
            poster={video?.cover}
            src={playSrc}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onLoadStart={() => setVideoLoading(true)}
            onCanPlay={() => setVideoLoading(false)}
            onError={() => {
              setVideoLoading(false);
              setError(
                "Playback failed. TikTok may have blocked this CDN link — try opening the video again.",
              );
            }}
          />
        ) : (
          !metaLoading && <p className="muted">No playable stream for this video.</p>
        )}
        {videoLoading && playSrc && (
          <p className="muted" style={{ marginTop: 8 }}>
            Loading stream…
          </p>
        )}
      </div>
      <div className="panel">
        {metaLoading && <p className="muted">Loading details…</p>}
        {error && <div className="alert">{error}</div>}
        {video && (
          <>
            <h1 className="section-title" style={{ marginTop: 0 }}>
              {video.desc || "TikTok video"}
            </h1>
            <p>
              <Link to={`/user/${video.authorUsername}`}>@{video.authorUsername}</Link>
            </p>
            <div className="profile-stats">
              <span>{formatCount(video.playCount)} views</span>
              <span>{formatCount(video.likeCount)} likes</span>
              <span>{formatCount(video.commentCount)} comments</span>
            </div>
            <p className="muted" style={{ marginTop: 16, wordBreak: "break-all" }}>
              {video.url}
            </p>
          </>
        )}
      </div>
    </section>
  );
}