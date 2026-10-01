#!/bin/bash
# Double-click launcher for macOS. Starts the planner and opens it in the browser.
# Keep this Terminal window open while you use the app; close it to stop the server.
cd "$(dirname "$0")/.." || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org and try again."
  read -r -p "Press Enter to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies (this takes a minute)..."
  npm install || { echo "npm install failed. If the error mentions better-sqlite3 or xcode, run: xcode-select --install"; read -r -p "Press Enter to close."; exit 1; }
fi

PORT="${PORT:-3000}"
# Open the browser once the server answers.
( for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$PORT/"; then open "http://localhost:$PORT/"; exit 0; fi
    sleep 1
  done ) &

echo "Paper Planner is starting at http://localhost:$PORT"
echo "Close this window to stop it."
exec npm run dev -- -p "$PORT"
