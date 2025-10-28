#!/bin/bash
# Simulate an active stream with burst of events

echo "🎉 Simulating active stream chat (burst mode)!"
echo "   Watch the energy and mood change in the streamling-state worker logs..."
echo ""

# Function to send a chat message
send_chat() {
  USER_ID=$((100000 + RANDOM % 900000))
  curl -s -X POST http://localhost:8788/webhook \
    -H "Content-Type: application/json" \
    -d '{
      "subscription": {"type": "channel.chat.message"},
      "event": {
        "user_id": "'"$USER_ID"'",
        "user_name": "TestUser'"$USER_ID"'",
        "message": {"text": "Chat message!"}
      }
    }' > /dev/null
}

# Simulate 30 seconds of active chat
for round in {1..6}; do
  echo "📊 Round $round/6 - sending messages..."

  # Send 4-6 chat messages
  messages=$((4 + RANDOM % 3))
  for i in $(seq 1 $messages); do
    send_chat &
  done

  # Occasionally send a high-value event (40% chance for more excitement)
  if [ $((RANDOM % 5)) -lt 2 ]; then
    high_value_events=("channel.subscribe" "channel.cheer" "channel.subscription.gift")
    random_hv=${high_value_events[$RANDOM % ${#high_value_events[@]}]}
    echo "   ✨ High-value event: $random_hv"
    twitch event trigger "$random_hv" -F http://localhost:8788/webhook > /dev/null 2>&1 &
  fi

  # Wait for events to send
  wait

  # Pause between rounds (simulates 5 seconds of activity)
  sleep 5
done

echo ""
echo "✅ Burst complete! Check the streamling-state logs to see mood transitions."
echo "   You can also run: curl http://localhost:8787/telemetry"
