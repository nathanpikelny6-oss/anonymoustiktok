import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

interface SearchBarProps {
  initialQuery?: string;
  compact?: boolean;
}

export function SearchBar({ initialQuery = "", compact }: SearchBarProps) {
  const [q, setQ] = useState(initialQuery);
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form className={`search-bar${compact ? "" : ""}`} onSubmit={onSubmit}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search videos, @username, hashtag words, or paste a TikTok URL"
        aria-label="Search TikTok"
      />
      <button type="submit">Search</button>
    </form>
  );
}