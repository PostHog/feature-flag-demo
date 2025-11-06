import { EventEmitter } from 'events';

export interface LogMessage {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
}

class LogEmitter extends EventEmitter {
  private constructor() {
    super();
    this.setMaxListeners(100); // Allow multiple SSE connections
  }

  public static getInstance(): LogEmitter {
    // Use globalThis to ensure singleton works across Next.js contexts
    if (!(globalThis as any).__logEmitter) {
      (globalThis as any).__logEmitter = new LogEmitter();
    }
    return (globalThis as any).__logEmitter;
  }

  public emitLog(level: LogMessage['level'], message: string) {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    this.emit('log', logMessage);
  }

  public info(message: string) {
    this.emitLog('info', message);
  }

  public warn(message: string) {
    this.emitLog('warn', message);
  }

  public error(message: string) {
    this.emitLog('error', message);
  }

  public success(message: string) {
    this.emitLog('success', message);
  }

  public debug(message: string) {
    this.emitLog('debug', message);
  }
}

export const logEmitter = LogEmitter.getInstance();
