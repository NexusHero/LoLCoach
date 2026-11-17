#!/bin/bash
set -e

cd "$(dirname "$0")/.."

TMP=$(mktemp /tmp/arc42_XXXXXX.md)

echo "Resolving includes and rewriting image paths..."
node deployment/render_plantuml.js docs/main.md > "$TMP"

echo "Generating PDF..."
npx --yes md-to-pdf "$TMP" --basedir "$(pwd)"
mv "${TMP%.md}.pdf" docs/arc42.pdf

rm -f "$TMP"
echo "Done: docs/arc42.pdf"

