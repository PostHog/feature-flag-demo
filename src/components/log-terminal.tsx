'use client';

import { useEffect, useRef, useState } from 'react';
import { LogMessage } from '@/lib/log-emitter';

interface LogTerminalProps {
  maxLogs?: number;
  autoScroll?: boolean;
}

export function LogTerminal({ maxLogs = 100, autoScroll = true }: LogTerminalProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create EventSource connection
    const eventSource = new EventSource('/api/logs');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('✅ SSE connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const log: LogMessage = JSON.parse(event.data);
        setLogs((prevLogs) => {
          const newLogs = [...prevLogs, log];
          // Keep only the last maxLogs entries
          return newLogs.slice(-maxLogs);
        });
      } catch (error) {
        console.error('Error parsing log message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      setIsConnected(false);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [maxLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const formatLog = (log: LogMessage) => {
    const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    const levelEmoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅',
      debug: '🔍',
    };

    return `[${time}] ${levelEmoji[log.level]} ${log.message}`;
  };

  const getLevelColor = (level: LogMessage['level']) => {
    const colors = {
      info: 'text-blue-400',
      warn: 'text-yellow-400',
      error: 'text-red-400',
      success: 'text-green-400',
      debug: 'text-gray-400',
    };
    return colors[level];
  };

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-border bg-background shadow-md overflow-hidden">
      {/* Header with macOS dots and title */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500"></div>
          <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
        </div>
        <h3 className="text-sm font-semibold">Server logs</h3>
      </div>

      {/* Log content */}
      <div ref={terminalRef} className="flex-1 overflow-auto p-4">
        <pre>
          <code className="grid gap-y-1">
            {logs.length === 0 && (
              <div className="text-muted-foreground text-sm">
                Waiting for logs...
              </div>
            )}
            {logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={`font-mono text-sm ${getLevelColor(log.level)}`}
              >
                {formatLog(log)}
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Footer with connection status */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-border bg-muted/50">
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}
