#!/bin/bash
# Send a stream.online event to the Twitch adapter worker

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📡 Sending stream.online to Twitch EventSub adapter (port 8788)"
curl -s -X POST http://localhost:8788/webhook \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/stream-online-payload.json" | jq .
