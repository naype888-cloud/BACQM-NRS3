#!/usr/bin/env bash
# Render the landing intro and encode it with the canonical FFMPEG V3 Titanio grade.
# Writes docs/media/intro.mp4 (H.264) and docs/media/intro.webm (VP9).
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
frames=$(mktemp -d)
trap 'rm -rf "$frames"' EXIT
python3 "$here/tools/intro_video.py" "$frames"
grade="eq=contrast=1.05:gamma=0.95,colorbalance=rh=-0.05:bh=0.15:rm=-0.05:bm=0.1,vignette=PI/5,noise=alls=4"
ffmpeg -loglevel error -y -framerate 30 -i "$frames/f%04d.png" -vf "$grade,format=yuv420p" \
  -c:v libx264 -crf 16 -preset slow -movflags +faststart "$here/docs/media/intro.mp4"
ffmpeg -loglevel error -y -framerate 30 -i "$frames/f%04d.png" -vf "$grade,format=yuv420p" \
  -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 "$here/docs/media/intro.webm"
ls -l "$here/docs/media/intro.mp4" "$here/docs/media/intro.webm"
