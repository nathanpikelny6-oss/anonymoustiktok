import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { searchQuery } from "../lib/api";
import { readSearchProvider } from "../lib/providers";
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
  const [provider, setProvider] = useState(() => readSearchProvider());

  useEffect(() => {
    const sync = () => setProvider(readSearchProvider());
    window.addEventListener("peektok-provider", sync);
    return () => window.removeEventListener("peektok-provider", sync);
  }, []);

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVideos([]);
    (async () => {
      try {
        let streamed = false;
        const res = await searchQuery(q, {
          onResults: (items, nextSource) => {
            if (cancelled || !items.length) return;
            streamed = true;
            setVideos(items);
            if (nextSource) setSource(nextSource);
            setLoading(false);
          },
        });
        if (cancelled) return;
        if (!streamed) setVideos(res.items ?? []);
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
  }, [q, provider]);

  if (!q) {
    return <p className="muted">Enter a search query above.</p>;
  }

  return (
    <section>
      <h1 className="section-title">Results for “{q}”</h1>
      {loading && (
        <p className="muted" style={{ marginTop: 0 }}>
          Searching…
        </p>
      )}
      {source && !loading && (
        <p className="muted" style={{ marginTop: 0 }}>
          Source: {source.replace(/-/g, " ")}
          {source === "hashtag" && " · TikWM hashtag feed"}
          {source === "web" && " · web index of TikTok links"}
          {source === "auto" &&
            " · TikWM hashtags first, web search if that feed is short"}
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
      <VideoGrid videos={videos} loading={loading && videos.length === 0} />
    </section>
  );
}