# Responsive UI

## Goal

Provide a consistent, usable experience across desktop, laptop, tablet, and mobile devices.

## Platforms

The primary client is a responsive Next.js web application.

The application should work well on:

- Desktop
- Laptop
- Tablet
- Mobile

## Design Principles

Mobile is a first-class platform.

Do not build a desktop-only interface and simply shrink it for mobile.

Important functionality must remain accessible on small screens.

## Core Mobile Features

Users must be able to:

- View today's schedule.
- View tasks.
- Create tasks.
- Complete tasks.
- View deadlines.
- Request an AI plan.
- Replan their day.
- Manage availability.

## Desktop Layout

Desktop may use:

- Sidebar navigation
- Multi-column layouts
- Larger schedule views
- Expanded task information

## Mobile Layout

Mobile may use:

- Bottom navigation
- Compact headers
- Stacked cards
- Collapsible sections
- Touch-friendly controls

Avoid interactions that depend exclusively on hover.

## Responsive Components

Components should adapt their layout rather than duplicate entire implementations for each device.

Use the shared design system provided by Tailwind CSS and shadcn/ui.

## PWA

PWA support may be added after the core application is stable.

Potential capabilities:

- Home-screen installation
- App-like mobile experience
- Appropriate offline caching
- Push notifications where supported

Offline functionality must not compromise data consistency.

## Acceptance Criteria

- Core functionality works on mobile.
- Core functionality works on desktop.
- Layouts remain usable at common screen sizes.
- Interactive controls are touch-friendly.
- No critical feature depends on hover.
