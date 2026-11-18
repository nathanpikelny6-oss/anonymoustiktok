import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchUser, formatCount } from "../lib/api";
import type { UserSummary, VideoSummary } from "../lib/types";
import { VideoGrid } from "../components/VideoGrid";

export function UserPage() {
  const { username = "" } = useParams();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchUser(username);
        if (cancelled) return;
        setUser(data.user);
        setVideos(data.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load user");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!username) return null;

  return (
    <section>
      {error && <div className="alert">{error}</div>}
      {user && (
        <div className="profile-hero">
          {user.avatar && <img src={user.avatar} alt="" />}
          <div>
            <h1 className="section-title" style={{ marginBottom: 4 }}>
              {user.nickname}{" "}
              <span className="muted">@{user.username}</span>
            </h1>
            {user.signature && <p className="muted">{user.signature}</p>}
            {user.stats && (
              <div className="profile-stats">
                <span>{formatCount(user.stats.followerCount)} followers</span>
                <span>{formatCount(user.stats.followingCount)} following</span>
                <span>{formatCount(user.stats.heartCount)} likes</span>
              </div>
            )}
          </div>
        </div>
      )}
      <h2 className="section-title">Videos</h2>
      <VideoGrid videos={videos} loading={loading} />
    </section>
  );
}