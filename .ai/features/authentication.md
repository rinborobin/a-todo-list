# Authentication

## Goal

Provide secure user registration, login, logout, and session management.

## Requirements

- Users can register with an email and password.
- Users can log in with valid credentials.
- Users can log out.
- Protected pages require authentication.
- Sessions must be securely managed.
- Passwords must never be stored in plaintext.
- Authentication failures must return safe, useful errors.
- A user can only access their own data.

## Authorization

Every protected server operation must identify the authenticated user and enforce ownership.

Never trust a user ID supplied by the client.

## Validation

Validate registration and login input on the server.

At minimum:

- Valid email format
- Required password
- Appropriate password requirements

## Error Handling

Do not reveal whether an account exists when doing so would create a security issue.

Do not expose stack traces, secrets, or internal authentication details.

## Acceptance Criteria

- Registration works.
- Login works.
- Invalid credentials are rejected.
- Logout works.
- Unauthenticated users cannot access protected application functionality.
- Authenticated users cannot access another user's data.
