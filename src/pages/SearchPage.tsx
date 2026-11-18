import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchQuery } from "../lib/api";
import type { UserSummary, VideoSummary } from "../lib/types";
import { VideoGrid } from "../components/VideoGrid";

export function SearchPage() {
  const [params] = useSearchParams();
  const q = useMemo(() => params.get("q")?.trim() ?? "", [params]);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [user, setUser] = useState<UserSummary | null>(null);
  const [source, setSource] = useState<string | undefined>();
  const [loading, setLoading] = useState(Boolean(q));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await searchQuery(q);
        if (cancelled) return;
        setVideos(res.items ?? []);
        setUser(res.user ?? null);
        setSource(res.source);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!q) {
    return <p className="muted">Enter a search query above.</p>;
  }

  return (
    <section>
      <h1 className="section-title">Results for “{q}”</h1>
      {source && (
        <p className="muted" style={{ marginTop: 0 }}>
          Source: {source.replace(/-/g, " ")}
          {source === "user-feed" &&
            " (matched @username — showing their recent videos)"}
          {source === "seed-resolve" &&
            " (using bundled seed videos when TikWM feed is unavailable)"}
        </p>
      )}
      {error && <div className="alert">{error}</div>}
      {user && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="profile-hero">
            {user.avatar && <img src={user.avatar} alt="" />}
            <div>
              <h2 style={{ margin: "0 0 6px" }}>
                {user.nickname}{" "}
                <span className="muted">@{user.username}</span>
              </h2>
              {user.signature && <p className="muted">{user.signature}</p>}
              <p style={{ margin: "8px 0 0" }}>
                <Link className="btn btn-ghost" to={`/user/${user.username}`}>
                  Open profile
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
      <VideoGrid videos={videos} loading={loading} />
    </section>
  );
}