#!/bin/bash
# Simulate a realistic stream session with four activity phases.
#
# Usage:
#   ./simulate-stream.sh [--speed N]
#
# Speed multiplier controls sleep duration between rounds:
#   --speed 1    Real-time (~12 minutes)
#   --speed 10   Fast (~72 seconds)
#   --speed 100  Smoke test (~7 seconds)

set -euo pipefail

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SPEED=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --speed)
      SPEED="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--speed N]"
      exit 1
      ;;
  esac
done

ADAPTER_URL="http://localhost:8788/webhook"
TELEMETRY_URL="http://localhost:8787/telemetry"

# ---------------------------------------------------------------------------
# Generate a pool of "regular" user IDs
# ---------------------------------------------------------------------------
USER_POOL=()
for i in $(seq 1 20); do
  USER_POOL+=("$((100000 + RANDOM % 900000))")
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Sleep with speed multiplier applied. Minimum 0.05s.
sim_sleep() {
  local base="$1"
  local duration
  duration=$(awk "BEGIN { d = $base / $SPEED; if (d < 0.05) d = 0.05; printf \"%.2f\", d }")
  sleep "$duration"
}

# Pick N random user IDs from the pool.
pick_users() {
  local count="$1"
  local picked=()
  for _ in $(seq 1 "$count"); do
    picked+=("${USER_POOL[$((RANDOM % ${#USER_POOL[@]}))]}")
  done
  echo "${picked[@]}"
}

# Send a chat message event.
send_chat() {
  local user_id="$1"
  curl -s -X POST "$ADAPTER_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "subscription": {"type": "channel.chat.message"},
      "event": {
        "user_id": "'"$user_id"'",
        "user_name": "User'"$user_id"'",
        "message": {"text": "simulated message"}
      }
    }' > /dev/null 2>&1 || true
}

# Send a high-value event (subscribe, cheer, or gift sub).
send_high_value() {
  local types=("channel.subscribe" "channel.cheer" "channel.subscription.gift")
  local chosen="${types[$((RANDOM % ${#types[@]}))]}"
  local user_id="${USER_POOL[$((RANDOM % ${#USER_POOL[@]}))]}"

  if [[ "$chosen" == "channel.subscription.gift" ]]; then
    curl -s -X POST "$ADAPTER_URL" \
      -H "Content-Type: application/json" \
      -d '{
        "subscription": {"type": "'"$chosen"'"},
        "event": {
          "user_id": "'"$user_id"'",
          "user_name": "User'"$user_id"'",
          "to_broadcaster_user_id": "12345",
          "total": 5
        }
      }' > /dev/null 2>&1 || true
  else
    curl -s -X POST "$ADAPTER_URL" \
      -H "Content-Type: application/json" \
      -d '{
        "subscription": {"type": "'"$chosen"'"},
        "event": {
          "user_id": "'"$user_id"'",
          "user_name": "User'"$user_id"'",
          "bits": 500
        }
      }' > /dev/null 2>&1 || true
  fi

  echo "$chosen"
}

# Print phase header.
phase_header() {
  local name="$1"
  local description="$2"
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  📺 Phase: $name"
  echo "  $description"
  echo "═══════════════════════════════════════════════════"
}

# ---------------------------------------------------------------------------
# Phase 1: Quiet period — establish a low baseline
# ---------------------------------------------------------------------------
run_quiet() {
  phase_header "Quiet" "Low activity to establish baseline (~3 min at 1x)"
  local rounds=18  # 18 rounds × 10s = 3 minutes

  for round in $(seq 1 $rounds); do
    local msgs=$((1 + RANDOM % 2))  # 1-2 messages
    local users
    users=$(pick_users 1)

    for user_id in $users; do
      for _ in $(seq 1 "$msgs"); do
        send_chat "$user_id" &
      done
    done
    wait

    printf "  🔇 Round %2d/%d — %d msgs, 1 chatter\n" "$round" "$rounds" "$msgs"
    sim_sleep 10
  done
}

