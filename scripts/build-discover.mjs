#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url + "/.."));
const seedsPath = join(root, "public/seeds.json");
const outPath = join(root, "public/discover.json");

const seeds = JSON.parse(readFileSync(seedsPath, "utf8"));

function mapVideo(data, pageUrl) {
  const id = String(data.id ?? "");
  const username = data.author?.unique_id ?? "unknown";
  return {
    id,
    desc: data.title ?? "",
    authorUsername: username,
    authorNickname: data.author?.nickname ?? username,
    authorAvatar: data.author?.avatar,
    cover: data.cover ?? data.origin_cover,
    playCount: data.play_count,
    likeCount: data.digg_count,
    commentCount: data.comment_count,
    shareCount: data.share_count,
    duration: data.duration,
    url: pageUrl,
    playUrl: data.play,
  };
}

const items = [];
for (const url of seeds) {
  try {
    const res = await fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    );
    const body = await res.json();
    if (body.code === 0 && body.data) {
      items.push(mapVideo(body.data, url));
      console.log("ok", idFromUrl(url));
    } else {
      console.warn("skip", url, body.msg);
    }
  } catch (err) {
    console.warn("fail", url, err.message);
  }
}

function idFromUrl(url) {
  return url.match(/video\/(\d+)/)?.[1] ?? url;
}

writeFileSync(outPath, JSON.stringify(items, null, 2));
console.log(`Wrote ${items.length} videos to public/discover.json`);