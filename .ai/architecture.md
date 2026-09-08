# AI Daily Planner — Architecture

## 1. Overview

AI Daily Planner is a full-stack web application that allows users to manage tasks, define availability, and use an AI planner to generate and modify daily schedules.

The application follows a modular full-stack architecture using Next.js.

The main architectural goals are:

- Clear separation of responsibilities
- Strong type safety
- Secure server-side operations
- Reliable database access
- Controlled AI integration
- Easy local development
- Simple production deployment

---

# 2. Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- Next.js Server Components
- Server Actions
- Route Handlers
- TypeScript
- Zod

## Database

- PostgreSQL
- Drizzle ORM
- Neon PostgreSQL

## Authentication

- Better Auth

## AI

- Vercel AI SDK
- LLM provider

## Deployment

- Vercel
- Neon

## Version Control

- Git
- GitHub

---

# 3. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │        User          │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Next.js         │
                    │                      │
                    │  React UI            │
                    │  Server Components   │
                    │  Server Actions      │
                    │  Route Handlers      │
                    └───────┬──────┬───────┘
                            │      │
                  ┌─────────┘      └──────────┐
                  ▼                           ▼
          ┌───────────────┐           ┌───────────────┐
          │ PostgreSQL    │           │  AI Planner   │
          │               │           │               │
          │ Drizzle ORM   │           │  Vercel AI    │
          └───────────────┘           └───────┬───────┘
                                              │
                                              ▼
                                             LLM
```

# Client Platform Strategy

The application must support both desktop and mobile users.

## Primary Client

The primary client is a responsive Next.js web application.

The UI must adapt to:

- Desktop
- Laptop
- Tablet
- Mobile

Mobile usability is a first-class requirement and must not be treated as an afterthought.

## Responsive Design

All major application features must remain usable on small screens.

Important interactions such as:

- Viewing today's schedule
- Creating tasks
- Completing tasks
- Replanning
- Viewing deadlines
- AI interaction

must be accessible on mobile.

Avoid desktop-only interactions such as relying exclusively on:

- Hover
- Large tables
- Wide sidebars
- Multi-column layouts
- Precise mouse interactions

## Client Independence

Business logic must remain on the server.

The application must not place critical business logic exclusively inside React components.

Server-side functionality should be designed so that a future native mobile client can consume the same application capabilities.

## Future Native Client

If a native mobile application is introduced later, it should communicate with the existing backend rather than duplicating business logic.

Potential future clients:

- Web / Desktop: Next.js
- Mobile: React Native / Expo

The backend remains the shared source of application logic and data.

## PWA

The web application should eventually support Progressive Web App functionality where appropriate.

Potential PWA capabilities include:

- Home-screen installation
- App-like mobile experience
- Offline caching for appropriate read-only data
- Push notifications where supported

Offline functionality must not compromise data consistency.
