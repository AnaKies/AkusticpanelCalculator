#!/usr/bin/env sh

set -eu

cd "$(dirname "$0")"

PORT="${PORT:-8080}"

echo "Frontend startet auf http://localhost:${PORT}"
echo "Zum Beenden Ctrl+C drücken."

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT"
else
  echo "Fehler: Python ist nicht installiert oder nicht im PATH." >&2
  exit 1
fi
