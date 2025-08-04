import { ChokidarLogFileRepository } from '../../infrastructure/filesystem/ChokidarLogFileRepository.js';
import { FilePositionRepository } from '../../infrastructure/storage/FilePositionRepository.js';
import { CachedPositionRepository } from '../../infrastructure/storage/CachedPositionRepository.js';
import { AsyncPositionRepository } from '../../infrastructure/storage/AsyncPositionRepository.js';
import { LoggerFactory } from '../../infrastructure/logging/LoggerFactory.js';
import { ConfigurationLoader } from '../configuration/ConfigurationLoader.js';
import { LogMonitorService } from './LogMonitorService.js';
import { LogFileRepository } from '../../domain/repositories/LogFileRepository.js';
import { PositionRepository } from '../../domain/repositories/PositionRepository.js';
import { WinstonLogger } from '../../infrastructure/logging/WinstonLogger.js';

/**
 * Factory for creating LogMonitorService with proper dependency injection
 */
export class LogMonitorServiceFactory {
  private currentService: LogMonitorService | null = null;
  private logger: WinstonLogger;

  constructor(logger: WinstonLogger) {
    this.logger = logger;
  }

  /**
   * Get the current service instance
   */
  getCurrentService(): LogMonitorService | null {
    return this.currentService;
  }
  /**
   * Create a LogMonitorService with default configuration
   */
  createDefaultService(): LogMonitorService {
    const logFileRepository = new ChokidarLogFileRepository();
    const filePositionRepository = new FilePositionRepository();
    const positionRepository = new CachedPositionRepository(filePositionRepository);
    const logger = LoggerFactory.createFromEnvironment();
    const configLoader = new ConfigurationLoader();

    this.currentService = new LogMonitorService(
      logFileRepository,
      positionRepository,
      logger,
      configLoader
    );

    return this.currentService;
  }

  /**
   * Create a LogMonitorService with custom configuration
   */
  createService(options: {
    configPath?: string;
    logLevel?: string;
    logDir?: string;
    positionsDir?: string;
    useAsyncStorage?: boolean;
    useMonolog?: boolean;
    monologHost?: string;
    monologPort?: number;
  } = {}): LogMonitorService {
    // Create log file repository
    const logFileRepository = new ChokidarLogFileRepository();

    // Create position repository chain
    const filePositionRepository = new FilePositionRepository(options.positionsDir);
    let positionRepository: PositionRepository = filePositionRepository;

    if (options.useAsyncStorage) {
      positionRepository = new AsyncPositionRepository(filePositionRepository);
    } else {
      positionRepository = new CachedPositionRepository(filePositionRepository);
    }

    // Create logger
    let logger: WinstonLogger;
    if (options.useMonolog) {
      const monologConfig: {
        host?: string;
        port?: number;
        reconnectInterval?: number;
        maxReconnectAttempts?: number;
        maxQueueSize?: number;
      } = {};
      
      if (options.monologHost) {
        monologConfig.host = options.monologHost;
      }
      
      if (options.monologPort !== undefined) {
        monologConfig.port = options.monologPort;
      }
      
      logger = LoggerFactory.createMonologLogger(
        options.logLevel,
        options.logDir,
        monologConfig
      );
    } else {
      logger = LoggerFactory.createBasicLogger(options.logLevel, options.logDir);
    }

    // Create configuration loader
    const configLoader = new ConfigurationLoader(options.configPath);

    this.currentService = new LogMonitorService(
      logFileRepository,
      positionRepository,
      logger,
      configLoader
    );

    return this.currentService;
  }

  /**
   * Create a LogMonitorService from environment variables
   */
  createFromEnvironment(): LogMonitorService {
    const configPath = process.env.CONFIG_PATH || './config/projects.yaml';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logDir = process.env.LOG_DIR || './var/log';
    const positionsDir = process.env.POSITIONS_DIR || './var/positions';
    const useAsyncStorage = process.env.USE_ASYNC_STORAGE === 'true';
    const useMonolog = process.env.USE_MONOLOG === 'true';
    const monologHost = process.env.MONOLOG_HOST;
    const monologPort = process.env.MONOLOG_PORT ? parseInt(process.env.MONOLOG_PORT) : undefined;

    const serviceOptions: {
      configPath?: string;
      logLevel?: string;
      logDir?: string;
      positionsDir?: string;
      useAsyncStorage?: boolean;
      useMonolog?: boolean;
      monologHost?: string;
      monologPort?: number;
    } = {
      configPath,
      logLevel,
      logDir,
      positionsDir,
      useAsyncStorage,
      useMonolog
    };

    if (monologHost) {
      serviceOptions.monologHost = monologHost;
    }
    
    if (monologPort !== undefined) {
      serviceOptions.monologPort = monologPort;
    }

    return this.createService(serviceOptions);
  }

  /**
   * Create a LogMonitorService for development/testing
   */
  createDevelopmentService(): LogMonitorService {
    return this.createService({
      logLevel: 'debug',
      logDir: './var/log',
      positionsDir: './var/positions',
      useAsyncStorage: false,
      useMonolog: false
    });
  }

  /**
   * Create a LogMonitorService for production
   */
  createProductionService(): LogMonitorService {
    return this.createService({
      logLevel: 'warn',
      logDir: './var/log',
      positionsDir: './var/positions',
      useAsyncStorage: true,
      useMonolog: true
    });
  }

  /**
   * Create a LogMonitorService for development with custom config path
   */
  createDevService(configPath: string): LogMonitorService {
    return this.createService({
      configPath,
      logLevel: 'debug',
      logDir: './var/log',
      positionsDir: './var/positions',
      useAsyncStorage: false,
      useMonolog: false
    });
  }

  /**
   * Create a LogMonitorService for production with custom config path
   */
  createProdService(configPath: string): LogMonitorService {
    return this.createService({
      configPath,
      logLevel: 'warn',
      logDir: './var/log',
      positionsDir: './var/positions',
      useAsyncStorage: true,
      useMonolog: true
    });
  }

  /**
   * Create a LogMonitorService with custom configuration
   */
  createCustomService(
    configPath: string,
    options: {
      logLevel?: string;
      logDir?: string;
      monologHost?: string;
      monologPort?: number;
    }
  ): LogMonitorService {
    const serviceOptions: {
      configPath?: string;
      logLevel?: string;
      logDir?: string;
      positionsDir?: string;
      useAsyncStorage?: boolean;
      useMonolog?: boolean;
      monologHost?: string;
      monologPort?: number;
    } = {
      configPath,
      logLevel: options.logLevel || 'info',
      logDir: options.logDir || './var/log',
      positionsDir: './var/positions',
      useAsyncStorage: false,
      useMonolog: !!(options.monologHost && options.monologPort)
    };

    if (options.monologHost) {
      serviceOptions.monologHost = options.monologHost;
    }
    
    if (options.monologPort !== undefined) {
      serviceOptions.monologPort = options.monologPort;
    }

    return this.createService(serviceOptions);
  }
} 