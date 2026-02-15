#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# --- Install pnpm dependencies ---
cd "$CLAUDE_PROJECT_DIR"
pnpm install

# --- Install Elixir toolchain (for apps/lattice) ---
if command -v mix &>/dev/null; then
  # Install Hex from GitHub source (hex.pm is blocked by proxy)
  if ! mix hex.info &>/dev/null 2>&1; then
    mix archive.install github hexpm/hex branch latest --force
  fi

  # Install rebar3 from source (needed for Erlang deps like telemetry_poller)
  if ! mix local.rebar --force &>/dev/null 2>&1; then
    REBAR_TMP="/tmp/rebar3_build"
    rm -rf "$REBAR_TMP"
    git clone --depth 1 https://github.com/erlang/rebar3.git "$REBAR_TMP"
    cd "$REBAR_TMP" && ./bootstrap
    mix local.rebar rebar3 "$REBAR_TMP/rebar3" --force
    rm -rf "$REBAR_TMP"
    cd "$CLAUDE_PROJECT_DIR"
  fi

  # Install phx_new generator from Phoenix source
  if ! mix phx.new --version &>/dev/null 2>&1; then
    PHX_TMP="/tmp/phoenix_repo"
    rm -rf "$PHX_TMP"
    git clone --depth 1 --branch v1.7.14 https://github.com/phoenixframework/phoenix.git "$PHX_TMP"
    cd "$PHX_TMP/installer" && mix archive.build --output /tmp/phx_new.ez
    mix archive.install /tmp/phx_new.ez --force
    rm -rf "$PHX_TMP" /tmp/phx_new.ez
    cd "$CLAUDE_PROJECT_DIR"
  fi
fi

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
