#!/usr/bin/env bash
# JoinTix setup for macOS / Linux. Run: bash scripts/setup.sh
set -euo pipefail
REQUIRED_MAJOR=22
cd "$(dirname "$0")/.."

node_major() {
  command -v node >/dev/null 2>&1 || { echo 0; return; }
  node -v | sed 's/^v//' | cut -d. -f1
}

echo "== JoinTix setup =="

# 1. Node.js
if [ "$(node_major)" -lt "$REQUIRED_MAJOR" ]; then
  echo "Node.js $REQUIRED_MAJOR+ not found."
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    nvm install
    nvm use
  elif command -v brew >/dev/null 2>&1; then
    read -r -p "Install Node.js $REQUIRED_MAJOR with Homebrew now? (Y/n) " answer
    if [ -z "$answer" ] || [[ "$answer" =~ ^[Yy] ]]; then
      brew install "node@$REQUIRED_MAJOR"
      brew link --overwrite --force "node@$REQUIRED_MAJOR"
    fi
  fi
  if [ "$(node_major)" -lt "$REQUIRED_MAJOR" ]; then
    echo "Please install Node.js $REQUIRED_MAJOR LTS from https://nodejs.org then run setup again."
    exit 1
  fi
fi
echo "Node.js $(node -v) OK"

# 2. Dependencies
echo "Installing dependencies (npm ci)..."
npm ci

# 3. .env.local
if [ -f .env.local ]; then
  echo ".env.local already exists, leaving it as is."
else
  echo "Paste the Neon DATABASE_URL from the project owner (leave blank to skip):"
  read -r -p "DATABASE_URL: " url
  url="${url//\'/}"
  url="${url//\"/}"
  if [ -n "$url" ]; then
    printf "DATABASE_URL='%s'\n" "$url" > .env.local
    echo "Created .env.local"
  else
    echo "Skipped. Create .env.local yourself before running the app."
  fi
fi

echo
echo "Done. Start the app with:  npm run dev"
echo "Then open http://localhost:3000/api/health"
