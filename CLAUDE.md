# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Feature flag demonstration application built with Next.js 16, React 19, and PostHog integration. The application demonstrates real-time server-side logging with SSE (Server-Sent Events) and feature flag evaluation patterns.

## Development Commands

```bash
# Development server (uses webpack)
pnpm dev

# Production build (uses webpack)
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

**Important:** This project explicitly uses webpack (`--webpack` flag) instead of Turbopack.

## Architecture

### Three-Pane Layout System

The application uses a resizable three-pane layout ([page.tsx](src/app/page.tsx)):
- **Left pane (PaneOne):** PostHog configuration and feature flag evaluation settings
- **Top-right pane (PaneTwo):** Log control panel with server action triggers
- **Bottom-right pane (PaneThree):** Real-time log terminal displaying server events

### Real-Time Logging System

Server-side logging architecture using Server-Sent Events:

1. **Log Emitter ([lib/log-emitter.ts](src/lib/log-emitter.ts)):** Singleton EventEmitter that broadcasts log messages server-side
   - Supports 5 log levels: info, warn, error, success, debug
   - Maximum 100 concurrent listeners for multiple SSE connections

2. **SSE Endpoint ([app/api/logs/route.ts](src/app/api/logs/route.ts)):** GET endpoint that streams logs to clients
   - Uses `force-dynamic` to prevent caching
   - Maintains persistent connection with proper cleanup on disconnect
   - Returns `text/event-stream` with no-cache headers

3. **Server Actions ([app/actions.ts](src/app/actions.ts)):** Server-side functions that generate logs via logEmitter
   - All actions use `'use server'` directive
   - Include simulated async operations with delays

4. **Client Terminal ([components/log-terminal.tsx](src/components/log-terminal.tsx)):** Consumes SSE stream and displays logs

### PostHog Integration

PostHog analytics and feature flags are configured with:
- Client-side initialization in [instrumentation-client.ts](instrumentation-client.ts)
- Reverse proxy setup in [next.config.ts](next.config.ts) (`/ingest/*` routes)
- Environment variables in `.env.local` (PostHog keys)
- Error tracking and debug mode enabled in development

**Note:** API keys are already committed in `.env.local` - these are demo keys for this project.

### Shadcn UI Integration

UI components use shadcn/ui with "new-york" style:
- Component path: `@/components/ui`
- Configuration: [components.json](components.json)
- Add new components: `npx shadcn@latest add <component-name>`
- Path aliases configured via tsconfig.json (`@/*` → `./src/*`)

## Key Patterns

### Server Actions with Logging

When creating new server actions:
```typescript
'use server';
import { logEmitter } from '@/lib/log-emitter';

export async function myAction() {
  logEmitter.info('Starting action...');
  // ... logic
  logEmitter.success('Action completed');
}
```

### Client Components with Server Actions

Pane components follow this pattern:
- Mark as client components with `'use client'`
- Import server actions from `@/app/actions`
- Maintain loading states during async operations
- Use shadcn UI components for consistent styling

## Technology Stack

- **Framework:** Next.js 16 (App Router, React Server Components)
- **React:** 19.2.0
- **Styling:** Tailwind CSS 4.0 with CSS variables
- **UI Components:** Shadcn UI (Radix UI primitives)
- **Analytics:** PostHog (client + server SDKs)
- **Fonts:** Geist Sans & Geist Mono
- **Animation:** Motion (formerly Framer Motion)
- **Package Manager:** pnpm

## MCP Servers

Configured MCP servers in `.mcp.json`:
- **shadcn:** UI component management (`npx shadcn@latest mcp`)
- **playwright:** Browser automation testing
