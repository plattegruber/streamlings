#!/bin/bash
# Send a single chat message event to Twitch EventSub adapter

echo "💬 Sending chat message to Twitch EventSub adapter (port 8788)"

# Generate a random user ID for variety
USER_ID=$((100000 + RANDOM % 900000))

curl -s -X POST http://localhost:8788/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "type": "channel.chat.message"
    },
    "event": {
      "user_id": "'"$USER_ID"'",
      "user_name": "TestUser'"$USER_ID"'",
      "message": {
        "text": "Hello from test script!"
      }
    }
  }' > /dev/null

echo "✅ Sent 1 chat message (user_id: $USER_ID)"
