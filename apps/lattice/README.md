# Lattice

Streamer-facing control plane for Streamlings. Built with Phoenix 1.7 + LiveView, deployed to Fly.io.

## Setup

```bash
mix setup    # Install deps + build assets
mix phx.server   # Start dev server on http://localhost:4000
```

## Tests

```bash
mix test
```

## Deploy

Deployment is handled by CI (`.github/workflows/deploy-lattice.yml`) on push to `main`. To deploy manually:

```bash
cd apps/lattice
flyctl deploy --remote-only
```

Requires `SECRET_KEY_BASE` (generate with `mix phx.gen.secret`) set as a Fly.io secret:

```bash
flyctl secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
```
