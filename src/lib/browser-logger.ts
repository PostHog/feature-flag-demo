export type BrowserLogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface BrowserLogMessage {
  level: BrowserLogLevel;
  message: string;
  timestamp: string;
  category?: 'identification' | 'flag-evaluation' | 'flag-switch' | 'flag-call' | 'flag-payload' | 'general';
}

class BrowserLogger {
  private static instance: BrowserLogger;
  private listeners: ((log: BrowserLogMessage) => void)[] = [];
  private logs: BrowserLogMessage[] = [];
  private maxLogs = 50; // Reduced from 100

  private constructor() {
    // No longer intercept console methods - only use explicit logging
  }

  static getInstance(): BrowserLogger {
    if (!BrowserLogger.instance) {
      BrowserLogger.instance = new BrowserLogger();
    }
    return BrowserLogger.instance;
  }

  emit(level: BrowserLogLevel, message: string, category?: BrowserLogMessage['category']): void {
    const log: BrowserLogMessage = {
      level,
      message,
      timestamp: new Date().toISOString(),
      category
    };

    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.listeners.forEach(listener => listener(log));
  }

  // Public methods for explicit logging - no longer log to console to avoid recursion
  info(message: string, category?: BrowserLogMessage['category']): void {
    this.emit('info', message, category);
  }

  warn(message: string, category?: BrowserLogMessage['category']): void {
    this.emit('warn', message, category);
  }

  error(message: string, category?: BrowserLogMessage['category']): void {
    this.emit('error', message, category);
  }

  success(message: string, category?: BrowserLogMessage['category']): void {
    this.emit('success', `✓ ${message}`, category);
  }

  debug(message: string, category?: BrowserLogMessage['category']): void {
    this.emit('debug', `[Debug] ${message}`, category);
  }

  subscribe(listener: (log: BrowserLogMessage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getLogs(): BrowserLogMessage[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

export const browserLogger = BrowserLogger.getInstance();