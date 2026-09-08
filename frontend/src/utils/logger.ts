/**
 * Logger Utility
 * 
 * Centralized logging for ConnectHub with different log levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
  context?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  /**
   * Log debug message (development only)
   */
  debug(message: string, data?: unknown, context?: string): void {
    if (this.isDevelopment) {
      this.log('debug', message, data, context);
      console.debug(`[DEBUG]${context ? ` [${context}]` : ''} ${message}`, data || '');
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown, context?: string): void {
    this.log('info', message, data, context);
    if (this.isDevelopment) {
      console.info(`[INFO]${context ? ` [${context}]` : ''} ${message}`, data || '');
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown, context?: string): void {
    this.log('warn', message, data, context);
    console.warn(`[WARN]${context ? ` [${context}]` : ''} ${message}`, data || '');
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: string): void {
    this.log('error', message, error, context);
    console.error(`[ERROR]${context ? ` [${context}]` : ''} ${message}`, error || '');

    // TODO: Send to error monitoring service (e.g., Sentry)
    // this.sendToErrorService(message, error, context);
  }

  /**
   * Store log entry
   */
  private log(level: LogLevel, message: string, data?: unknown, context?: string): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
      context,
    };

    this.logs.push(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Send to error monitoring service
   */
  private sendToErrorService(_message: string, _error?: unknown, _context?: string): void {
    // TODO: Implement error service integration
    // Example: Sentry.captureException(error, { tags: { context }, extra: { message } });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const { debug, info, warn, error } = logger;
