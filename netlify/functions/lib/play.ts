import type { HandlerEvent } from "@netlify/functions";
import {
  ensureVideoCached,
  parseByteRange,
  readVideoRange,
  readVideoWhole,
} from "./ytdlp.js";

const videoHeaders = {
  "Content-Type": "video/mp4",
  "Accept-Ranges": "bytes",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Cache-Control": "public, max-age=3600",
};

export async function serveVideoPlay(event: HandlerEvent) {
  const pageUrl = event.queryStringParameters?.url?.trim();
  if (!pageUrl) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/plain" },
      body: "Missing url",
    };
  }

  const { filePath, size } = await ensureVideoCached(pageUrl);
  const range = parseByteRange(event.headers?.range, size);

  if (range) {
    const body = await readVideoRange(filePath, range.start, range.end);
    return {
      statusCode: 206,
      headers: {
        ...videoHeaders,
        "Content-Length": String(body.length),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
      body: body.toString("base64"),
      isBase64Encoded: true,
    };
  }

  const body = await readVideoWhole(filePath);
  return {
    statusCode: 200,
    headers: {
      ...videoHeaders,
      "Content-Length": String(body.length),
    },
    body: body.toString("base64"),
    isBase64Encoded: true,
  };
}