# Streamlings Web App

The frontend application for Streamlings, built with SvelteKit 5 and deployed to Cloudflare Pages.

## Tech Stack

- **Framework**: SvelteKit 5 with Svelte 5
- **Styling**: TailwindCSS v4
- **Authentication**: Clerk Auth
- **Database**: Cloudflare D1 with Drizzle ORM
- **Deployment**: Cloudflare Pages

## Development

Start the development server:

```sh
pnpm dev
```

## Building

Build for production:

```sh
pnpm build
```

Preview the production build:

```sh
pnpm preview
```

## Testing

```sh
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run e2e tests
pnpm test:e2e
```

## Database

The app uses Drizzle ORM with Cloudflare D1 (SQLite) for production and local file for development.

```sh
# Push schema changes to local database
pnpm db:push

# Generate migration files
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

## Deployment

The app automatically deploys to Cloudflare Pages when changes are pushed to the `main` branch.

### Setup Cloudflare Pages Project

1. **Create D1 Database:**
   ```sh
   # Create production database
   wrangler d1 create streamlings-db

   # Create preview database
   wrangler d1 create streamlings-db-preview
   ```

2. **Update wrangler.toml** with the database IDs returned from the commands above

3. **Run migrations on D1:**
   ```sh
   # For production
   wrangler d1 execute streamlings-db --remote --file=drizzle/migrations/xxxx.sql

   # For preview
   wrangler d1 execute streamlings-db-preview --remote --file=drizzle/migrations/xxxx.sql
   ```

4. **Set up environment variables** in Cloudflare Dashboard:
   - Go to Workers & Pages → streamlings-web → Settings → Environment Variables
   - Add the following variables:

**Production & Preview:**
- `PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
- `CLERK_SECRET_KEY`: Your Clerk secret key (encrypted)
- `DATABASE_URL`: Will be automatically bound from D1 (no manual config needed)

### GitHub Secrets Required

Ensure these secrets are set in your GitHub repository:
- `CLOUDFLARE_API_TOKEN`: API token with Pages write access
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```sh
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: Database connection string (local: `file:local.db`)
- `PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `CLERK_SECRET_KEY`: Clerk secret key
