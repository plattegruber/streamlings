#!/bin/bash
# Send a random Twitch EventSub event to the Twitch adapter worker

# Array of common Twitch EventSub event types
events=(
  "channel.follow"
  "channel.subscribe"
  "channel.cheer"
  "stream.online"
  "stream.offline"
)

# Pick a random event
random_event=${events[$RANDOM % ${#events[@]}]}

echo "📡 Sending: $random_event to Twitch EventSub adapter (port 8788)"
twitch event trigger "$random_event" -F http://localhost:8788/webhook
