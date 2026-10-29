# FinPer

FinPer is a personal finance dashboard for tracking spending, income, subscriptions, investments and annual summaries. The app is built with Next.js, TypeScript, PostgreSQL and Drizzle ORM.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS + shadcn/ui components
- PostgreSQL via Drizzle ORM
- Gemini API for AI-assisted categorization and insights
- Netlify identity sessions for authenticated accounts and browser-isolated guest profiles

## Requirements

- Node.js 20 LTS or newer
- npm or pnpm
- A PostgreSQL database (local or managed, for example Neon)
- A Google Gemini API key
- Optional Turnstile keys for bot protection

## Quick start

1. Install dependencies:
   npm install

2. Copy the example environment file and fill the values:
   cp .env.example .env.local

3. Configure the database and secrets in `.env.local`:
   - DATABASE_URL
   - GEMINI_API_KEY
   - NEXT_PUBLIC_TURNSTILE_SITE_KEY
   - TURNSTILE_SECRET_KEY
   - `FINPER_RATE_LIMIT_BACKEND` es opcional: usa `memory` en desarrollo y `postgres` en producción por defecto.

4. Run the idempotent migration/bootstrap script, including for an existing database, to create any missing tables and indexes:
   npm run migrate

5. Start the dev server:
   npm run dev

Then open http://localhost:3000.

## Scripts

- `npm run dev` – local development server
- `npm run build` – production build
- `npm start` – production server
- `npm test` – unit tests for finance rules and formatting
- `npm run lint` – ESLint checks
- `npm run migrate` – database migration/bootstrap step

## Security and session model

- Netlify Identity access tokens are stored in an HttpOnly cookie and validated with Netlify Identity. Guest sessions use a random browser-specific identifier.
- Authenticated Netlify users and guests are kept separate by a stable server-side identifier, so data is never silently merged across identities.
- The app rejects unknown transaction types and invalid amounts instead of coercing them silently. This keeps financial rules predictable and prevents hidden data corruption.

## Rate limiting

AI-heavy endpoints and PDF parsing use the shared helper in `lib/rate-limit.ts`.

- Development defaults to in-memory rate limiting (`memory`).
- Production defaults to PostgreSQL (`postgres`), which shares atomic request counters across app instances. Run `npm run migrate` to create the required table and indexes before deploying the new version.
- Set `FINPER_RATE_LIMIT_BACKEND=memory` only when intentionally accepting per-process limits, such as a single local development instance.
- If PostgreSQL rate-limit storage is unavailable, the endpoints fail closed and return a service error rather than bypassing the limit.

## Project structure

- `app/` – pages, API routes and server actions
- `components/` – UI building blocks and finance widgets
- `lib/` – validation, finance rules, session handling and shared helpers
- `tests/` – automated checks for financial logic and formatting
- `docs/` – architecture and feature documentation

## Validation

Run the focused checks before shipping changes:

npm test
npx tsc --noEmit
npm run build
