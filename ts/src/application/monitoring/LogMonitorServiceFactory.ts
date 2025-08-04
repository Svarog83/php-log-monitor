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
  /**
   * Create a LogMonitorService with default configuration
   */
  static createDefaultService(): LogMonitorService {
    const logFileRepository = new ChokidarLogFileRepository();
    const filePositionRepository = new FilePositionRepository();
    const positionRepository = new CachedPositionRepository(filePositionRepository);
    const logger = LoggerFactory.createFromEnvironment();
    const configLoader = new ConfigurationLoader();

    return new LogMonitorService(
      logFileRepository,
      positionRepository,
      logger,
      configLoader
    );
  }

  /**
   * Create a LogMonitorService with custom configuration
   */
  static createService(options: {
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
      logger = LoggerFactory.createMonologLogger(
        options.logLevel,
        options.logDir,
        {
          host: options.monologHost,
          port: options.monologPort
        }
      );
    } else {
      logger = LoggerFactory.createBasicLogger(options.logLevel, options.logDir);
    }

    // Create configuration loader
    const configLoader = new ConfigurationLoader(options.configPath);

    return new LogMonitorService(
      logFileRepository,
      positionRepository,
      logger,
      configLoader
    );
  }

  /**
   * Create a LogMonitorService from environment variables
   */
  static createFromEnvironment(): LogMonitorService {
    const configPath = process.env.CONFIG_PATH || './config/projects.yaml';
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logDir = process.env.LOG_DIR || './var/log';
    const positionsDir = process.env.POSITIONS_DIR || './var/positions';
    const useAsyncStorage = process.env.USE_ASYNC_STORAGE === 'true';
    const useMonolog = process.env.USE_MONOLOG === 'true';
    const monologHost = process.env.MONOLOG_HOST;
    const monologPort = process.env.MONOLOG_PORT ? parseInt(process.env.MONOLOG_PORT) : undefined;

    return this.createService({
      configPath,
      logLevel,
      logDir,
      positionsDir,
      useAsyncStorage,
      useMonolog,
      monologHost,
      monologPort
    });
  }

  /**
   * Create a LogMonitorService for development/testing
   */
  static createDevelopmentService(): LogMonitorService {
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
  static createProductionService(): LogMonitorService {
    return this.createService({
      logLevel: 'warn',
      logDir: './var/log',
      positionsDir: './var/positions',
      useAsyncStorage: true,
      useMonolog: true
    });
  }
} 