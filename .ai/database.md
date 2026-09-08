# AI Daily Planner — Database Specification

## Database

The application uses PostgreSQL as its primary persistent data store.

Database access is handled through Drizzle ORM.

Production database:

- Neon PostgreSQL

The database is the authoritative source of application data.

## Core Entities

The initial application contains:

- User
- Task
- Availability
- DailyPlan
- ScheduleItem

Relationship overview:

```text
User
 ├── Tasks
 ├── Availability
 └── DailyPlans
        └── ScheduleItems
```

## User

Represents an authenticated application user.

Conceptual fields:

```text
User
├── id
├── name
├── email
├── createdAt
└── updatedAt
```

Authentication-specific fields should follow the requirements of the authentication library.

User IDs must be unique.

Email addresses must be unique.

## Task

Represents work the user needs to complete.

Conceptual fields:

```text
Task
├── id
├── userId
├── title
├── description
├── priority
├── status
├── estimatedMinutes
├── deadline
├── createdAt
└── updatedAt
```

Relationship:

```text
User 1 ──────── * Task
```

Every task belongs to exactly one user.

A task must never be accessible by another user.

## Task Priority

Initial priority levels:

```text
LOW
MEDIUM
HIGH
URGENT
```

Priority is used by the planner when determining scheduling order.

## Task Status

Initial task states:

```text
TODO
IN_PROGRESS
COMPLETED
CANCELLED
```

A completed task should not normally be scheduled again.

## Availability

Represents periods during which a user is available.

Conceptual fields:

```text
Availability
├── id
├── userId
├── dayOfWeek
├── startTime
├── endTime
├── createdAt
└── updatedAt
```

Relationship:

```text
User 1 ──────── * Availability
```

The application must validate:

```text
startTime < endTime
```

## Daily Plan

Represents the schedule generated for a user on a particular date.

Conceptual fields:

```text
DailyPlan
├── id
├── userId
├── date
├── createdAt
└── updatedAt
```

Relationship:

```text
User 1 ──────── * DailyPlan
```

A user should normally have at most one active plan for a given date.

## Schedule Item

Represents a task scheduled inside a DailyPlan.

Conceptual fields:

```text
ScheduleItem
├── id
├── dailyPlanId
├── taskId
├── startTime
├── endTime
├── status
└── createdAt
```

Relationships:

```text
DailyPlan 1 ──────── * ScheduleItem
Task      1 ──────── * ScheduleItem
```

A schedule item must reference an existing task.

## Ownership and Security

User ownership is a fundamental security requirement.

Conceptually:

```text
User A
 ├── Task A1
 ├── Task A2
 └── Plan A1

User B
 ├── Task B1
 └── Plan B1
```

User A must never be able to access User B's data.

Server-side queries must always enforce ownership.

Never trust a client-provided `userId`.

## IDs

Use stable unique identifiers for database entities.

IDs should not depend on user-visible names.

Use the database or established library mechanism for ID generation.

## Timestamps

Persistent entities should generally include:

```text
createdAt
updatedAt
```

Persist timestamps consistently.

Use UTC for persisted timestamps.

Timezone-aware scheduling must be handled explicitly at the application level.

## Time and Timezone

The planner must distinguish between:

- Date
- Time
- Timestamp
- Timezone

The user's timezone should be stored when required.

Do not silently assume that the server timezone is the user's timezone.

## Database Constraints

Use database constraints where they provide meaningful data integrity.

Examples:

- Primary keys
- Foreign keys
- Unique constraints
- Not-null constraints
- Appropriate indexes
- Check constraints where appropriate

Do not rely exclusively on frontend validation.

## Indexing

Indexes should be based on actual query patterns.

Likely indexed fields include:

```text
Task.userId
Task.deadline
Task.status

Availability.userId

DailyPlan.userId
DailyPlan.date

ScheduleItem.dailyPlanId
ScheduleItem.taskId
```

Do not create indexes for every column.

## Cascading Deletes

Relationships must define appropriate deletion behavior.

Deleting a user must not leave orphaned user-owned records.

Ownership hierarchy:

```text
User
 ├── Tasks
 ├── Availability
 └── DailyPlans
        └── ScheduleItems
```

Deletion behavior must be explicitly considered when implementing foreign keys.

## AI Data

AI-generated schedules must not be treated as inherently trustworthy.

The database should only receive validated data.

Pipeline:

```text
LLM
 ↓
Structured response
 ↓
Schema validation
 ↓
Business validation
 ↓
Database transaction
```

If validation fails, the generated schedule must not be persisted.

## Transactions

Use database transactions when multiple related records must be modified atomically.

Example:

```text
Generate Daily Plan
        ↓
Create DailyPlan
        ↓
Create ScheduleItems
        ↓
Commit
```

If a required operation fails, roll back the transaction where appropriate.

## Migrations

All database schema changes must be represented through migrations.

Development workflow:

```text
Modify Drizzle schema
        ↓
Generate migration
        ↓
Review migration
        ↓
Apply migration
        ↓
Test
```

Never make undocumented production schema changes.

## Data Access

Database queries must remain server-side.

```text
Browser
  X
  │
  │ Direct database access prohibited
  │
Server
  │
  ▼
Drizzle
  │
  ▼
PostgreSQL
```

The client should interact with server actions or API endpoints.

## Future Entities

Potential future entities include:

```text
CalendarEvent
RecurringTask
TaskDependency
UserPreference
Notification
AIConversation
AIMessage
Project
Tag
```

Do not implement these until a real feature requires them.

## Source of Truth

The database is authoritative for:

- Users
- Tasks
- Availability
- Daily plans
- Schedule items
- Persistent user preferences

The LLM is not authoritative.

The client is not authoritative.

## Current Database Status

This document defines the initial database architecture.

The actual Drizzle schema should be created incrementally as features are implemented.

Do not build unnecessary tables before their corresponding features exist.
