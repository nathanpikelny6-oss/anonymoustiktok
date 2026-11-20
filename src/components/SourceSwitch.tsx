import { useEffect, useState } from "react";
import {
  SEARCH_PROVIDERS,
  readSearchProvider,
  writeSearchProvider,
  type SearchProvider,
} from "../lib/providers";

export function SourceSwitch() {
  const [provider, setProvider] = useState<SearchProvider>(() => readSearchProvider());

  useEffect(() => {
    const onChange = () => setProvider(readSearchProvider());
    window.addEventListener("peektok-provider", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("peektok-provider", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return (
    <div className="source-switch" role="radiogroup" aria-label="Search source">
      {SEARCH_PROVIDERS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={provider === option.id}
          className={provider === option.id ? "is-active" : ""}
          title={option.hint}
          onClick={() => {
            writeSearchProvider(option.id);
            setProvider(option.id);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}