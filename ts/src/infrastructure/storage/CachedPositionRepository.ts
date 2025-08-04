import { PositionRepository } from '../../domain/repositories/PositionRepository.js';
import { FilePosition } from '../../domain/models/FilePosition.js';

/**
 * Cached implementation of PositionRepository that wraps another repository
 */
export class CachedPositionRepository implements PositionRepository {
  private cache: Map<string, FilePosition> = new Map();
  private dirtyKeys: Set<string> = new Set();
  private readonly wrappedRepository: PositionRepository;
  private readonly cacheTimeout: number; // milliseconds

  constructor(
    wrappedRepository: PositionRepository,
    cacheTimeout: number = 5 * 60 * 1000 // 5 minutes default
  ) {
    this.wrappedRepository = wrappedRepository;
    this.cacheTimeout = cacheTimeout;
  }

  /**
   * Load position for a specific file in a project
   */
  async loadPosition(projectName: string, filePath: string): Promise<number> {
    const position = await this.loadFilePosition(projectName, filePath);
    return position?.position ?? 0;
  }

  /**
   * Save position for a specific file in a project
   */
  async savePosition(projectName: string, filePath: string, position: number): Promise<void> {
    const filePosition = new FilePosition(
      filePath,
      position,
      new Date(),
      projectName
    );
    await this.saveFilePosition(filePosition);
  }

  /**
   * Save a file position object
   */
  async saveFilePosition(position: FilePosition): Promise<void> {
    const key = position.getKey();
    
    // Update cache
    this.cache.set(key, position);
    this.dirtyKeys.add(key);
    
    // Defer actual save to avoid excessive I/O
    // The actual save will happen on forceSave() or when cache is flushed
  }

  /**
   * Load a file position object
   */
  async loadFilePosition(projectName: string, filePath: string): Promise<FilePosition | null> {
    const key = `${projectName}:${filePath}`;
    
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && !this.isStale(cached)) {
      return cached;
    }
    
    // Load from wrapped repository
    const position = await this.wrappedRepository.loadFilePosition(projectName, filePath);
    
    if (position) {
      // Update cache
      this.cache.set(key, position);
    }
    
    return position;
  }

  /**
   * Force save all pending positions immediately
   */
  async forceSave(): Promise<void> {
    const positionsToSave: FilePosition[] = [];
    
    // Collect all dirty positions
    for (const key of this.dirtyKeys) {
      const position = this.cache.get(key);
      if (position) {
        positionsToSave.push(position);
      }
    }
    
    // Save all dirty positions
    for (const position of positionsToSave) {
      await this.wrappedRepository.saveFilePosition(position);
    }
    
    // Clear dirty keys
    this.dirtyKeys.clear();
  }

  /**
   * Clear all positions for a project
   */
  async clearPositions(projectName: string): Promise<void> {
    // Clear from cache
    const keysToRemove: string[] = [];
    for (const [key] of this.cache) {
      if (key.startsWith(`${projectName}:`)) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      this.cache.delete(key);
      this.dirtyKeys.delete(key);
    }
    
    // Clear from wrapped repository
    await this.wrappedRepository.clearPositions(projectName);
  }

  /**
   * Get all positions for a project
   */
  async getAllPositions(projectName: string): Promise<FilePosition[]> {
    // Get from wrapped repository to ensure we have all positions
    const positions = await this.wrappedRepository.getAllPositions(projectName);
    
    // Update cache with fresh data
    for (const position of positions) {
      const key = position.getKey();
      this.cache.set(key, position);
    }
    
    // Add any cached positions for this project that aren't in the wrapped repository
    const cachedPositions: FilePosition[] = [];
    for (const [key, position] of this.cache) {
      if (key.startsWith(`${projectName}:`)) {
        // Check if this position is not already in the positions array
        const exists = positions.some(p => p.getKey() === key);
        if (!exists) {
          cachedPositions.push(position);
        }
      }
    }
    
    // Merge and return all positions
    return [...positions, ...cachedPositions];
  }

  /**
   * Check if a cached position is stale
   */
  private isStale(position: FilePosition): boolean {
    const now = new Date();
    const age = now.getTime() - position.lastModified.getTime();
    return age > this.cacheTimeout;
  }

  /**
   * Clear the cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    this.dirtyKeys.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; dirtyCount: number } {
    return {
      size: this.cache.size,
      dirtyCount: this.dirtyKeys.size
    };
  }
} 