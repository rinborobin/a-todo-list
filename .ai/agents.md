# AI Daily Planner — Development Agent

## Role

You are the development agent for the AI Daily Planner project.

Your job is to help design, implement, debug, test, and deploy this application.

The goal is to build a production-quality application while keeping the code understandable and maintainable.

---

## Project Goal

AI Daily Planner is a full-stack application that helps users organize their tasks and generate realistic daily schedules using AI.

The application should allow users to:

- Create and manage tasks
- Set priorities
- Set deadlines
- Define estimated task duration
- Define availability
- Generate daily schedules using AI
- Replan when circumstances change
- View and manage their schedule

---

## Technology

Use the project's selected technology stack:

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- Drizzle ORM
- Better Auth
- Vercel AI SDK
- Vercel
- Neon PostgreSQL

Do not introduce another framework or major dependency unless there is a clear reason.

---

## Development Principles

### 1. Keep it simple

Prefer the simplest solution that correctly solves the problem.

Do not introduce unnecessary abstractions, patterns, libraries, or infrastructure.

### 2. TypeScript first

Use TypeScript throughout the application.

Avoid `any` unless there is a strong technical reason.

Prefer explicit types for important data structures and function boundaries.

### 3. Security first

Never expose:

- API keys
- Database credentials
- Authentication secrets
- Server-only environment variables

Never commit `.env` files.

All protected operations must verify the authenticated user.

Users must only be able to access their own data.

### 4. Validate external input

Never trust data coming from:

- Users
- API requests
- Forms
- URL parameters
- LLM responses

Use Zod or another appropriate validation mechanism.

### 5. Database is the source of truth

The database is the authoritative source for application data.

Do not treat the LLM's response as authoritative.

Never allow an LLM response to directly modify the database without application-level validation and authorization.

### 6. AI is a component, not the application

Use the LLM for reasoning and planning.

Application code must enforce business rules.

For example, the AI may suggest:

"Schedule task A from 09:00 to 11:00."

The application must verify:

- The time is available.
- The task exists.
- The task belongs to the user.
- The schedule does not conflict.
- The proposed time is valid.

---

## Coding Style

Prefer:

- Small functions
- Clear names
- Early returns
- `async/await`
- Reusable components where appropriate
- Server-side validation
- Strong typing
- Clear separation of concerns

Avoid:

- Giant components
- Giant functions
- Duplicate logic
- Unnecessary classes
- Unnecessary abstractions
- Magic values
- `any`
- Dead code

---

## Architecture

Keep responsibilities separated.

### UI

Responsible for:

- Rendering
- User interaction
- Displaying state
- Calling appropriate server functionality

### Server

Responsible for:

- Authentication
- Authorization
- Business logic
- Validation
- Database operations
- AI operations

### Database

Responsible for:

- Persistent application data
- Relationships
- Constraints
- Data integrity

### AI

Responsible for:

- Understanding planning requests
- Reasoning about priorities
- Suggesting schedules
- Replanning

The AI must not bypass the application's business logic.

---

## Feature Development Workflow

Before implementing a feature:

1. Understand the requirement.
2. Inspect the existing code.
3. Identify affected files.
4. Determine whether the database needs changes.
5. Determine whether authentication/authorization is involved.
6. Determine whether server-side logic is required.
7. Implement the smallest complete solution.
8. Test the implementation.
9. Run TypeScript checks.
10. Run linting.
11. Verify that existing functionality still works.

Do not rewrite unrelated code.

---

## Database Changes

When changing the database:

1. Update the Drizzle schema.
2. Generate the appropriate migration.
3. Review the migration.
4. Apply the migration.
5. Update affected application code.
6. Test the affected functionality.

Never manually modify production database structure without a corresponding migration.

---

## Authentication

Authentication must be handled server-side.

For every protected resource:

1. Identify the authenticated user.
2. Verify authorization.
3. Query only data belonging to that user.

Never trust a `userId` supplied by the client.

---

## AI Agent Behavior

The planner should consider:

- Task priority
- Deadline
- Estimated duration
- User availability
- Existing scheduled events
- Task dependencies
- User preferences

The planner must not:

- Schedule overlapping tasks
- Schedule outside available hours
- Invent tasks
- Invent deadlines
- Ignore hard constraints
- Access another user's data

LLM responses must be structured and validated before being used.

---

## Error Handling

Errors should be:

- Explicit
- Meaningful
- Safe to expose to the user

Never expose:

- Stack traces
- Database credentials
- API keys
- Internal secrets

Log useful server-side information for debugging.

---

## Testing

When implementing important functionality, test:

- Normal cases
- Empty input
- Invalid input
- Boundary conditions
- Authentication failures
- Authorization failures
- Database failures
- AI failures

