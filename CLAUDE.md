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

Server-side logging architecture using Server-Sent Events (SSE) to stream logs from server actions to the client terminal in real-time.

**Architecture Overview:**
```
Server Action → fetch(/api/emit-log) → EventEmitter → SSE Stream → Terminal Component
```

**Components:**

1. **Log Emitter ([lib/log-emitter.ts](src/lib/log-emitter.ts)):** Singleton EventEmitter that broadcasts log messages
   - Supports 5 log levels: info, warn, error, success, debug
   - Uses `globalThis` for cross-context singleton sharing
   - Maximum 100 concurrent listeners for multiple SSE connections

2. **Emit Log API ([app/api/emit-log/route.ts](src/app/api/emit-log/route.ts)):** Internal API bridge endpoint
   - POST endpoint that receives log messages from server actions
   - Emits logs to the EventEmitter, which broadcasts to all SSE connections
   - Solves Next.js worker process isolation issue

3. **SSE Endpoint ([app/api/logs/route.ts](src/app/api/logs/route.ts)):** Streams logs to clients via Server-Sent Events
   - GET endpoint with `force-dynamic` to prevent caching
   - Maintains persistent connection with proper cleanup on disconnect
   - Returns `text/event-stream` with no-cache headers
   - Sends initial connection message and subscribes to log events

4. **Server Actions ([app/actions.ts](src/app/actions.ts)):** Server-side functions that emit logs via API calls
   - Use `'use server'` directive
   - Call internal `emitLog()` helper that fetches `/api/emit-log`
   - Include simulated async operations with delays for demo purposes

5. **Client Terminal ([components/log-terminal.tsx](src/components/log-terminal.tsx)):** React component that displays logs
   - Uses EventSource API to consume SSE stream from `/api/logs`
   - Auto-scrolls to show latest logs
   - Color-coded log levels with emoji indicators
   - Connection status indicator
   - Configurable max log limit (default 100)

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

When creating new server actions, emit logs via the internal API to ensure they reach the SSE stream:

```typescript
'use server';
import { LogMessage } from '@/lib/log-emitter';

// Helper function to emit logs via API endpoint
async function emitLog(level: LogMessage['level'], message: string) {
  try {
    await fetch('http://localhost:3000/api/emit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message }),
    });
  } catch (error) {
    console.error('Failed to emit log:', error);
  }
}

export async function myAction() {
  await emitLog('info', 'Starting action...');
  // ... your logic here
  await emitLog('success', 'Action completed');
}
```

**Why this pattern?** Next.js 16 runs server actions in separate worker processes from route handlers. Direct `logEmitter` calls won't reach the SSE stream. The `/api/emit-log` endpoint bridges this gap by running in the same process as the SSE route.

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
