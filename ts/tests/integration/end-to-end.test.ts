import { MonitorCommand } from '../../src/console/MonitorCommand.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs for integration test
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  },
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  stat: jest.fn(() => ({ size: 0, mtime: new Date() })),
  statSync: jest.fn(() => ({ size: 0, mtime: new Date() }))
}));

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock js-yaml
jest.mock('js-yaml', () => ({
  load: jest.fn((yaml: string) => {
    if (!yaml) return null;
    
    if (yaml.includes('projects:')) {
      return {
        projects: {
          'test-project': {
            directories: ['/var/log/test'],
            log_pattern: '*.log'
          }
        }
      };
    }
    return null;
  })
}));

describe('End-to-End Integration', () => {
  let command: MonitorCommand;
  const mockFs = require('fs').promises;

  beforeEach(() => {
    command = new MonitorCommand();
    jest.clearAllMocks();
  });

  describe('MonitorCommand Integration', () => {
    it('should parse command line arguments correctly', () => {
      const args = ['--config', './test-config.yaml', '--env', 'development'];
      const options = (command as any).parseArguments(args);

      expect(options.configPath).toBe('./test-config.yaml');
      expect(options.environment).toBe('development');
    });

    it('should show help when --help is passed', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const args = ['--help'];
      
      expect(() => {
        (command as any).parseArguments(args);
      }).toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Log Monitor - TypeScript Version')
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should show version when --version is passed', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const args = ['--version'];
      
      expect(() => {
        (command as any).parseArguments(args);
      }).toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Log Monitor - TypeScript Version 1.0.0'
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('Configuration Loading Integration', () => {
    it('should load configuration from file', async () => {
      const mockConfig = `
projects:
  test-project:
    directories:
      - /var/log/test
    log_pattern: "*.log"
      `;

      (mockFs.readFile as jest.Mock).mockResolvedValue(mockConfig);

      const configLoader = (command as any).serviceFactory.createDevService('./test-config.yaml');
      
      // The service should be created without errors
      expect(configLoader).toBeDefined();
    });
  });

  describe('Service Factory Integration', () => {
    it('should create development service', () => {
      const service = (command as any).serviceFactory.createDevService('./test-config.yaml');
      
      expect(service).toBeDefined();
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
    });

    it('should create production service', () => {
      const service = (command as any).serviceFactory.createProdService('./test-config.yaml');
      
      expect(service).toBeDefined();
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
    });

    it('should create custom service', () => {
      const service = (command as any).serviceFactory.createCustomService(
        './test-config.yaml',
        {
          logLevel: 'debug',
          logDir: './var/log',
          monologHost: 'localhost',
          monologPort: 9912
        }
      );
      
      expect(service).toBeDefined();
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
    });
  });

  describe('Signal Handling Integration', () => {
    it('should set up signal handlers', () => {
      const processSpy = jest.spyOn(process, 'on').mockImplementation();
      
      (command as any).setupSignalHandlers();
      
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGQUIT', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      
      processSpy.mockRestore();
    });
  });
}); 