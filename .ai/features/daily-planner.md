# Daily Planner

## Goal

Generate a realistic daily schedule from the user's tasks, availability, constraints, and preferences.

## Inputs

The planner should consider:

- User's tasks
- Task priorities
- Task deadlines
- Estimated task durations
- User availability
- Existing schedule items
- Task dependencies when available
- User preferences
- User timezone

## Planning Flow

### Task Proposal Flow

Users may describe goals in natural language and ask the AI to propose tasks before scheduling:

```text
User describes planning request
        ↓
Authenticate user
        ↓
Retrieve user's planning context
        ↓
Build proposal prompt
        ↓
LLM proposes existing + new tasks
        ↓
Validate proposal against user's data
        ↓
Present proposal for review/edit/remove
        ↓
User confirms
        ↓
Server validates again and creates new Task records
        ↓
Deterministic scheduler generates DailyPlan
        ↓
Display schedule
```

### Schedule Generation Flow

```text
User requests a plan
        ↓
Authenticate user
        ↓
Retrieve user's planning data
        ↓
Validate input
        ↓
Planner Agent
        ↓
LLM (optional ordering suggestion)
        ↓
Structured schedule proposal
        ↓
Validate LLM output
        ↓
Validate business constraints
        ↓
Save DailyPlan
        ↓
Display schedule
```

## Hard Constraints

The application must reject schedules that:

- Contain overlapping tasks.
- Schedule outside availability.
- Reference nonexistent tasks.
- Reference another user's tasks.
- Use invalid time ranges.
- Schedule tasks that cannot be scheduled.

Proposals must also be validated before they are shown to the user:

- Existing task IDs must belong to the current user.
- Existing task IDs must not be duplicated.
- New tasks must pass the same validation as manually created tasks.
- New tasks must not be created until the user explicitly confirms.
- Proposals must not invent tasks or deadlines beyond what the user requested.

## AI Responsibility

The LLM is responsible for reasoning and proposing a schedule.

The LLM is not the source of truth.

Application code must enforce hard constraints.

## Replanning

Users should be able to request a revised plan when:

- A task takes longer than expected.
- A task is completed early.
- A task is cancelled.
- Availability changes.
- A new urgent task is added.

Replanning must preserve completed work and respect the latest application state.

## Schedule Output

The planner should return structured data representing:

- Task ID
- Start time
- End time

Optional metadata may include:

- Reason for prioritization
- Planning notes
- Unscheduled tasks

## Acceptance Criteria

- A user can generate a plan for a date.
- The generated plan respects hard constraints.
- Invalid AI output is rejected.
- The plan is persisted.
- Users can replan.
- Users can only access their own plans.
