 AI Daily Planner

A full-stack web application that helps users organize their tasks and generate realistic daily schedules using AI.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL via Drizzle ORM (Neon) |
| Auth | Better Auth |
| AI | Vercel AI SDK + Google Gemini |
| Deployment | Vercel |

## Local Development

### Prerequisites

- Node.js >= 20
- A [Neon](https://neon.tech) PostgreSQL database
- A [Google Cloud](https://console.cloud.google.com) project with OAuth credentials
- A [Google AI Studio](https://aistudio.google.com) API key

### Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd a-todo-list
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   # Fill in all values in .env.local
   ```

3. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Project Structure

```
src/
  app/          # Next.js App Router pages and layouts
  db/           # Drizzle ORM client and schema
  lib/          # Shared server utilities (env, auth, etc.)
  components/   # Shared UI components (added per feature)
drizzle/        # Generated migration files
.ai/            # Project documentation and architecture specs
```

## Environment Variables

See [`.env.example`](.env.example) for the full list of required variables.

## Deployment

The application is deployed to [Vercel](https://vercel.com) with [Neon](https://neon.tech) as the managed PostgreSQL provider.

Configure all environment variables from `.env.example` in your Vercel project settings before deploying.
