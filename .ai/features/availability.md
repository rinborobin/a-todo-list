# Availability

## Goal

Allow users to define when they are available for work or study.

## Availability Data

An availability record should support:

- User
- Day of week
- Start time
- End time

## Requirements

Users should be able to:

- Add availability.
- View availability.
- Update availability.
- Delete availability.

## Validation

The server must ensure:

- Start time is before end time.
- Times are valid.
- Day of week is valid.
- The record belongs to the authenticated user.

Overlapping availability should be prevented or normalized by application logic.

## Timezone

Availability must be interpreted using the user's configured timezone.

Do not assume the server timezone is the user's timezone.

## Planner Integration

The planner must not schedule tasks outside the user's available periods.

## Acceptance Criteria

- Users can define recurring availability.
- Availability can be modified.
- Invalid time ranges are rejected.
- Availability is isolated per user.
- The planner respects availability.
