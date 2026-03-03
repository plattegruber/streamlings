#!/usr/bin/env python3
"""Preprocess Twitch chat pickle files into 10-second-bucketed CSVs."""

import json
import os
import sys

import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "preprocessed")

BUCKET_SECONDS = 10


def find_pkl_files():
    """Find all pickle files in the raw data directory, recursively."""
    pkl_files = []
    for root, _dirs, files in os.walk(RAW_DIR):
        for f in files:
            if f.endswith(".pkl"):
                pkl_files.append(os.path.join(root, f))
    return sorted(pkl_files)


def process_pickle(pkl_path):
    """
    Process a single pickle file (one channel) into per-stream CSVs.

    Each pickle contains chat messages with columns including:
    - video_id: identifies the stream session
    - offset: seconds from stream start
    - commenter_name / commenter_id: who sent the message

    Returns a list of stream metadata dicts.
    """
    channel = os.path.splitext(os.path.basename(pkl_path))[0]
    print(f"  Processing {channel} ...", end="", flush=True)

    try:
        df = pd.read_pickle(pkl_path)
    except Exception as e:
        print(f" SKIP (load error: {e})")
        return []

    if df.empty:
        print(" SKIP (empty)")
        return []

    # Identify the offset column (seconds from stream start)
    offset_col = None
    for candidate in ["offset", "content_offset_seconds", "time_offset"]:
        if candidate in df.columns:
            offset_col = candidate
            break

    if offset_col is None:
        # Try to find any numeric column that looks like offsets
        print(f" SKIP (no offset column, cols: {list(df.columns)[:5]})")
        return []

    # Identify the video/stream ID column
    video_col = None
    for candidate in ["video_id", "content_id", "stream_id"]:
        if candidate in df.columns:
            video_col = candidate
            break

    if video_col is None:
        # Treat entire file as one stream
        df["_video_id"] = channel
        video_col = "_video_id"

    # Identify the commenter column for unique chatter counting
    commenter_col = None
    for candidate in ["commenter_id", "commenter_name", "author", "username", "user_id"]:
        if candidate in df.columns:
            commenter_col = candidate
            break

    streams = []
    for video_id, group in df.groupby(video_col):
        stream_id = f"{channel}_{video_id}"
        offsets = pd.to_numeric(group[offset_col], errors="coerce").dropna()

        if offsets.empty or len(offsets) < 10:
            continue

        max_offset = offsets.max()
        duration_seconds = float(max_offset)

        if duration_seconds < 300:  # Skip streams shorter than 5 minutes
            continue

        num_buckets = int(duration_seconds / BUCKET_SECONDS) + 1

        # Bucket messages into BUCKET_SECONDS-wide windows
        bucket_indices = (offsets / BUCKET_SECONDS).astype(int)

        # Count messages per bucket
        msg_counts = bucket_indices.value_counts().reindex(
            range(num_buckets), fill_value=0
        )

        # Count unique chatters per bucket
        if commenter_col is not None:
            chatter_df = pd.DataFrame({
                "bucket": bucket_indices.values,
                "commenter": group.loc[offsets.index, commenter_col].values,
            })
            chatter_counts = chatter_df.groupby("bucket")["commenter"].nunique().reindex(
                range(num_buckets), fill_value=0
            )
        else:
            chatter_counts = msg_counts.copy()  # Fallback: assume 1 chatter per message

        # Convert counts to per-minute rates
        # Each bucket is BUCKET_SECONDS wide, so rate = count * (60 / BUCKET_SECONDS)
        rate_multiplier = 60.0 / BUCKET_SECONDS

        rows = []
        for i in range(num_buckets):
            rows.append({
                "bucket_index": i,
                "timestamp_ms": int(i * BUCKET_SECONDS * 1000),
                "messages_per_min": round(float(msg_counts.iloc[i]) * rate_multiplier, 2),
                "unique_chatters_per_min": round(float(chatter_counts.iloc[i]) * rate_multiplier, 2),
                "high_value_events_per_min": 0.0,
            })

        # Write CSV
        out_path = os.path.join(OUT_DIR, f"{stream_id}.csv")
        out_df = pd.DataFrame(rows)
        out_df.to_csv(out_path, index=False)

        total_messages = int(msg_counts.sum())
        total_chatters = 0
        if commenter_col is not None:
            total_chatters = int(group.loc[offsets.index, commenter_col].nunique())

        avg_msg_per_min = total_messages / (duration_seconds / 60) if duration_seconds > 0 else 0
        peak_msg_per_10s = int(msg_counts.max())

        streams.append({
            "stream_id": stream_id,
            "channel": channel,
            "video_id": str(video_id),
            "csv_file": f"{stream_id}.csv",
            "duration_seconds": round(duration_seconds),
            "num_buckets": num_buckets,
            "total_messages": total_messages,
            "total_chatters": total_chatters,
            "avg_msg_per_min": round(avg_msg_per_min, 2),
            "peak_msg_per_10s": peak_msg_per_10s,
        })

    print(f" {len(streams)} streams")
    return streams


def main():
    pkl_files = find_pkl_files()
    if not pkl_files:
        print(f"No .pkl files found in {RAW_DIR}", file=sys.stderr)
        print("Run download.py first.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Found {len(pkl_files)} pickle files in {RAW_DIR}")

    all_streams = []
    for pkl_path in pkl_files:
        streams = process_pickle(pkl_path)
        all_streams.extend(streams)

    # Write manifest
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(all_streams, f, indent=2)

    print(f"\nDone: {len(all_streams)} streams written to {OUT_DIR}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
