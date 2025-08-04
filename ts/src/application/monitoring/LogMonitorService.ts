import { Project } from '../../domain/models/Project.js';
import { LogFile } from '../../domain/models/LogFile.js';
import { LogEntry, LogEntryUtils, RawLogEntry } from '../../domain/models/LogEntry.js';
import { LogFileRepository } from '../../domain/repositories/LogFileRepository.js';
import { PositionRepository } from '../../domain/repositories/PositionRepository.js';
import { WinstonLogger } from '../../infrastructure/logging/WinstonLogger.js';
import { ConfigurationLoader } from '../configuration/ConfigurationLoader.js';

/**
 * Service for monitoring log files across multiple projects
 */
export class LogMonitorService {
  private readonly logFileRepository: LogFileRepository;
  private readonly positionRepository: PositionRepository;
  private readonly logger: WinstonLogger;
  private readonly configLoader: ConfigurationLoader;
  private activeProjects: Map<string, Project> = new Map();
  private isRunning = false;

  constructor(
    logFileRepository: LogFileRepository,
    positionRepository: PositionRepository,
    logger: WinstonLogger,
    configLoader: ConfigurationLoader
  ) {
    this.logFileRepository = logFileRepository;
    this.positionRepository = positionRepository;
    this.logger = logger;
    this.configLoader = configLoader;
  }

  /**
   * Start monitoring all configured projects
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Log monitor service is already running');
      return;
    }

    this.logger.info('Starting log monitor service');
    this.isRunning = true;

    try {
      // Load initial configuration
      await this.configLoader.loadConfig();
      
      // Start watching for configuration changes
      await this.configLoader.startWatching();
      
      // Register configuration change handler
      this.configLoader.onConfigChange((config) => {
        this.handleConfigurationChange(config);
      });

      // Start monitoring all projects
      await this.startMonitoringProjects();

      this.logger.info('Log monitor service started successfully');
    } catch (error) {
      this.logger.error('Error starting log monitor service:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Stop monitoring all projects
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Log monitor service is not running');
      return;
    }

    this.logger.info('Stopping log monitor service');
    this.isRunning = false;

    try {
      // Stop watching configuration
      await this.configLoader.stopWatching();

      // Stop watching all directories
      await this.logFileRepository.stopWatching();

      // Force save all positions
      await this.positionRepository.forceSave();

      this.logger.info('Log monitor service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping log monitor service:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Start monitoring all configured projects
   */
  private async startMonitoringProjects(): Promise<void> {
    const projects = this.configLoader.getProjects();
    
    for (const project of projects) {
      await this.startMonitoringProject(project);
    }
  }

  /**
   * Start monitoring a specific project
   */
  private async startMonitoringProject(project: Project): Promise<void> {
    try {
      this.logger.info(`Starting monitoring for project: ${project.name}`);
      
      // Store project reference
      this.activeProjects.set(project.name, project);

      // Process existing log files
      await this.processExistingLogs(project);

      // Start watching directories for new/changed files
      for (const directory of project.monitoredDirectories) {
        await this.logFileRepository.watchDirectory(
          directory,
          project.logPattern,
          (filePath) => this.handleFileChange(project, filePath)
        );
      }

      this.logger.info(`Started monitoring for project: ${project.name}`);
    } catch (error) {
      this.logger.error(`Error starting monitoring for project ${project.name}:`, error as Record<string, unknown>);
    }
  }

  /**
   * Stop monitoring a specific project
   */
  private async stopMonitoringProject(projectName: string): Promise<void> {
    try {
      this.logger.info(`Stopping monitoring for project: ${projectName}`);
      
      // Remove project reference
      this.activeProjects.delete(projectName);

      this.logger.info(`Stopped monitoring for project: ${projectName}`);
    } catch (error) {
      this.logger.error(`Error stopping monitoring for project ${projectName}:`, error as Record<string, unknown>);
    }
  }

  /**
   * Process existing log files for a project
   */
  private async processExistingLogs(project: Project): Promise<void> {
    try {
      const latestLogFile = await this.logFileRepository.findLatestLogFile(project);
      
      if (latestLogFile) {
        await this.processLogFile(project, latestLogFile);
      }
    } catch (error) {
      this.logger.error(`Error processing existing logs for project ${project.name}:`, error as Record<string, unknown>);
    }
  }

