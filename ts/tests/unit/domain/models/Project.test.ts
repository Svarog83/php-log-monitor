import { Project } from '../../../../src/domain/models/Project.js';
import { PositionStorageConfig } from '../../../../src/domain/models/PositionStorageConfig.js';

describe('Project', () => {
  describe('constructor', () => {
    it('should create a project with valid parameters', () => {
      const project = new Project('test-project', ['/var/log/test']);
      
      expect(project.name).toBe('test-project');
      expect(project.monitoredDirectories).toEqual(['/var/log/test']);
      expect(project.logPattern).toBe('logstash-*.json');
    });

    it('should create a project with custom log pattern', () => {
      const project = new Project('test-project', ['/var/log/test'], '*.log');
      
      expect(project.logPattern).toBe('*.log');
    });

    it('should create a project with position storage config', () => {
      const positionStorage = new PositionStorageConfig('cached', 'var/positions', 60);
      const project = new Project('test-project', ['/var/log/test'], '*.log', positionStorage);
      
      expect(project.positionStorage).toBe(positionStorage);
    });
  });

  describe('validation', () => {
    it('should throw error for empty project name', () => {
      expect(() => {
        new Project('', ['/var/log/test']);
      }).toThrow('Project name cannot be empty');
    });

    it('should throw error for whitespace-only project name', () => {
      expect(() => {
        new Project('   ', ['/var/log/test']);
      }).toThrow('Project name cannot be empty');
    });

    it('should throw error for empty monitored directories', () => {
      expect(() => {
        new Project('test-project', []);
      }).toThrow('At least one monitored directory is required');
    });

    it('should throw error for empty directory path', () => {
      expect(() => {
        new Project('test-project', ['']);
      }).toThrow('Monitored directory cannot be empty');
    });

    it('should throw error for whitespace-only directory path', () => {
      expect(() => {
        new Project('test-project', ['   ']);
      }).toThrow('Monitored directory cannot be empty');
    });
  });

  describe('methods', () => {
    let project: Project;

    beforeEach(() => {
      project = new Project('test-project', ['/var/log/test', '/var/log/test2']);
    });

    it('should return monitored directories', () => {
      const directories = project.getMonitoredDirectories();
      
      expect(directories).toEqual(['/var/log/test', '/var/log/test2']);
      expect(directories).not.toBe(project.monitoredDirectories); // Should be a copy
    });

    it('should return log pattern', () => {
      expect(project.getLogPattern()).toBe('logstash-*.json');
    });

    it('should return position storage config', () => {
      const config = project.getPositionStorageConfig();
      expect(config).toBeInstanceOf(PositionStorageConfig);
    });

    it('should check if position tracking is enabled', () => {
      expect(project.isPositionTrackingEnabled()).toBe(true); // Default config is enabled
    });

    it('should convert to JSON', () => {
      const json = project.toJSON();
      
      expect(json).toEqual({
        name: 'test-project',
        monitoredDirectories: ['/var/log/test', '/var/log/test2'],
        logPattern: 'logstash-*.json',
        positionStorage: expect.any(Object),
      });
    });
  });
}); 