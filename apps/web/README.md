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

### Running tests

```sh
# Run all tests (unit + e2e, single pass)
pnpm test

# Run unit/component tests in watch mode
pnpm test:unit

# Run unit/component tests once (CI-friendly)
pnpm test:unit -- --run

# Run Playwright end-to-end tests
pnpm test:e2e
```

### Test structure

The test suite is split into two Vitest projects (configured in `vite.config.js`):

| Project    | Pattern                              | Environment | Purpose                                    |
|------------|--------------------------------------|-------------|--------------------------------------------|
| **client** | `src/**/*.svelte.{test,spec}.{js,ts}` | browser     | Svelte component rendering tests           |
| **server** | `src/**/*.{test,spec}.{js,ts}`        | node        | Server-side logic, database schema tests   |

Playwright e2e tests live in the `e2e/` directory and run against a built preview server.

### Adding a new component test

1. Create a file next to the component with the `.svelte.spec.js` suffix (e.g., `MyWidget.svelte.spec.js`).
2. Import `render` from `vitest-browser-svelte` and `page` from `@vitest/browser/context`.
3. Render the component with props and assert on rendered output:

```js
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MyWidget from './MyWidget.svelte';

describe('MyWidget', () => {
  it('renders the greeting', async () => {
    render(MyWidget, { name: 'World' });
    await expect.element(page.getByText('Hello, World')).toBeInTheDocument();
  });
});
```

Clerk auth is automatically mocked in `vitest-setup-client.js`, so components that use `useClerkContext` work without a real Clerk backend.

### Telemetry mock helper

The `src/lib/test-utils.js` module exports a `mockTelemetry()` function that returns a valid `StreamlingTelemetry` object with sensible defaults. Override any nested field by passing a partial object:

```js
import { mockTelemetry } from '$lib/test-utils.js';

const tel = mockTelemetry({ mood: { currentState: 'partying' } });
// tel.mood.currentState === 'partying'
// tel.energy, tel.recentActivity, etc. have sensible defaults
```

Use this helper in component tests and future dashboard integration tests to avoid duplicating telemetry fixtures.

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
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
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
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `CLERK_SECRET_KEY`: Clerk secret key
