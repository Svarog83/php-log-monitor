import { FilePosition } from '../models/FilePosition.js';

/**
 * Repository interface for position tracking operations
 */
export interface PositionRepository {
  /**
   * Load position for a specific file in a project
   */
  loadPosition(projectName: string, filePath: string): Promise<number>;

  /**
   * Save position for a specific file in a project
   */
  savePosition(projectName: string, filePath: string, position: number): Promise<void>;

  /**
   * Save a file position object
   */
  saveFilePosition(position: FilePosition): Promise<void>;

  /**
   * Load a file position object
   */
  loadFilePosition(projectName: string, filePath: string): Promise<FilePosition | null>;

  /**
   * Force save all pending positions immediately
   */
  forceSave(): Promise<void>;

  /**
   * Clear all positions for a project
   */
  clearPositions(projectName: string): Promise<void>;

  /**
   * Get all positions for a project
   */
  getAllPositions(projectName: string): Promise<FilePosition[]>;
} 