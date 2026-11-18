#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/netlify/functions-bin"
OUT="$BIN_DIR/yt-dlp"

mkdir -p "$BIN_DIR"

echo "Downloading yt-dlp standalone binary for Linux (Netlify functions)…"
curl -fsSL \
  -o "$OUT" \
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"
chmod +x "$OUT"
"$OUT" --version