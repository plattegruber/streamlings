#!/bin/bash
# Send a random Twitch EventSub event to the local worker

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

echo "📡 Sending: $random_event"
twitch event trigger "$random_event" -F http://localhost:8787/webhook
