export const SEARCH_PROVIDERS = [
  {
    id: "auto",
    label: "Auto",
    hint: "TikWM hashtags first, then web search if that feed is thin",
  },
  {
    id: "hashtag",
    label: "TikWM",
    hint: "TikTok hashtag feed via TikWM. Fast, with thumbnails and play links",
  },
  {
    id: "web",
    label: "Web",
    hint: "DuckDuckGo index of TikTok links. Broader queries, slower",
  },
] as const;

export type SearchProvider = (typeof SEARCH_PROVIDERS)[number]["id"];

const STORAGE_KEY = "peektok-provider";
const EVENT = "peektok-provider";

export function readSearchProvider(): SearchProvider {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "auto" || value === "hashtag" || value === "web") return value;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function writeSearchProvider(provider: SearchProvider): void {
  try {
    localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: provider }));
}