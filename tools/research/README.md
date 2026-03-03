# Research Pipeline — Validate Mood System Against Real Twitch Data

Validates the energy/mood system against real Twitch chat data from the
[Harvard Dataverse Twitch Chat Log dataset](https://doi.org/10.7910/DVN/VE0IVQ)
(52 streamers, 2,162 streams, timestamped messages).

## Prerequisites

- Python 3.10+ (for data download/preprocessing)
- Node.js + pnpm (for simulation/analysis)
- ~5-8 GB disk space for download + extraction

## Setup

```bash
cd tools/research

# Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Node dependencies (from repo root)
cd ../..
pnpm install
```

## Pipeline

### 1. Download dataset (~15 min, 2.1 GB)

```bash
python3 scripts/download.py
```

Downloads the 7z archive from Harvard Dataverse and extracts pickle files
into `data/raw/`. Skips if already downloaded.

### 2. Preprocess into per-stream CSVs (~5 min)

```bash
python3 scripts/preprocess.py
```

Converts pickle files into 10-second-bucketed CSVs with activity metrics.
Outputs `data/preprocessed/manifest.json` with per-stream metadata.

### 3. Select representative streams (instant)

```bash
python3 scripts/select-streams.py
```

Picks ~5 streams covering small/medium/large channels, bursty patterns,
and long duration. Outputs `data/preprocessed/selected.json`.

### 4. Run simulation (~10 sec)

```bash
npx tsx src/simulate.ts
```

Imports the actual `updateEnergyState` and `updateMoodState` functions and
runs them tick-by-tick against real chat data. Outputs telemetry CSVs to
`output/telemetry/`.

### 5. Analyze results (~5 sec)

```bash
npx tsx src/analyze.ts
```

Computes validation metrics and writes `output/findings.md`.

## Key metrics

| Metric | What it measures | Target |
|--------|-----------------|--------|
| Transitions/hour | Overall frequency | 3-10 |
| Thrash ratio | % of states lasting < 2 min | < 10% |
| Median response time | Activity spike to mood change | 1-3 min |
| Energy range | Min/max/mean energy | Crosses 0.3 regularly |
| Partying reachability | Energy sustains > 1.0 for 45s | Yes for large/bursty |
| Time-in-state % | Distribution across 4 states | Varies by stream |
| Baseline tracking | Baseline converges to mean activity | Within 1 sigma |

## Known limitations

- No sub/bit/cheer data — `highValueEventsPerMin` always 0
- Dataset from 2018 — chat patterns may differ from modern Twitch
- Only ~5 streams selected; run on full manifest for deeper analysis
