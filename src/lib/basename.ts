/** React Router basename for GitHub Pages project sites and Netlify. */
export function getRouterBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;

  if (base === "./") {
    const segment = window.location.pathname.split("/").filter(Boolean)[0];
    return segment ? `/${segment}` : undefined;
  }

  if (!base || base === "/") {
    return undefined;
  }

  const trimmed = base.replace(/\/$/, "");
  return trimmed || undefined;
}