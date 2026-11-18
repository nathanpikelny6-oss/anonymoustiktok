# PeekTok — Anonymous TikTok Viewer

Static React app for browsing and watching TikTok **without logging in**. Designed for **GitHub Pages only** — no Netlify, no API keys, no env vars.

**Live URL:** `https://nathanpikelny6-oss.github.io/anonymoustiktok/`

## Features

- Discover feed, search, profiles, and watch pages
- HTML5 `<video>` playback (no TikTok iframes)
- Works entirely in the browser on GitHub Pages

## How it works

The frontend calls the public [TikWM](https://www.tikwm.com/) JSON API (CORS-enabled) from the browser to resolve video metadata and MP4 links. On deploy, CI runs `scripts/build-discover.mjs` to bake a static `discover.json` so the home feed works even when live TikWM calls fail in the browser. Watch/search still resolve via TikWM at click time.

TikWM is a third-party service — not affiliated with TikTok or this project.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy to GitHub Pages

1. Push to `main` (workflow `.github/workflows/pages.yml` builds with `GITHUB_PAGES=true`).
2. In the repo: **Settings → Pages → Build and deployment → GitHub Actions**.
3. Visit `https://<user>.github.io/<repo>/`.

No `VITE_API_BASE` or other secrets.

## Scripts

| Command       | Description        |
|---------------|--------------------|
| `npm run dev` | Vite dev server    |
| `npm run build` | Production build |

## Optional Netlify folder

The `netlify/` directory is legacy (server + yt-dlp). GitHub Pages deploys **do not** use it.

## Privacy

No TikTok login. Metadata/video URLs are fetched via TikWM from the client. TikTok may log CDN requests as usual.

MIT — unofficial tool, not affiliated with TikTok / ByteDance.