# PeekTok — Anonymous TikTok Viewer

Static React app for browsing and watching TikTok **without logging in**. Video playback uses TikTok’s official embed player.

## Features

- Search by keyword, `@username`, or pasted TikTok URL
- Creator profiles and recent videos
- Discover feed (latest from [@tiktok](https://www.tiktok.com/@tiktok))
- Dark, mobile-friendly UI

## How it works

TikTok blocks direct browser calls to their API (CORS + bot protection). This repo ships a **small serverless API** (Netlify Functions) that:

1. Fetches public metadata with bundled [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) (user feeds + video listings)
2. Reads creator profile stats from TikTok’s public HTML
3. Resolves keyword search via matching `@username` feeds or filtering the discover feed (TikTok’s signed search API is blocked from most cloud hosts)

The frontend is a Vite + React SPA that builds to static files in `dist/`.

## Local development

```bash
npm install
npm run dev          # frontend only (API calls need Netlify Dev)
npx netlify dev      # frontend + functions at /api/*
```

## Deploy on Netlify (recommended — frontend + API)

1. Import this repository in [Netlify](https://app.netlify.com/).
2. Build settings are in `netlify.toml` (`npm run build`, publish `dist`, functions in `netlify/functions`).
3. Deploy. The site uses same-origin `/api/*` redirects — no extra env vars required.

## Deploy on GitHub Pages (static only)

GitHub Pages serves the built SPA. You still need the API hosted somewhere (e.g. the same repo on Netlify):

1. Enable GitHub Pages for the repository (workflow in `.github/workflows/pages.yml`).
2. In the repo **Settings → Secrets and variables → Actions**, set variable `VITE_API_BASE` to your Netlify site URL (e.g. `https://your-site.netlify.app`) so the static build can reach `/api`.

Without `VITE_API_BASE`, the UI loads but discover/search/profile calls will fail on GitHub Pages alone.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npx netlify dev` | Local dev with API |

## Privacy

This project does not use TikTok login cookies from visitors. Server-side requests only fetch public pages/embeds. TikTok may still apply their normal embed analytics when you play a video.

## License

MIT — unofficial tool, not affiliated with TikTok / ByteDance.