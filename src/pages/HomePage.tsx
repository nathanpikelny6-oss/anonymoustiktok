import { useEffect, useState } from "react";
import { fetchTrending } from "../lib/api";
import type { VideoSummary } from "../lib/types";
import { VideoGrid } from "../components/VideoGrid";

export function HomePage() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTrending();
        if (!cancelled) setVideos(data.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load feed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="section-title">Discover</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>
        Watch TikTok without an account. Try searching for a keyword, @creator, or paste a video link.
      </p>
      {error && (
        <div className="alert" style={{ marginBottom: 16 }}>
          {error}
          {/404|failed to fetch/i.test(error) && (
            <>
              {" "}
              If you use GitHub Pages only, deploy on Netlify too or set{" "}
              <code>VITE_API_BASE</code>.
            </>
          )}
        </div>
      )}
      <VideoGrid videos={videos} loading={loading} />
    </section>
  );
}