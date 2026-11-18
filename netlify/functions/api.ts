import type { Handler, HandlerEvent } from "@netlify/functions";
import { serveVideoPlay } from "./lib/play.js";
import {
  loadUser,
  loadUserVideos,
  parseTikTokInput,
  resolveVideo,
  searchVideos,
  type VideoSummary,
} from "./lib/tiktok.js";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=60",
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function routePath(event: HandlerEvent): string {
  let path = event.path.split("?")[0] ?? "/";
  path = path.replace(/^\/\.netlify\/functions\/api/, "");
  path = path.replace(/^\/api/, "");
  return path || "/";
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const path = routePath(event);

  try {
    if (path === "/health" || path === "/") {
      return json(200, { ok: true, service: "peektok-api" });
    }

    if (path === "/trending") {
      const feed = await loadUserVideos("tiktok", 18);
      return json(200, { items: feed, source: "tiktok-official" });
    }

    if (path === "/search") {
      const q = event.queryStringParameters?.q?.trim();
      if (!q) return json(400, { error: "Missing q" });

      const parsed = parseTikTokInput(q);
      if (parsed.kind === "url") {
        const video = await resolveVideo(parsed.value);
        return json(200, {
          items: video ? [video] : [],
          source: "url",
        });
      }
      if (parsed.kind === "username") {
        const user = await loadUser(parsed.value);
        let items: VideoSummary[] = [];
        if (user) {
          items = await loadUserVideos(user.username, 24);
        }
        return json(200, {
          user,
          items,
          source: "profile",
        });
      }

      const { items, source } = await searchVideos(parsed.value);
      return json(200, { items, source });
    }

    if (path === "/play") {
      return serveVideoPlay(event);
    }

    if (path === "/video") {
      const url = event.queryStringParameters?.url?.trim();
      if (!url) return json(400, { error: "Missing url" });
      const video = await resolveVideo(url);
      if (!video) return json(404, { error: "Video not found" });
      return json(200, { video });
    }

    const userMatch = path.match(/^\/user\/([^/]+)\/?$/);
    if (userMatch) {
      const username = decodeURIComponent(userMatch[1]);
      const user = await loadUser(username);
      if (!user) return json(404, { error: "User not found" });
      const items = await loadUserVideos(username, 24);
      return json(200, { user, items });
    }

    return json(404, { error: "Not found", path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(err);
    return json(500, { error: message });
  }
};