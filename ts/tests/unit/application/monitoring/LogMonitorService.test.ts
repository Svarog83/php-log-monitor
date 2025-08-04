import { LogMonitorService } from '../../../../src/application/monitoring/LogMonitorService.js';
import { ConfigurationLoader } from '../../../../src/application/configuration/ConfigurationLoader.js';
import { Project } from '../../../../src/domain/models/Project.js';
import { LogFile } from '../../../../src/domain/models/LogFile.js';
import { LogFileRepository } from '../../../../src/domain/repositories/LogFileRepository.js';
import { PositionRepository } from '../../../../src/domain/repositories/PositionRepository.js';
import { WinstonLogger } from '../../../../src/infrastructure/logging/WinstonLogger.js';

// Mock dependencies
jest.mock('../../../../src/application/configuration/ConfigurationLoader');
jest.mock('../../../../src/infrastructure/logging/WinstonLogger');

describe('LogMonitorService', () => {
  let service: LogMonitorService;
  let mockLogFileRepository: jest.Mocked<LogFileRepository>;
  let mockPositionRepository: jest.Mocked<PositionRepository>;
  let mockLogger: jest.Mocked<WinstonLogger>;
  let mockConfigLoader: jest.Mocked<ConfigurationLoader>;

  beforeEach(() => {
    // Create mocks
    mockLogFileRepository = {
      findLatestLogFile: jest.fn(),
      watchDirectory: jest.fn(),
      getFileSize: jest.fn(),
      readNewLines: jest.fn(),
      fileExists: jest.fn(),
      getFileModifiedTime: jest.fn(),
      stopWatching: jest.fn()
    } as any;

    mockPositionRepository = {
      loadPosition: jest.fn(),
      savePosition: jest.fn(),
      saveFilePosition: jest.fn(),
      loadFilePosition: jest.fn(),
      forceSave: jest.fn(),
      clearPositions: jest.fn(),
      getAllPositions: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      getWinstonLogger: jest.fn(),
      addTransport: jest.fn(),
      removeTransport: jest.fn()
    } as any;

    mockConfigLoader = {
      loadConfig: jest.fn(),
      getConfig: jest.fn(),
      getProjects: jest.fn(),
      startWatching: jest.fn(),
      stopWatching: jest.fn(),
      onConfigChange: jest.fn(),
      removeConfigChangeCallback: jest.fn()
    } as any;

    service = new LogMonitorService(
      mockLogFileRepository,
      mockPositionRepository,
      mockLogger,
      mockConfigLoader
    );
  });

  describe('start', () => {
    it('should start monitoring service successfully', async () => {
      const mockProjects = [
        new Project('test-project', ['/var/log/test'], '*.log')
      ];

      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue(mockProjects);
      mockLogFileRepository.findLatestLogFile.mockResolvedValue(null);

      await service.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting log monitor service');
      expect(mockConfigLoader.loadConfig).toHaveBeenCalled();
      expect(mockConfigLoader.startWatching).toHaveBeenCalled();
      expect(mockConfigLoader.onConfigChange).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Log monitor service started successfully');
    });

    it('should not start if already running', async () => {
      // Start once
      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue([]);
      await service.start();

      // Try to start again
      await service.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('Log monitor service is already running');
    });

    it('should handle errors during startup', async () => {
      const error = new Error('Configuration error');
      mockConfigLoader.loadConfig.mockRejectedValue(error);

      await expect(service.start()).rejects.toThrow('Configuration error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error starting log monitor service:', error);
    });
  });

  describe('stop', () => {
    it('should stop monitoring service successfully', async () => {
      // Start the service first
      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue([]);
      await service.start();

      // Stop the service
      await service.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Stopping log monitor service');
      expect(mockConfigLoader.stopWatching).toHaveBeenCalled();
      expect(mockLogFileRepository.stopWatching).toHaveBeenCalled();
      expect(mockPositionRepository.forceSave).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Log monitor service stopped successfully');
    });

    it('should not stop if not running', async () => {
      await service.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith('Log monitor service is not running');
    });
  });

  describe('file change handling', () => {
    it('should handle file changes correctly', async () => {
      const project = new Project('test-project', ['/var/log/test'], '*.log');
      const logFile = new LogFile('/var/log/test/app.log', 1024, new Date());

      // Start the service first
      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue([project]);
      await service.start();

      mockLogFileRepository.fileExists.mockResolvedValue(true);
      mockLogFileRepository.getFileSize.mockResolvedValue(1024);
      mockLogFileRepository.readNewLines.mockResolvedValue(['{"message": "test log"}']);
      mockPositionRepository.loadPosition.mockResolvedValue(0);
      mockPositionRepository.savePosition.mockResolvedValue();

      // Access private method for testing
      await (service as any).handleFileChange(project, '/var/log/test/app.log');

      expect(mockLogFileRepository.fileExists).toHaveBeenCalledWith('/var/log/test/app.log');
      expect(mockLogFileRepository.getFileSize).toHaveBeenCalledWith('/var/log/test/app.log');
      expect(mockLogFileRepository.readNewLines).toHaveBeenCalledWith('/var/log/test/app.log', 0);
      expect(mockPositionRepository.savePosition).toHaveBeenCalledWith('test-project', '/var/log/test/app.log', expect.any(Number));
    });

    it('should handle file truncation', async () => {
      const project = new Project('test-project', ['/var/log/test'], '*.log');

      // Start the service first
      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue([project]);
      await service.start();

      mockLogFileRepository.fileExists.mockResolvedValue(true);
      mockLogFileRepository.getFileSize.mockResolvedValue(512); // Smaller than position
      mockPositionRepository.loadPosition.mockResolvedValue(1024);

      // Access private method for testing
      await (service as any).handleFileChange(project, '/var/log/test/app.log');

      expect(mockPositionRepository.savePosition).toHaveBeenCalledWith('test-project', '/var/log/test/app.log', 0);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('was truncated, resetting position'));
    });

    it('should skip processing if file does not exist', async () => {
      const project = new Project('test-project', ['/var/log/test'], '*.log');

      // Start the service first
      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue([project]);
      await service.start();

      mockLogFileRepository.fileExists.mockResolvedValue(false);

      // Access private method for testing
      await (service as any).handleFileChange(project, '/var/log/test/app.log');

      expect(mockLogFileRepository.fileExists).toHaveBeenCalledWith('/var/log/test/app.log');
      expect(mockLogFileRepository.getFileSize).not.toHaveBeenCalled();
    });
  });

  describe('log entry processing', () => {
    it('should process log entries with correct levels', async () => {
      const project = new Project('test-project', ['/var/log/test'], '*.log');
      const logEntry = {
        message: 'Test error message',
        level: 'ERROR',
        context: { userId: 123 },
        source: 'test-project',
        filePath: '/var/log/test/app.log',
        position: 100
      };

      // Access private method for testing
      await (service as any).processLogEntry(project, logEntry);

      expect(mockLogger.error).toHaveBeenCalledWith('[test-project] Test error message', expect.objectContaining({
        project: 'test-project',
        level: 'ERROR',
        context: { userId: 123 }
      }));
    });

    it('should handle different log levels', async () => {
      const project = new Project('test-project', ['/var/log/test'], '*.log');
      
      const testCases = [
        { level: 'ERROR', method: 'error' },
        { level: 'WARNING', method: 'warn' },
        { level: 'DEBUG', method: 'debug' },
        { level: 'INFO', method: 'info' }
      ];

      for (const testCase of testCases) {
        const logEntry = {
          message: `Test ${testCase.level.toLowerCase()} message`,
          level: testCase.level,
          context: {},
          source: 'test-project',
          filePath: '/var/log/test/app.log',
          position: 100
        };

        // Reset mock calls
        jest.clearAllMocks();

        // Access private method for testing
        await (service as any).processLogEntry(project, logEntry);

        expect(mockLogger[testCase.method as keyof typeof mockLogger]).toHaveBeenCalled();
      }
    });
  });

  describe('getStatus', () => {
    it('should return correct status when running', async () => {
      // Start the service
      mockConfigLoader.loadConfig.mockResolvedValue({ projects: {} });
      mockConfigLoader.getProjects.mockReturnValue([
        new Project('project1', ['/var/log/project1'], '*.log'),
        new Project('project2', ['/var/log/project2'], '*.log')
      ]);
      await service.start();

      const status = service.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.activeProjects).toEqual(['project1', 'project2']);
      expect(status.totalProjects).toBe(2);
    });

    it('should return correct status when not running', () => {
      const status = service.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.activeProjects).toEqual([]);
      expect(status.totalProjects).toBe(0);
    });
  });
}); 