import { PositionRepository } from '../../domain/repositories/PositionRepository.js';
import { FilePosition } from '../../domain/models/FilePosition.js';

/**
 * Async implementation of PositionRepository that batches saves
 */
export class AsyncPositionRepository implements PositionRepository {
  private readonly wrappedRepository: PositionRepository;
  private readonly batchSize: number;
  private readonly flushInterval: number; // milliseconds
  private pendingSaves: Map<string, FilePosition> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(
    wrappedRepository: PositionRepository,
    batchSize: number = 100,
    flushInterval: number = 5000 // 5 seconds
  ) {
    this.wrappedRepository = wrappedRepository;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
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
    this.pendingSaves.set(key, position);

    // Flush if we've reached the batch size
    if (this.pendingSaves.size >= this.batchSize) {
      await this.flushPendingSaves();
    }
  }

  /**
   * Load a file position object
   */
  async loadFilePosition(projectName: string, filePath: string): Promise<FilePosition | null> {
    // Check pending saves first
    const key = `${projectName}:${filePath}`;
    const pending = this.pendingSaves.get(key);
    if (pending) {
      return pending;
    }

    // Load from wrapped repository
    return await this.wrappedRepository.loadFilePosition(projectName, filePath);
  }

  /**
   * Force save all pending positions immediately
   */
  async forceSave(): Promise<void> {
    await this.flushPendingSaves();
  }

  /**
   * Clear all positions for a project
   */
  async clearPositions(projectName: string): Promise<void> {
    // Clear pending saves for this project
    const keysToRemove: string[] = [];
    for (const [key] of this.pendingSaves) {
      if (key.startsWith(`${projectName}:`)) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      this.pendingSaves.delete(key);
    }

    // Clear from wrapped repository
    await this.wrappedRepository.clearPositions(projectName);
  }

  /**
   * Get all positions for a project
   */
  async getAllPositions(projectName: string): Promise<FilePosition[]> {
    // Get from wrapped repository
    const positions = await this.wrappedRepository.getAllPositions(projectName);
    
    // Add any pending saves for this project
    const pendingPositions: FilePosition[] = [];
    for (const [key, position] of this.pendingSaves) {
      if (key.startsWith(`${projectName}:`)) {
        pendingPositions.push(position);
      }
    }
    
    // Merge and deduplicate (pending saves take precedence)
    const merged = new Map<string, FilePosition>();
    
    for (const position of positions) {
      merged.set(position.getKey(), position);
    }
    
    for (const position of pendingPositions) {
      merged.set(position.getKey(), position);
    }
    
    return Array.from(merged.values());
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(async () => {
      if (this.pendingSaves.size > 0) {
        await this.flushPendingSaves();
      }
    }, this.flushInterval);
  }

  /**
   * Flush all pending saves to the wrapped repository
   */
  private async flushPendingSaves(): Promise<void> {
    if (this.isFlushing || this.pendingSaves.size === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const positionsToSave = Array.from(this.pendingSaves.values());
      
      // Save all positions in parallel
      await Promise.all(
        positionsToSave.map(position => 
          this.wrappedRepository.saveFilePosition(position)
        )
      );
      
      // Clear pending saves
      this.pendingSaves.clear();
    } catch (error) {
      console.error('Error flushing pending saves:', error);
      // Don't clear pending saves on error - they'll be retried
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Stop the repository and flush any remaining saves
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    await this.flushPendingSaves();
  }

  /**
   * Get statistics about pending saves
   */
  getStats(): { pendingCount: number; isFlushing: boolean } {
    return {
      pendingCount: this.pendingSaves.size,
      isFlushing: this.isFlushing
    };
  }
} 