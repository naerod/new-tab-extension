#!/usr/bin/env bash
# Render the extension headlessly and screenshot it. Wraps tools/shot.mjs in xvfb
# (needed for loading a Chrome extension without a display).
#   bash tools/shot.sh [dark|light] [seed]
#   e.g. bash tools/shot.sh light 1   -> docs/shots/newtab-light.png (with sample sport config)
set -euo pipefail
cd "$(dirname "$0")/.."
THEME="${1:-dark}"
SEED="${2:-0}"
OUT="docs/shots/newtab-${THEME}.png"
mkdir -p docs/shots
rm -rf /tmp/nt-profile           # deterministic clean profile each run
xvfb-run -a node tools/shot.mjs --theme="$THEME" --seed="$SEED" --out="$OUT"
echo "$OUT"
