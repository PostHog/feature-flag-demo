export type BrowserLogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface BrowserLogMessage {
  level: BrowserLogLevel;
  message: string;
  timestamp: string;
  category?: 'identification' | 'flag-evaluation' | 'flag-switch' | 'flag-call' | 'flag-payload' | 'app-lifecycle' | 'general';
}

class BrowserLogger {
  private static instance: BrowserLogger;
  private listeners: ((log: BrowserLogMessage) => void)[] = [];
  private logs: BrowserLogMessage[] = [];
  private maxLogs = 50; // Reduced from 100
  private recentMessages = new Map<string, number>(); // For deduplication
  private duplicateThreshold = 3000; // 3 seconds

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
    const now = Date.now();
    const messageKey = `${level}:${message}:${category || 'general'}`;

    // Check for recent duplicate
    const lastSeen = this.recentMessages.get(messageKey);
    if (lastSeen && (now - lastSeen) < this.duplicateThreshold) {
      // Skip duplicate message within threshold
      return;
    }

    // Update recent message timestamp
    this.recentMessages.set(messageKey, now);

    // Clean up old entries
    this.cleanupRecentMessages(now);

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
    this.recentMessages.clear();
  }

  private cleanupRecentMessages(now: number): void {
    // Remove entries older than threshold
    for (const [key, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > this.duplicateThreshold) {
        this.recentMessages.delete(key);
      }
    }
  }
}

export const browserLogger = BrowserLogger.getInstance();