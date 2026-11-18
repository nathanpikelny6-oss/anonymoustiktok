import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  fetchVideoByUrl,
  formatCount,
  parseVideoIdFromUrl,
  videoEmbedUrl,
} from "../lib/api";
import type { VideoSummary } from "../lib/types";

export function WatchPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const urlParam = params.get("url") ?? "";
  const initial = (location.state as { video?: VideoSummary } | null)?.video;

  const [video, setVideo] = useState<VideoSummary | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const embedId = useMemo(() => {
    if (id) return id;
    return urlParam ? parseVideoIdFromUrl(urlParam) : null;
  }, [id, urlParam]);

  useEffect(() => {
    if (video || !embedId) return;
    const url =
      urlParam ||
      `https://www.tiktok.com/@tiktok/video/${embedId}`;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchVideoByUrl(url);
        if (!cancelled) setVideo(res.video);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load video");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [video, embedId, urlParam]);

  useEffect(() => {
    if (initial) setLoading(false);
  }, [initial]);

  const playerId = embedId ?? video?.id;

  if (!playerId) {
    return <p className="muted">Missing video id.</p>;
  }

  return (
    <section className="watch-layout">
      <div>
        <iframe
          className="embed-frame"
          title="TikTok video player"
          src={videoEmbedUrl(playerId)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div className="panel">
        {loading && <p className="muted">Loading details…</p>}
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