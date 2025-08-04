import { FilePositionRepository } from '../../../../src/infrastructure/storage/FilePositionRepository.js';
import { FilePosition } from '../../../../src/domain/models/FilePosition.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('FilePositionRepository', () => {
  let repository: FilePositionRepository;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-monitor-test-'));
    repository = new FilePositionRepository(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('savePosition and loadPosition', () => {
    it('should save and load position correctly', async () => {
      const projectName = 'test-project';
      const filePath = '/var/log/app.log';
      const position = 1024;

      await repository.savePosition(projectName, filePath, position);
      const loadedPosition = await repository.loadPosition(projectName, filePath);

      expect(loadedPosition).toBe(position);
    });

    it('should return 0 for non-existent position', async () => {
      const position = await repository.loadPosition('non-existent', '/var/log/app.log');
      expect(position).toBe(0);
    });
  });

  describe('saveFilePosition and loadFilePosition', () => {
    it('should save and load FilePosition object correctly', async () => {
      const filePosition = new FilePosition(
        '/var/log/app.log',
        2048,
        new Date('2023-01-01T12:00:00Z'),
        'test-project'
      );

      await repository.saveFilePosition(filePosition);
      const loadedPosition = await repository.loadFilePosition('test-project', '/var/log/app.log');

      expect(loadedPosition).not.toBeNull();
      expect(loadedPosition?.filePath).toBe(filePosition.filePath);
      expect(loadedPosition?.position).toBe(filePosition.position);
      expect(loadedPosition?.projectName).toBe(filePosition.projectName);
    });

    it('should return null for non-existent FilePosition', async () => {
      const position = await repository.loadFilePosition('non-existent', '/var/log/app.log');
      expect(position).toBeNull();
    });
  });

  describe('clearPositions', () => {
    it('should clear all positions for a project', async () => {
      // Save positions for two projects
      await repository.savePosition('project1', '/var/log/app1.log', 100);
      await repository.savePosition('project1', '/var/log/app2.log', 200);
      await repository.savePosition('project2', '/var/log/app3.log', 300);

      // Clear positions for project1
      await repository.clearPositions('project1');

      // Check that project1 positions are cleared
      expect(await repository.loadPosition('project1', '/var/log/app1.log')).toBe(0);
      expect(await repository.loadPosition('project1', '/var/log/app2.log')).toBe(0);

      // Check that project2 positions are still there
      expect(await repository.loadPosition('project2', '/var/log/app3.log')).toBe(300);
    });
  });

  describe('getAllPositions', () => {
    it('should return all positions for a project', async () => {
      const positions = [
        new FilePosition('/var/log/app1.log', 100, new Date(), 'test-project'),
        new FilePosition('/var/log/app2.log', 200, new Date(), 'test-project'),
        new FilePosition('/var/log/app3.log', 300, new Date(), 'other-project')
      ];

      for (const position of positions) {
        await repository.saveFilePosition(position);
      }

      const projectPositions = await repository.getAllPositions('test-project');

      expect(projectPositions).toHaveLength(2);
      expect(projectPositions.map(p => p.filePath)).toContain('/var/log/app1.log');
      expect(projectPositions.map(p => p.filePath)).toContain('/var/log/app2.log');
    });

    it('should return empty array for non-existent project', async () => {
      const positions = await repository.getAllPositions('non-existent');
      expect(positions).toEqual([]);
    });
  });

  describe('forceSave', () => {
    it('should ensure positions directory exists', async () => {
      // This test verifies that forceSave doesn't throw an error
      // and ensures the directory structure is created
      await expect(repository.forceSave()).resolves.not.toThrow();
      
      const positionsDir = path.join(tempDir, 'positions.json');
      const dirExists = await fs.access(path.dirname(positionsDir)).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });
}); 