# ---------------------------------------------------------------------------
# Phase 2: Ramp up — gradually increasing activity
# ---------------------------------------------------------------------------
run_ramp_up() {
  phase_header "Ramp Up" "Increasing activity to trigger Idle → Engaged (~3 min at 1x)"
  local rounds=18

  for round in $(seq 1 $rounds); do
    # Linearly increase messages from 3 to 12
    local progress=$((round * 100 / rounds))
    local msgs=$((3 + round * 9 / rounds))
    # Increase unique chatters from 2 to 8
    local chatter_count=$((2 + round * 6 / rounds))
    local users
    users=$(pick_users "$chatter_count")

    local sent=0
    for user_id in $users; do
      local per_user=$(( (msgs / chatter_count) + 1 ))
      for _ in $(seq 1 "$per_user"); do
        if [[ $sent -lt $msgs ]]; then
          send_chat "$user_id" &
          sent=$((sent + 1))
        fi
      done
    done

    # Occasional high-value event (every ~3 rounds ≈ 30s)
    local hv_label=""
    if [[ $((round % 3)) -eq 0 ]]; then
      hv_label=" + $(send_high_value)"
    fi

    wait
    printf "  📈 Round %2d/%d — %d msgs, %d chatters%s\n" \
      "$round" "$rounds" "$sent" "$chatter_count" "$hv_label"
    sim_sleep 10
  done
}

# ---------------------------------------------------------------------------
# Phase 3: Hype event — burst of high activity
# ---------------------------------------------------------------------------
run_hype() {
  phase_header "Hype" "Peak activity to trigger Engaged → Partying (~3 min at 1x)"
  local rounds=18

  for round in $(seq 1 $rounds); do
    local msgs=$((15 + RANDOM % 6))  # 15-20 messages
    local chatter_count=$((8 + RANDOM % 5))  # 8-12 chatters
    local users
    users=$(pick_users "$chatter_count")

    local sent=0
    for user_id in $users; do
      local per_user=$(( (msgs / chatter_count) + 1 ))
      for _ in $(seq 1 "$per_user"); do
        if [[ $sent -lt $msgs ]]; then
          send_chat "$user_id" &
          sent=$((sent + 1))
        fi
      done
    done

    # Frequent high-value events (every round)
    local hv_label
    hv_label="$(send_high_value)"
    # Extra high-value event every other round
    if [[ $((round % 2)) -eq 0 ]]; then
      hv_label="$hv_label + $(send_high_value)"
    fi

    wait
    printf "  🎉 Round %2d/%d — %d msgs, %d chatters + %s\n" \
      "$round" "$rounds" "$sent" "$chatter_count" "$hv_label"
    sim_sleep 10
  done
}

# ---------------------------------------------------------------------------
# Phase 4: Cool down — activity tapering off
# ---------------------------------------------------------------------------
run_cooldown() {
  phase_header "Cool Down" "Decreasing activity, energy decays (~3 min at 1x)"
  local rounds=18

  for round in $(seq 1 $rounds); do
    # Taper messages from 15 down to 0
    local msgs=$(( 15 - round * 15 / rounds ))
    if [[ $msgs -lt 0 ]]; then msgs=0; fi

    local chatter_count=$(( msgs / 2 ))
    if [[ $chatter_count -lt 1 && $msgs -gt 0 ]]; then chatter_count=1; fi

    if [[ $msgs -gt 0 ]]; then
      local users
      users=$(pick_users "$chatter_count")
      local sent=0
      for user_id in $users; do
        local per_user=$(( (msgs / chatter_count) + 1 ))
        for _ in $(seq 1 "$per_user"); do
          if [[ $sent -lt $msgs ]]; then
            send_chat "$user_id" &
            sent=$((sent + 1))
          fi
        done
      done
      wait
      printf "  📉 Round %2d/%d — %d msgs, %d chatters\n" \
        "$round" "$rounds" "$sent" "$chatter_count"
    else
      printf "  😴 Round %2d/%d — silent\n" "$round" "$rounds"
    fi

    sim_sleep 10
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "🎮 Streamling Simulation"
echo "   Speed: ${SPEED}x"
echo "   Adapter: $ADAPTER_URL"
echo "   Estimated duration: ~$(awk "BEGIN { printf \"%.0f\", 720 / $SPEED }") seconds"
echo ""
echo "   Make sure both workers are running:"
echo "     Terminal 1: cd apps/streamling-state && pnpm dev"
echo "     Terminal 2: cd apps/twitch-eventsub && pnpm dev"

run_quiet
run_ramp_up
run_hype
run_cooldown

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Simulation complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "📊 Final telemetry:"
curl -s "$TELEMETRY_URL" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "   (Could not reach telemetry endpoint)"
