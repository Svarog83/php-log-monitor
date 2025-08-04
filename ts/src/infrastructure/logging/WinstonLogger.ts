import winston from 'winston';
import path from 'path';
import { MonologSocketTransport } from './MonologSocketTransport.js';

/**
 * Winston-based logger implementation
 */
export class WinstonLogger {
  private logger: winston.Logger;
  private monologTransport: MonologSocketTransport | null = null;

  constructor(
    logLevel: string = 'info',
    logDir: string = './var/log'
  ) {
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'log-monitor' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        
        // File transport for error logs
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Set Monolog transport for cleanup
   */
  setMonologTransport(transport: MonologSocketTransport): void {
    this.monologTransport = transport;
  }

  /**
   * Cleanup method for tests
   */
  async cleanup(): Promise<void> {
    if (this.monologTransport) {
      await this.monologTransport.cleanup();
      this.monologTransport = null;
    }
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, meta?: Record<string, unknown>): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Get the underlying Winston logger
   */
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Add a custom transport
   */
  addTransport(transport: winston.transport): void {
    this.logger.add(transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(transport: winston.transport): void {
    this.logger.remove(transport);
  }
} 