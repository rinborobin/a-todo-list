# Tasks

## Goal

Allow users to create, view, update, complete, and delete their personal tasks.

## Task Data

A task should support:

- Title
- Description
- Priority
- Status
- Estimated duration
- Deadline
- Creation timestamp
- Updated timestamp

## Task Priorities

Initial priorities:

- LOW
- MEDIUM
- HIGH
- URGENT

## Task Status

Initial statuses:

- TODO
- IN_PROGRESS
- COMPLETED
- CANCELLED

## Operations

Users should be able to:

1. Create a task.
2. View their tasks.
3. Update a task.
4. Change task status.
5. Delete a task.
6. Mark a task as completed.

## Validation

The server must validate:

- Required fields
- Valid priority
- Valid status
- Positive estimated duration
- Valid deadline
- Ownership

## Authorization

Users can only read or modify their own tasks.

Never trust a client-provided user ID.

## Planner Integration

Tasks provide input to the AI planner.

The planner should consider:

- Priority
- Deadline
- Estimated duration
- Status

Completed and cancelled tasks should normally be excluded from planning.

## Acceptance Criteria

- CRUD operations work.
- Invalid task data is rejected.
- Users cannot access other users' tasks.
- Completed tasks are represented correctly.
- Task changes are reflected in future planning.
