"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ScrollText } from "lucide-react";
import { browserLogger, type BrowserLogMessage } from "@/lib/browser-logger";

export function BrowserConsole() {
  const [logs, setLogs] = useState<BrowserLogMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial logs
    setLogs(browserLogger.getLogs());

    // Subscribe to new logs
    const unsubscribe = browserLogger.subscribe((log) => {
      setLogs((prev) => {
        const newLogs = [...prev, log];
        // Keep only last 100 logs
        if (newLogs.length > 100) {
          return newLogs.slice(-100);
        }
        return newLogs;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = () => {
    browserLogger.clear();
    setLogs([]);
  };

  const getLogColor = (level: BrowserLogMessage['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'success':
        return 'text-green-500';
      case 'debug':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  const getCategoryIcon = (category?: BrowserLogMessage['category']) => {
    switch (category) {
      case 'identification':
        return '👤';
      case 'flag-switch':
        return '🔄';
      case 'flag-evaluation':
        return '⚡';
      case 'flag-call':
        return '📡';
      case 'flag-payload':
        return '📦';
      default:
        return '📝';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Browser Console</CardTitle>
            <CardDescription>
              PostHog client-side activity logs
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className={autoScroll ? 'bg-primary/10' : ''}
            >
              <ScrollText className="h-4 w-4 mr-1" />
              Auto-scroll
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={terminalRef}
          className="h-full overflow-y-auto bg-black/90 p-4 font-mono text-sm"
          style={{ minHeight: '300px' }}
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">
              Waiting for browser console activity...
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 flex items-start gap-2 ${getLogColor(
                  log.level
                )}`}
              >
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="text-base">
                  {getCategoryIcon(log.category)}
                </span>
                <span className="flex-1 break-all whitespace-pre-wrap">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}