#!/usr/bin/env bash
# Deploy the loadable extension (PREPROD — S:\Dorian\PROJETS\new_tab\preprod ; il n y a pas encore de dossier prod : extension non publiée) from this CT102 repo to the S: share folder that
# Dorian loads in Chrome (CT101 /home/dorian/partage/...). Ships ONLY the files
# the extension needs — no git/tests/docs/dev tooling.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
HOST="root@192.168.1.101"
DEST="/home/dorian/partage/Dorian/PROJETS/new_tab/preprod"

echo "Deploying $SRC -> $HOST:$DEST"
ssh "$HOST" "rm -rf '$DEST' && mkdir -p '$DEST'"
tar -C "$SRC" -czf - manifest.json newtab.html changelog.html changelog.json css js fonts icons | ssh "$HOST" "tar -C '$DEST' -xzf -"
ssh "$HOST" "chown -R dorian:dorian '$DEST'"
echo "Done. Reload the extension in chrome://extensions (↻)."
