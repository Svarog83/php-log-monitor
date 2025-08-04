import { WinstonLogger } from './WinstonLogger.js';
import { MonologSocketTransport } from './MonologSocketTransport.js';

/**
 * Factory for creating loggers with different configurations
 */
export class LoggerFactory {
  /**
   * Create a basic logger with console and file output
   */
  static createBasicLogger(
    logLevel: string = 'info',
    logDir: string = './var/log'
  ): WinstonLogger {
    return new WinstonLogger(logLevel, logDir);
  }

  /**
   * Create a logger with Monolog/Buggregator integration
   */
  static createMonologLogger(
    logLevel: string = 'info',
    logDir: string = './var/log',
    monologConfig: {
      host?: string;
      port?: number;
      reconnectInterval?: number;
      maxReconnectAttempts?: number;
      maxQueueSize?: number;
    } = {}
  ): WinstonLogger {
    const logger = new WinstonLogger(logLevel, logDir);
    
    // Create Monolog transport for manual use
    const monologTransport = new MonologSocketTransport(monologConfig);
    
    // Store the transport for cleanup
    logger.setMonologTransport(monologTransport);

    // Override the log methods to also send to Monolog
    const originalInfo = logger.info.bind(logger);
    const originalWarn = logger.warn.bind(logger);
    const originalError = logger.error.bind(logger);
    const originalDebug = logger.debug.bind(logger);
    const originalVerbose = logger.verbose.bind(logger);
    
    logger.info = (message: string, meta?: Record<string, unknown>) => {
      originalInfo(message, meta);
      monologTransport.sendLog('info', message, meta);
    };
    
    logger.warn = (message: string, meta?: Record<string, unknown>) => {
      originalWarn(message, meta);
      monologTransport.sendLog('warn', message, meta);
    };
    
    logger.error = (message: string, meta?: Record<string, unknown>) => {
      originalError(message, meta);
      monologTransport.sendLog('error', message, meta);
    };
    
    logger.debug = (message: string, meta?: Record<string, unknown>) => {
      originalDebug(message, meta);
      monologTransport.sendLog('debug', message, meta);
    };
    
    logger.verbose = (message: string, meta?: Record<string, unknown>) => {
      originalVerbose(message, meta);
      monologTransport.sendLog('verbose', message, meta);
    };
    
    return logger;
  }

  /**
   * Create a default logger (same as createBasicLogger)
   */
  static createDefaultLogger(): WinstonLogger {
    return this.createBasicLogger();
  }

  /**
   * Create a logger from environment variables
   */
  static createFromEnvironment(): WinstonLogger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logDir = process.env.LOG_DIR || './var/log';
    const monologHost = process.env.MONOLOG_HOST;
    const monologPort = process.env.MONOLOG_PORT ? parseInt(process.env.MONOLOG_PORT) : undefined;

    if (monologHost) {
      const config: {
        host?: string;
        port?: number;
        reconnectInterval?: number;
        maxReconnectAttempts?: number;
        maxQueueSize?: number;
      } = {
        host: monologHost
      };
      
      if (monologPort !== undefined) {
        config.port = monologPort;
      }
      
      if (process.env.MONOLOG_RECONNECT_INTERVAL) {
        config.reconnectInterval = parseInt(process.env.MONOLOG_RECONNECT_INTERVAL);
      }
      
      if (process.env.MONOLOG_MAX_RECONNECT_ATTEMPTS) {
        config.maxReconnectAttempts = parseInt(process.env.MONOLOG_MAX_RECONNECT_ATTEMPTS);
      }
      
      if (process.env.MONOLOG_MAX_QUEUE_SIZE) {
        config.maxQueueSize = parseInt(process.env.MONOLOG_MAX_QUEUE_SIZE);
      }
      
      return this.createMonologLogger(logLevel, logDir, config);
    } else {
      return this.createBasicLogger(logLevel, logDir);
    }
  }

  /**
   * Create a development logger with verbose output
   */
  static createDevelopmentLogger(): WinstonLogger {
    return this.createBasicLogger('debug', './var/log');
  }

  /**
   * Create a production logger with error-level focus
   */
  static createProductionLogger(): WinstonLogger {
    return this.createBasicLogger('warn', './var/log');
  }
} 