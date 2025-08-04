import { MonitorCommand } from '../../../src/console/MonitorCommand.js';

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();

// Mock process.exit
const originalProcessExit = process.exit;
const mockProcessExit = jest.fn();

describe('MonitorCommand', () => {
  let command: MonitorCommand;

  beforeEach(() => {
    command = new MonitorCommand();
    console.log = mockConsoleLog;
    (process.exit as any) = mockProcessExit;
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    (process.exit as any) = originalProcessExit;
    jest.clearAllMocks();

    // Clean up any services that might have been created
    if (command && (command as any).serviceFactory) {
      const currentService = (command as any).serviceFactory.getCurrentService();
      if (currentService && typeof currentService.stop === 'function') {
        try {
          await currentService.stop();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    // Final cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('parseArguments', () => {
    it('should parse default arguments correctly', () => {
      const args: string[] = [];
      const options = (command as any).parseArguments(args);

      expect(options).toEqual({
        configPath: './config/projects.yaml',
        environment: 'development',
        logLevel: 'info',
        monologHost: 'localhost',
        monologPort: 9912,
        logDir: './var/log'
      });
    });

    it('should parse custom config path', () => {
      const args = ['--config', './custom/config.yaml'];
      const options = (command as any).parseArguments(args);

      expect(options.configPath).toBe('./custom/config.yaml');
    });

    it('should parse environment', () => {
      const args = ['--env', 'production'];
      const options = (command as any).parseArguments(args);

      expect(options.environment).toBe('production');
    });

    it('should parse log level', () => {
      const args = ['--log-level', 'debug'];
      const options = (command as any).parseArguments(args);

      expect(options.logLevel).toBe('debug');
    });

    it('should parse monolog host and port', () => {
      const args = ['--monolog-host', '192.168.1.100', '--monolog-port', '9913'];
      const options = (command as any).parseArguments(args);

      expect(options.monologHost).toBe('192.168.1.100');
      expect(options.monologPort).toBe(9913);
    });

    it('should parse log directory', () => {
      const args = ['--log-dir', '/var/logs'];
      const options = (command as any).parseArguments(args);

      expect(options.logDir).toBe('/var/logs');
    });

    it('should handle short options', () => {
      const args = ['-c', './config.yaml', '-e', 'production', '-l', 'warn'];
      const options = (command as any).parseArguments(args);

      expect(options.configPath).toBe('./config.yaml');
      expect(options.environment).toBe('production');
      expect(options.logLevel).toBe('warn');
    });
  });

  describe('showHelp', () => {
    it('should display help information', () => {
      (command as any).showHelp();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Log Monitor - TypeScript Version')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: npm start [options]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('--config')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('--help')
      );
    });
  });

  describe('showVersion', () => {
    it('should display version information', () => {
      (command as any).showVersion();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Log Monitor - TypeScript Version 1.0.0'
      );
    });
  });

  describe('help and version flags', () => {
    it('should show help when --help is passed', () => {
      const args = ['--help'];
      (command as any).parseArguments(args);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Log Monitor - TypeScript Version')
      );
    });

    it('should show version when --version is passed', () => {
      const args = ['--version'];
      (command as any).parseArguments(args);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Log Monitor - TypeScript Version 1.0.0'
      );
    });

    it('should show help when -h is passed', () => {
      const args = ['-h'];
      (command as any).parseArguments(args);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Log Monitor - TypeScript Version')
      );
    });

    it('should show version when -v is passed', () => {
      const args = ['-v'];
      (command as any).parseArguments(args);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Log Monitor - TypeScript Version 1.0.0'
      );
    });
  });
}); 