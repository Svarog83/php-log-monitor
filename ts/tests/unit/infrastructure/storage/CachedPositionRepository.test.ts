import { CachedPositionRepository } from '../../../../src/infrastructure/storage/CachedPositionRepository.js';
import { FilePositionRepository } from '../../../../src/infrastructure/storage/FilePositionRepository.js';
import { FilePosition } from '../../../../src/domain/models/FilePosition.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('CachedPositionRepository', () => {
  let cachedRepository: CachedPositionRepository;
  let fileRepository: FilePositionRepository;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-monitor-test-'));
    fileRepository = new FilePositionRepository(tempDir);
    cachedRepository = new CachedPositionRepository(fileRepository, 1000); // 1 second cache timeout
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('caching behavior', () => {
    it('should cache loaded positions', async () => {
      const filePosition = new FilePosition(
        '/var/log/app.log',
        1024,
        new Date(),
        'test-project'
      );

      // Save position to underlying repository
      await fileRepository.saveFilePosition(filePosition);

      // Load position twice - second call should use cache
      const position1 = await cachedRepository.loadFilePosition('test-project', '/var/log/app.log');
      const position2 = await cachedRepository.loadFilePosition('test-project', '/var/log/app.log');

      expect(position1).not.toBeNull();
      expect(position2).not.toBeNull();
      expect(position1?.position).toBe(position2?.position);
    });

    it('should cache save operations', async () => {
      const filePosition = new FilePosition(
        '/var/log/app.log',
        2048,
        new Date(),
        'test-project'
      );

      // Save to cached repository
      await cachedRepository.saveFilePosition(filePosition);

      // Check cache stats
      const stats = cachedRepository.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.dirtyCount).toBe(1);

      // Load should return cached value
      const loaded = await cachedRepository.loadFilePosition('test-project', '/var/log/app.log');
      expect(loaded?.position).toBe(2048);
    });

    it('should flush dirty cache on forceSave', async () => {
      const filePosition = new FilePosition(
        '/var/log/app.log',
        2048,
        new Date(),
        'test-project'
      );

      // Save to cached repository
      await cachedRepository.saveFilePosition(filePosition);

      // Check that it's not yet saved to underlying repository
      const beforeForceSave = await fileRepository.loadFilePosition('test-project', '/var/log/app.log');
      expect(beforeForceSave).toBeNull();

      // Force save
      await cachedRepository.forceSave();

      // Check that it's now saved to underlying repository
      const afterForceSave = await fileRepository.loadFilePosition('test-project', '/var/log/app.log');
      expect(afterForceSave).not.toBeNull();
      expect(afterForceSave?.position).toBe(2048);

      // Check that cache is no longer dirty
      const stats = cachedRepository.getCacheStats();
      expect(stats.dirtyCount).toBe(0);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate stale cache entries', async () => {
      const oldDate = new Date(Date.now() - 2000); // 2 seconds ago
      const filePosition = new FilePosition(
        '/var/log/app.log',
        1024,
        oldDate,
        'test-project'
      );

      // Save to underlying repository
      await fileRepository.saveFilePosition(filePosition);

      // Load into cache
      await cachedRepository.loadFilePosition('test-project', '/var/log/app.log');

      // Wait for cache to become stale
      await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 seconds

      // Load again - should fetch from underlying repository
      const loaded = await cachedRepository.loadFilePosition('test-project', '/var/log/app.log');
      expect(loaded).not.toBeNull();
      expect(loaded?.position).toBe(1024);
    });
  });

  describe('clearPositions', () => {
    it('should clear both cache and underlying repository', async () => {
      const filePosition = new FilePosition(
        '/var/log/app.log',
        1024,
        new Date(),
        'test-project'
      );

      // Save to cached repository
      await cachedRepository.saveFilePosition(filePosition);

      // Clear positions
      await cachedRepository.clearPositions('test-project');

      // Check that cache is cleared
      const stats = cachedRepository.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.dirtyCount).toBe(0);

      // Check that underlying repository is cleared
      const loaded = await cachedRepository.loadFilePosition('test-project', '/var/log/app.log');
      expect(loaded).toBeNull();
    });
  });

  describe('getAllPositions', () => {
    it('should merge cached and underlying positions', async () => {
      // Save to underlying repository
      const underlyingPosition = new FilePosition(
        '/var/log/app1.log',
        1024,
        new Date(),
        'test-project'
      );
      await fileRepository.saveFilePosition(underlyingPosition);

      // Save to cache
      const cachedPosition = new FilePosition(
        '/var/log/app2.log',
        2048,
        new Date(),
        'test-project'
      );
      await cachedRepository.saveFilePosition(cachedPosition);

      // Get all positions
      const positions = await cachedRepository.getAllPositions('test-project');

      expect(positions).toHaveLength(2);
      expect(positions.map(p => p.filePath)).toContain('/var/log/app1.log');
      expect(positions.map(p => p.filePath)).toContain('/var/log/app2.log');
    });
  });

  describe('cache management', () => {
    it('should allow clearing cache', async () => {
      const filePosition = new FilePosition(
        '/var/log/app.log',
        1024,
        new Date(),
        'test-project'
      );

      // Save to cached repository
      await cachedRepository.saveFilePosition(filePosition);

      // Check cache has entry
      expect(cachedRepository.getCacheStats().size).toBe(1);

      // Clear cache
      cachedRepository.clearCache();

      // Check cache is empty
      expect(cachedRepository.getCacheStats().size).toBe(0);
      expect(cachedRepository.getCacheStats().dirtyCount).toBe(0);
    });
  });
}); 