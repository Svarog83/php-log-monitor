import { LogMonitorServiceFactory } from '../application/monitoring/LogMonitorServiceFactory.js';
import { WinstonLogger } from '../infrastructure/logging/WinstonLogger.js';
import { LoggerFactory } from '../infrastructure/logging/LoggerFactory.js';

/**
 * Command line interface for the log monitor
 */
export class MonitorCommand {
  private serviceFactory: LogMonitorServiceFactory;
  private logger: WinstonLogger;
  private isShuttingDown = false;

  constructor() {
    this.logger = LoggerFactory.createDefaultLogger();
    this.serviceFactory = new LogMonitorServiceFactory(this.logger);
  }

  /**
   * Run the monitor command
   */
  async run(args: string[]): Promise<void> {
    try {
      // Parse command line arguments
      const options = this.parseArguments(args);
      
      // Set up signal handlers for graceful shutdown
      this.setupSignalHandlers();

      // Create and start the monitoring service
      const service = await this.createService(options);
      
      this.logger.info('Starting log monitor...');
      await service.start();

      // Keep the process running
      this.logger.info('Log monitor is running. Press Ctrl+C to stop.');
      
      // Wait indefinitely (until signal handlers stop the process)
      await new Promise(() => {});

    } catch (error) {
      this.logger.error('Error running monitor command:', error as Record<string, unknown>);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(args: string[]): MonitorOptions {
    const options: MonitorOptions = {
      configPath: './config/projects.yaml',
      environment: 'development',
      logLevel: 'info',
      monologHost: process.env.MONOLOG_HOST || 'localhost',
      monologPort: parseInt(process.env.MONOLOG_PORT || '9912'),
      logDir: process.env.LOG_DIR || './var/log'
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--config':
        case '-c':
          const configPath = args[++i];
          if (configPath) options.configPath = configPath;
          break;
        case '--env':
        case '-e':
          const environment = args[++i];
          if (environment) options.environment = environment;
          break;
        case '--log-level':
        case '-l':
          const logLevel = args[++i];
          if (logLevel) options.logLevel = logLevel;
          break;
        case '--monolog-host':
          const monologHost = args[++i];
          if (monologHost) options.monologHost = monologHost;
          break;
        case '--monolog-port':
          const monologPort = args[++i];
          if (monologPort) options.monologPort = parseInt(monologPort);
          break;
        case '--log-dir':
          const logDir = args[++i];
          if (logDir) options.logDir = logDir;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        case '--version':
        case '-v':
          this.showVersion();
          process.exit(0);
          break;
      }
    }

    return options;
  }

  /**
   * Create monitoring service based on options
   */
  private async createService(options: MonitorOptions): Promise<any> {
    switch (options.environment) {
      case 'development':
        return this.serviceFactory.createDevService(options.configPath);
      case 'production':
        return this.serviceFactory.createProdService(options.configPath);
      default:
        return this.serviceFactory.createCustomService(
          options.configPath,
          {
            logLevel: options.logLevel,
            logDir: options.logDir,
            monologHost: options.monologHost,
            monologPort: options.monologPort
          }
        );
    }
  }

  /**
   * Set up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Stop the monitoring service
        const service = this.serviceFactory.getCurrentService();
        if (service) {
          await service.stop();
        }

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error as Record<string, unknown>);
        process.exit(1);
      }
    };

    // Handle various termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error as unknown as Record<string, unknown>);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled promise rejection:', reason as unknown as Record<string, unknown>);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
Log Monitor - TypeScript Version

Usage: npm start [options]

Options:
  -c, --config <path>        Configuration file path (default: ./config/projects.yaml)
  -e, --env <environment>    Environment: development, production, or custom (default: development)
  -l, --log-level <level>    Log level: error, warn, info, debug (default: info)
  --monolog-host <host>      Monolog/Buggregator host (default: localhost)
  --monolog-port <port>      Monolog/Buggregator port (default: 9912)
  --log-dir <path>           Log directory (default: ./var/log)
  -h, --help                 Show this help message
  -v, --version              Show version information

Environment Variables:
  MONOLOG_HOST              Monolog/Buggregator host
  MONOLOG_PORT              Monolog/Buggregator port
  LOG_DIR                   Log directory

Examples:
  npm start
  npm start -- --config ./config/custom.yaml
  npm start -- --env production --log-level debug
  npm start -- --monolog-host 192.168.1.100 --monolog-port 9913
`);
  }

  /**
   * Show version information
   */
  private showVersion(): void {
    console.log('Log Monitor - TypeScript Version 1.0.0');
  }
}

/**
 * Command line options for the monitor command
 */
export interface MonitorOptions {
  configPath: string;
  environment: string;
  logLevel: string;
  monologHost: string;
  monologPort: number;
  logDir: string;
} 