  /**
   * Handle file change events
   */
  private async handleFileChange(project: Project, filePath: string): Promise<void> {
    try {
      if (!this.isRunning) {
        return;
      }

      this.logger.debug(`File changed: ${filePath} for project: ${project.name}`);

      // Check if file exists and is readable
      if (!(await this.logFileRepository.fileExists(filePath))) {
        return;
      }

      // Create LogFile object
      const logFile = await LogFile.fromPath(filePath);
      
      // Process the log file
      await this.processLogFile(project, logFile);
    } catch (error) {
      this.logger.error(`Error handling file change for ${filePath}:`, error as Record<string, unknown>);
    }
  }

  /**
   * Process a log file and extract new log entries
   */
  private async processLogFile(project: Project, logFile: LogFile): Promise<void> {
    try {
      // Load current position
      const currentPosition = await this.positionRepository.loadPosition(
        project.name,
        logFile.path
      );

      // Get current file size
      const currentSize = await this.logFileRepository.getFileSize(logFile.path);

      // If file is smaller than our position, it was truncated
      if (currentSize < currentPosition) {
        this.logger.info(`Log file ${logFile.path} was truncated, resetting position`);
        await this.positionRepository.savePosition(project.name, logFile.path, 0);
        return;
      }

      // Read new lines from the file
      const newLines = await this.logFileRepository.readNewLines(
        logFile.path,
        currentPosition
      );

      if (newLines.length === 0) {
        return;
      }

      // Process each new line
      let newPosition = currentPosition;
      for (const line of newLines) {
        const rawEntry: RawLogEntry = {
          content: line,
          lineNumber: 0, // We don't track line numbers in this implementation
          filePath: logFile.path
        };

        const logEntry = LogEntryUtils.createFromRaw(
          rawEntry,
          project.name,
          newPosition
        );

        // Process the log entry
        await this.processLogEntry(project, logEntry);

        newPosition += line.length + 1; // +1 for newline
      }

      // Save new position
      await this.positionRepository.savePosition(
        project.name,
        logFile.path,
        newPosition
      );

      this.logger.debug(`Processed ${newLines.length} new lines from ${logFile.path}`);
    } catch (error) {
      this.logger.error(`Error processing log file ${logFile.path}:`, error as Record<string, unknown>);
    }
  }

  /**
   * Process a single log entry
   */
  private async processLogEntry(project: Project, logEntry: any): Promise<void> {
    try {
      // Log the entry with appropriate level
      const message = `[${project.name}] ${logEntry.message}`;
      const meta = {
        project: project.name,
        level: logEntry.level,
        context: logEntry.context,
        source: logEntry.source,
        filePath: logEntry.filePath,
        position: logEntry.position
      };

      switch (logEntry.level) {
        case 'ERROR':
          this.logger.error(message, meta);
          break;
        case 'WARNING':
          this.logger.warn(message, meta);
          break;
        case 'DEBUG':
          this.logger.debug(message, meta);
          break;
        default:
          this.logger.info(message, meta);
      }
    } catch (error) {
      this.logger.error(`Error processing log entry:`, error as Record<string, unknown>);
    }
  }

  /**
   * Handle configuration changes
   */
  private async handleConfigurationChange(config: any): Promise<void> {
    try {
      this.logger.info('Configuration changed, updating projects');

      const newProjects = this.configLoader.getProjects();
      const newProjectNames = new Set(newProjects.map(p => p.name));
      const currentProjectNames = new Set(this.activeProjects.keys());

      // Stop monitoring removed projects
      for (const projectName of currentProjectNames) {
        if (!newProjectNames.has(projectName)) {
          await this.stopMonitoringProject(projectName);
        }
      }

      // Start monitoring new projects
      for (const project of newProjects) {
        if (!currentProjectNames.has(project.name)) {
          await this.startMonitoringProject(project);
        }
      }

      this.logger.info('Configuration update completed');
    } catch (error) {
      this.logger.error('Error handling configuration change:', error as Record<string, unknown>);
    }
  }

  /**
   * Get status of the monitoring service
   */
  getStatus(): {
    isRunning: boolean;
    activeProjects: string[];
    totalProjects: number;
  } {
    return {
      isRunning: this.isRunning,
      activeProjects: Array.from(this.activeProjects.keys()),
      totalProjects: this.activeProjects.size
    };
  }
} 