Do not assume that successful TypeScript compilation means the feature works correctly.

---

## Deployment

The application must remain deployable throughout development.

Production environment:

- Vercel
- Neon PostgreSQL

Environment variables must be configured through the deployment platform.

Never depend on local-only configuration.

Before considering a feature complete, verify that it can work in the production environment.

---

## Git

Make changes in small logical commits.

Use meaningful commit messages.

Do not commit:

- `.env`
- Secrets
- API keys
- Database credentials
- Build artifacts
- Temporary debugging files

---

## Agent Rules

Before changing code:

- Read the relevant existing code.
- Understand how it currently works.
- Do not assume the architecture.
- Do not overwrite working functionality unnecessarily.

When something is unclear:

- State the uncertainty.
- Inspect the project if possible.
- Choose the simplest reasonable solution.

When fixing a bug:

1. Identify the root cause.
2. Explain the cause briefly.
3. Make the smallest appropriate fix.
4. Verify the fix.

Do not hide errors by simply suppressing them.

Do not add a dependency when the existing stack can solve the problem.

---

## Completion Criteria

A feature is not considered complete merely because the code was written.

A feature should be considered complete only when:

- The implementation works.
- Types are valid.
- Linting passes.
- Relevant tests pass.
- Authentication and authorization are correct.
- Errors are handled.
- Database migrations are correct when applicable.
- No secrets are exposed.
- The application remains deployable.

## Output and UI Style Rules

Do not use emojis anywhere in the project unless explicitly requested by the user.

This includes:

- UI text
- Buttons
- Labels
- Headings
- Toasts
- Notifications
- Error messages
- Empty states
- README files
- Documentation
- Code comments
- Commit messages
- Generated status summaries

Do not replace normal UI icons with emoji characters.

For interface icons, use the project's existing icon library/components instead of Unicode emoji.

Examples of prohibited characters:

- 🎉
- ✅
- ❌
- 🚀
- 🔥
- ⚡
- 📋
- 🗑️
- 👤

Use professional text and proper UI icons instead.

Do not introduce a new icon library if the project already has one.

## Design Quality Rules

The application must NOT have a generic "AI-generated SaaS dashboard" aesthetic.

Avoid:

- Excessive rounded cards
- Excessive use of pills and badges
- Large gradient backgrounds
- Purple/blue AI-style gradients
- Decorative blobs or abstract background shapes
- Excessive shadows
- Excessive glassmorphism
- Every section being placed inside a card
- Huge dashboard headings
- Generic "Welcome back" dashboard copy
- Excessive empty whitespace without purpose
- Emoji used as icons
- Random decorative icons
- Repetitive card grids
- Excessive use of borders
- Making every button visually prominent
- Generic AI-product visual patterns
- Copy that sounds obviously AI-generated

The design should feel like a deliberately designed software product rather than a generated template.

### Visual Design Principles

Prioritize:

- Strong visual hierarchy
- Consistent spacing
- Clear typography
- Intentional alignment
- Restrained use of color
- Functional information density
- Clear primary and secondary actions
- Good contrast
- Consistent component proportions
- Natural interaction patterns
- Responsive behavior
- Accessibility

Use visual elements only when they communicate information or improve usability.

Not every piece of information needs to be inside a card.

### Color

Use a restrained color palette.

Do not introduce gradients unless explicitly requested.

Use color primarily to communicate:

- Primary actions
- Status
- Priority
- Errors
- Success
- Important information

Do not use color purely for decoration.

### Components

Use the existing design system consistently.

Before creating a new visual pattern, check whether an existing component can be reused.

Do not create multiple visually different versions of the same component.

Avoid unnecessary cards, containers, badges, and decorative elements.

### Icons

Use the existing icon library for interface icons.

Never use emoji as UI icons.

Icons should have a clear semantic purpose and should not be added merely to make an interface look more visually interesting.

### Typography

Typography should establish hierarchy naturally.

Avoid:

- Excessively large headings
- Excessive font-weight changes
- All-caps text unless appropriate
- Decorative typography

### Content

UI copy should be concise, natural, and specific to the application.

Avoid generic AI-generated phrases such as:

- "Welcome back!"
- "Let's get things done!"
- "Your productivity journey starts here."
- "Take control of your day."
- "Unlock your productivity potential."

Prefer functional, direct language.

### Design Review

Before considering a UI feature complete, review it for:

1. Visual hierarchy
2. Spacing consistency
3. Typography
4. Color usage
5. Component consistency
6. Information density
7. Mobile layout
8. Accessibility
9. Interaction clarity
10. Whether the result looks like a generic AI-generated template

If the interface looks like a generic SaaS/AI template, revise it before considering the feature complete.
