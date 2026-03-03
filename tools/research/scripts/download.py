#!/usr/bin/env python3
"""Download the Harvard Dataverse Twitch Chat Log dataset (2.1 GB 7z archive)."""

import os
import sys

import py7zr
import requests

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
ARCHIVE_PATH = os.path.join(DATA_DIR, "twitch_chat_logs.7z")

# Harvard Dataverse persistent ID for the Twitch chat log 7z file
DOWNLOAD_URL = (
    "https://dataverse.harvard.edu/api/access/datafile/:persistentId"
    "?persistentId=doi:10.7910/DVN/VE0IVQ/5VNGY6"
)


def download_archive():
    """Stream-download the 7z archive with progress reporting."""
    if os.path.exists(ARCHIVE_PATH):
        size_mb = os.path.getsize(ARCHIVE_PATH) / (1024 * 1024)
        print(f"Archive already exists ({size_mb:.0f} MB), skipping download.")
        return

    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Downloading to {ARCHIVE_PATH} ...")

    response = requests.get(DOWNLOAD_URL, stream=True, timeout=60)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    downloaded = 0
    chunk_size = 8 * 1024 * 1024  # 8 MB chunks

    with open(ARCHIVE_PATH, "wb") as f:
        for chunk in response.iter_content(chunk_size=chunk_size):
            f.write(chunk)
            downloaded += len(chunk)
            if total > 0:
                pct = downloaded / total * 100
                mb = downloaded / (1024 * 1024)
                total_mb = total / (1024 * 1024)
                print(f"\r  {mb:.0f} / {total_mb:.0f} MB ({pct:.1f}%)", end="", flush=True)
            else:
                mb = downloaded / (1024 * 1024)
                print(f"\r  {mb:.0f} MB downloaded", end="", flush=True)

    print(f"\nDownload complete: {downloaded / (1024 * 1024):.0f} MB")


def extract_archive():
    """Extract pickle files from the 7z archive."""
    pkl_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".pkl")]
    if pkl_files:
        print(f"Found {len(pkl_files)} .pkl files, skipping extraction.")
        return

    print(f"Extracting {ARCHIVE_PATH} ...")
    with py7zr.SevenZipFile(ARCHIVE_PATH, mode="r") as archive:
        archive.extractall(path=DATA_DIR)

    pkl_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".pkl")]
    print(f"Extracted {len(pkl_files)} pickle files.")


def main():
    try:
        download_archive()
        extract_archive()
    except requests.RequestException as e:
        print(f"\nDownload failed: {e}", file=sys.stderr)
        sys.exit(1)
    except py7zr.exceptions.Bad7zFile as e:
        print(f"\nExtraction failed (corrupt archive?): {e}", file=sys.stderr)
        # Remove corrupt archive so next run re-downloads
        if os.path.exists(ARCHIVE_PATH):
            os.remove(ARCHIVE_PATH)
        sys.exit(1)


if __name__ == "__main__":
    main()
