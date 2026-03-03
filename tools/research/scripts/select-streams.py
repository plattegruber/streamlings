#!/usr/bin/env python3
"""Select ~5 representative streams from the preprocessed manifest."""

import json
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "preprocessed")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "selected.json")


def main():
    if not os.path.exists(MANIFEST_PATH):
        print(f"Manifest not found: {MANIFEST_PATH}", file=sys.stderr)
        print("Run preprocess.py first.", file=sys.stderr)
        sys.exit(1)

    with open(MANIFEST_PATH) as f:
        streams = json.load(f)

    if not streams:
        print("Manifest is empty — no streams to select.", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(streams)} streams from manifest.")

    # Filter out very short streams (< 30 min)
    viable = [s for s in streams if s["duration_seconds"] >= 1800]
    if len(viable) < 5:
        # Relax to 10 min if we don't have enough
        viable = [s for s in streams if s["duration_seconds"] >= 600]

    print(f"  {len(viable)} viable streams (>= 30 min)")

    selected = {}

    # 1. Small channel: ~1-5 msg/min average
    small = [s for s in viable if 1 <= s["avg_msg_per_min"] <= 5]
    if small:
        # Pick the one closest to 3 msg/min
        small.sort(key=lambda s: abs(s["avg_msg_per_min"] - 3))
        selected["small_channel"] = small[0]
        print(f"  Small channel:  {small[0]['stream_id']} ({small[0]['avg_msg_per_min']:.1f} msg/min)")

    # 2. Medium channel: ~5-20 msg/min average
    medium = [s for s in viable if 5 < s["avg_msg_per_min"] <= 20]
    if medium:
        medium.sort(key=lambda s: abs(s["avg_msg_per_min"] - 12))
        selected["medium_channel"] = medium[0]
        print(f"  Medium channel: {medium[0]['stream_id']} ({medium[0]['avg_msg_per_min']:.1f} msg/min)")

    # 3. Large channel: 20+ msg/min average
    large = [s for s in viable if s["avg_msg_per_min"] > 20]
    if large:
        large.sort(key=lambda s: s["avg_msg_per_min"])
        # Pick one in the middle to avoid extreme outliers
        selected["large_channel"] = large[len(large) // 2]
        s = selected["large_channel"]
        print(f"  Large channel:  {s['stream_id']} ({s['avg_msg_per_min']:.1f} msg/min)")

    # 4. Bursty: highest peak-to-average ratio
    bursty_candidates = [
        s for s in viable
        if s["avg_msg_per_min"] > 0 and s["stream_id"] not in {v["stream_id"] for v in selected.values()}
    ]
    if bursty_candidates:
        # peak_msg_per_10s is raw count; avg_msg_per_min is per-minute rate
        # Normalize: peak_per_min = peak_msg_per_10s * 6
        for s in bursty_candidates:
            s["_peak_to_avg"] = (s["peak_msg_per_10s"] * 6) / s["avg_msg_per_min"]
        bursty_candidates.sort(key=lambda s: s["_peak_to_avg"], reverse=True)
        selected["bursty"] = bursty_candidates[0]
        s = selected["bursty"]
        print(f"  Bursty:         {s['stream_id']} (peak/avg ratio: {s['_peak_to_avg']:.1f})")

    # 5. Long stream: longest duration (tests drive accumulation)
    remaining = [
        s for s in viable
        if s["stream_id"] not in {v["stream_id"] for v in selected.values()}
    ]
    if remaining:
        remaining.sort(key=lambda s: s["duration_seconds"], reverse=True)
        selected["long_stream"] = remaining[0]
        s = selected["long_stream"]
        hours = s["duration_seconds"] / 3600
        print(f"  Long stream:    {s['stream_id']} ({hours:.1f} hours)")

    # Clean up temp keys and write output
    output = {}
    for label, stream in selected.items():
        clean = {k: v for k, v in stream.items() if not k.startswith("_")}
        output[label] = clean

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSelected {len(output)} streams → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
