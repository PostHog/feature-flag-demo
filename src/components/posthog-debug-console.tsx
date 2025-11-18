"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

interface DebugEvent {
  id: string;
  timestamp: string;
  type: 'event' | 'network' | 'console';
  data: {
    method?: string;
    url?: string;
    payload?: Record<string, unknown> | null;
    level?: string;
    message?: unknown[];
    type?: string;
    flags?: Record<string, unknown>;
  };
}

export function PostHogDebugConsole() {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isCapturing, setIsCapturing] = useState(true);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const addEvent = (type: DebugEvent['type'], data: DebugEvent['data']) => {
    const event: DebugEvent = {
      id: Date.now() + Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      data
    };

    setEvents(prev => [...prev.slice(-49), event]); // Keep last 50 events
  };

  useEffect(() => {
    if (!isCapturing) return;

    // Intercept XMLHttpRequest for PostHog network calls
    const originalXHR = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: unknown[]) {
      const urlString = url.toString();

      // Only capture PostHog-related network calls (exclude session replay /s endpoint)
      if ((urlString.includes('/ingest') || urlString.includes('posthog.com')) && !urlString.includes('/s')) {
        const originalSend = this.send;

        this.send = function(body?: XMLHttpRequestBodyInit | Document | null) {
          addEvent('network', {
            method,
            url: urlString,
            payload: body && typeof body === 'string' ? JSON.parse(body) : null
          });
          return originalSend.call(this, body);
        };
      }

      return originalXHR.apply(this, [method, url, ...args] as Parameters<typeof originalXHR>);
    };

    // Intercept fetch for PostHog network calls
    const originalFetch = window.fetch;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      const url = input.toString();

      // Only capture PostHog-related network calls (exclude session replay /s endpoint)
      if ((url.includes('/ingest') || url.includes('posthog.com')) && !url.includes('/s')) {
        const body = init?.body;
        addEvent('network', {
          method: init?.method || 'GET',
          url,
          payload: body && typeof body === 'string' ? JSON.parse(body) : null
        });
      }

      return originalFetch.call(this, input, init);
    };

    // Intercept console methods to capture PostHog debug logs
    const originalConsoleLog = console.log;
    const originalConsoleDebug = console.debug;

    console.log = function(...args: unknown[]) {
      const message = args.join(' ');
      if (message.includes('PostHog') || message.includes('posthog')) {
        addEvent('console', { level: 'log', message: args });
      }
      return originalConsoleLog.apply(console, args);
    };

    console.debug = function(...args: unknown[]) {
      const message = args.join(' ');
      if (message.includes('PostHog') || message.includes('posthog')) {
        addEvent('console', { level: 'debug', message: args });
      }
      return originalConsoleDebug.apply(console, args);
    };

    // Capture PostHog events using their callback system
    if (posthog) {
      posthog.onFeatureFlags(() => {
        addEvent('event', {
          type: 'feature_flags_loaded',
          flags: (posthog as any).getFlags ? (posthog as any).getFlags() : 'unknown'
        });
      });
    }

    // Cleanup function
    return () => {
      window.XMLHttpRequest.prototype.open = originalXHR;
      window.fetch = originalFetch;
      console.log = originalConsoleLog;
      console.debug = originalConsoleDebug;
    };
  }, [isCapturing]);

  useEffect(() => {
    // Auto-scroll to bottom when new events are added
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const clearConsole = () => {
    setEvents([]);
  };

  const formatEventData = (event: DebugEvent) => {
    switch (event.type) {
      case 'network':
        return (
          <div className="space-y-1">
            <div className="text-blue-600 font-mono text-xs">
              {event.data.method} {event.data.url}
            </div>
            {event.data.payload && (
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(event.data.payload, null, 2)}
              </pre>
            )}
          </div>
        );
      case 'console':
        return (
          <div className="text-green-600 font-mono text-xs">
            [{event.data.level?.toUpperCase() || 'UNKNOWN'}] {JSON.stringify(event.data.message)}
          </div>
        );
      case 'event':
        return (
          <div className="space-y-1">
            <div className="text-purple-600 font-mono text-xs">
              Event: {event.data.type}
            </div>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          </div>
        );
      default:
        return <div className="text-xs">{JSON.stringify(event.data)}</div>;
    }
  };

  return (
    <Card className="w-full h-64 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">PostHog Debug Console</CardTitle>
            <CardDescription className="text-xs">
              Events, network calls, and debug info
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCapturing(!isCapturing)}
              className="text-xs h-7"
            >
              {isCapturing ? 'Pause' : 'Resume'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearConsole}
              className="text-xs h-7"
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-4 pt-0">
        <div className="h-full bg-black text-green-400 font-mono text-xs p-3 rounded overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-gray-500">Waiting for PostHog activity...</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="mb-2 border-b border-gray-800 pb-1">
                <div className="text-gray-400 text-xs mb-1">
                  [{event.timestamp}] {event.type.toUpperCase()}
                </div>
                <div className="text-green-400">
                  {formatEventData(event)}
                </div>
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      </CardContent>
    </Card>
  );
}