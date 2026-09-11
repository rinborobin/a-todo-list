<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Daily Planner — Agent Quick Reference

Single-package Next.js 16 app (App Router). See `.ai/` for detailed specs and feature requirements.

## Stack & versions

- Next.js 16.3.4, React 19.2.8, TypeScript 5
- Tailwind CSS v4 (CSS-based config — no `tailwind.config` file)
- shadcn/ui components in `src/components/ui/`
- PostgreSQL via Drizzle ORM + Neon (`@neondatabase/serverless`)
- Better Auth (email/password + Google OAuth)
- Vercel AI SDK + Google Gemini

## Daily commands

```bash
npm run dev          # Next.js dev server on http://localhost:3000
npm run build        # Production build (also typechecks; no separate tsc script)
npm run lint         # ESLint only
npm run db:generate  # Generate Drizzle migrations from src/db/schema.ts
npm run db:migrate   # Apply pending migrations
npm run db:studio    # Drizzle Studio
```

There is no test runner configured yet.

## Environment setup

Copy `.env.example` to `.env.local` and fill all values. Required vars are enforced at runtime by `src/lib/env.ts`:

- `DATABASE_URL` — Neon pooled connection string
- `DATABASE_URL_UNPOOLED` — used by `drizzle-kit` for migrations/studio (`drizzle.config.ts`)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Google OAuth redirect URI must be `{BETTER_AUTH_URL}/api/auth/callback/google`.

## Architecture boundaries

```text
src/app/        # Next.js pages, layouts, API routes
src/actions/    # Server Actions (despite the folder name, queries also live here)
src/db/         # Drizzle client (index.ts) and schema (schema.ts)
src/lib/        # Server-only utilities: auth, env, session
src/components/ # UI components: auth/, tasks/, ui/
drizzle/        # Generated migration files
.ai/            # Project specs and agent instructions
```

Server-only modules import `"server-only"`. Never import `src/lib/env.ts`, `src/lib/auth.ts`, `src/lib/session.ts`, or `src/db/index.ts` into client components.

## Authentication

- Better Auth handler exposed at `src/app/api/auth/[...all]/route.ts`.
- Auth client is `src/lib/auth-client.ts`.
- Session helpers are in `src/lib/session.ts`: `getSession()`, `getCurrentUser()`, `requireAuth()`, `assertUserOwnership()`.
- `src/middleware.ts` protects `/dashboard`, `/tasks`, `/availability`, `/planner`; redirects unauthenticated users to `/login` and authenticated users away from `/login`/`/register`.

## Database workflow

1. Edit `src/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review generated SQL in `drizzle/`.
4. Run `npm run db:migrate`.
5. Update affected application code.

Migrations require `DATABASE_URL_UNPOOLED` to be set in `.env.local`.

## AI / planner guardrails

- The LLM proposes schedules; application code enforces constraints.
- Validate every LLM response with Zod before persisting.
- Never let an LLM output write directly to the database.
- Hard constraints: no overlapping tasks, no scheduling outside availability, no referencing another user's tasks, no inventing tasks/deadlines.

## Style constraints

- No emojis anywhere in the project unless explicitly requested.
- Avoid a generic “AI-generated SaaS dashboard” aesthetic: no excessive cards/pills/gradients/glassmorphism, no huge headings, no generic “Welcome back” copy.
- Use the existing shadcn/ui design system and existing icon components; do not introduce a new icon library.

## Verification before finishing

Run in this order:

```bash
npm run lint
npm run build
```

`build` is the only typecheck gate (no `tsc --noEmit` script). Always verify protected routes still enforce ownership and that `.env*` secrets are not committed.
