#!/bin/bash
# Send a stream.offline event to the Twitch adapter worker

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📡 Sending stream.offline to Twitch EventSub adapter (port 8788)"
curl -s -X POST http://localhost:8788/webhook \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/stream-offline-payload.json" | jq .
