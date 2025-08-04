import { ConfigurationLoader, LogMonitorConfig } from '../../../../src/application/configuration/ConfigurationLoader.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    mkdir: jest.fn(),
    mkdtemp: jest.fn(),
    rm: jest.fn()
  }
}));

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock the fs import
const mockFs = {
  promises: {
    readFile: jest.fn(),
    mkdir: jest.fn(),
    mkdtemp: jest.fn(),
    rm: jest.fn()
  }
};

jest.doMock('fs', () => mockFs);

describe('ConfigurationLoader', () => {
  let configLoader: ConfigurationLoader;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = '/tmp/config-test-123';
    (mockFs.promises.mkdtemp as jest.Mock).mockResolvedValue(tempDir);
    configLoader = new ConfigurationLoader(path.join(tempDir, 'test-config.yaml'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('loadConfig', () => {
    it('should load valid configuration', async () => {
      const mockConfig = `
projects:
  test-project:
    directories:
      - /var/log/test
    log_pattern: "*.log"
    position_storage:
      type: cached
      path: var/positions
      save_interval_seconds: 30
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);

      const config = await configLoader.loadConfig();

      expect(config).toBeDefined();
      expect(config.projects).toBeDefined();
      expect(config.projects['test-project']).toBeDefined();
      expect(config.projects['test-project']!.directories).toEqual(['/var/log/test']);
      expect(config.projects['test-project']!.log_pattern).toBe('*.log');
    });

    it('should throw error for invalid configuration', async () => {
      const mockConfig = `
invalid:
  yaml:
    structure:
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);

      await expect(configLoader.loadConfig()).rejects.toThrow('Invalid configuration: missing projects section');
    });

    it('should throw error for missing file', async () => {
      (mockFs.promises.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(configLoader.loadConfig()).rejects.toThrow('File not found');
    });
  });

  describe('getProjects', () => {
    it('should convert configuration to Project objects', async () => {
      const mockConfig = `
projects:
  project1:
    directories:
      - /var/log/project1
    log_pattern: "*.log"
    position_storage:
      type: cached
      path: var/positions
      save_interval_seconds: 30
  project2:
    directories:
      - /var/log/project2
      - /var/log/project2/backup
    log_pattern: "logstash-*.json"
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);
      await configLoader.loadConfig();

      const projects = configLoader.getProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0]!.name).toBe('project1');
      expect(projects[0]!.monitoredDirectories).toEqual(['/var/log/project1']);
      expect(projects[0]!.logPattern).toBe('*.log');
      expect(projects[1]!.name).toBe('project2');
      expect(projects[1]!.monitoredDirectories).toEqual(['/var/log/project2', '/var/log/project2/backup']);
      expect(projects[1]!.logPattern).toBe('logstash-*.json');
    });

    it('should return empty array when no config loaded', () => {
      const projects = configLoader.getProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('configuration change callbacks', () => {
    it('should register and call configuration change callbacks', async () => {
      const mockConfig = `
projects:
  test-project:
    directories:
      - /var/log/test
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);

      const callback = jest.fn();
      configLoader.onConfigChange(callback);

      await configLoader.loadConfig();
      configLoader['notifyChangeCallbacks']();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        projects: expect.any(Object)
      }));
    });

    it('should remove configuration change callbacks', async () => {
      const mockConfig = `
projects:
  test-project:
    directories:
      - /var/log/test
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);

      const callback = jest.fn();
      configLoader.onConfigChange(callback);
      configLoader.removeConfigChangeCallback(callback);

      await configLoader.loadConfig();
      configLoader['notifyChangeCallbacks']();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('position storage configuration', () => {
    it('should create PositionStorageConfig from configuration data', async () => {
      const mockConfig = `
projects:
  test-project:
    directories:
      - /var/log/test
    position_storage:
      type: async
      path: custom/positions
      save_interval_seconds: 60
      cache_timeout_seconds: 300
      batch_size: 200
      flush_interval_seconds: 10
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);
      await configLoader.loadConfig();

      const projects = configLoader.getProjects();
      const project = projects[0]!;
      const positionStorage = project.getPositionStorageConfig();

      expect(positionStorage.type).toBe('async');
      expect(positionStorage.path).toBe('custom/positions');
      expect(positionStorage.saveIntervalSeconds).toBe(60);
    });

    it('should use default values when position storage not configured', async () => {
      const mockConfig = `
projects:
  test-project:
    directories:
      - /var/log/test
      `;

      (mockFs.promises.readFile as jest.Mock).mockResolvedValue(mockConfig);
      await configLoader.loadConfig();

      const projects = configLoader.getProjects();
      const project = projects[0]!;
      const positionStorage = project.getPositionStorageConfig();

      expect(positionStorage.type).toBe('file');
      expect(positionStorage.path).toBe('./var/positions');
    });
  });
}); 