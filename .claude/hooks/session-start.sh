#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# --- Install pnpm dependencies ---
cd "$CLAUDE_PROJECT_DIR"
pnpm install

# --- Install GitHub CLI ---
GH_VERSION="2.65.0"
GH_DIR="/usr/local/bin"
if ! command -v gh &>/dev/null; then
  GH_TARBALL="/tmp/gh.tar.gz"
  curl -sL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" -o "$GH_TARBALL"
  tar -xzf "$GH_TARBALL" -C /tmp
  cp "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" "$GH_DIR/gh"
  chmod +x "$GH_DIR/gh"
  rm -rf "$GH_TARBALL" "/tmp/gh_${GH_VERSION}_linux_amd64"
fi
