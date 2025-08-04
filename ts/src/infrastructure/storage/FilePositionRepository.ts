import { promises as fs } from 'fs';
import path from 'path';
import { PositionRepository } from '../../domain/repositories/PositionRepository.js';
import { FilePosition } from '../../domain/models/FilePosition.js';

/**
 * File-based implementation of PositionRepository
 */
export class FilePositionRepository implements PositionRepository {
  private readonly positionsDir: string;
  private readonly positionsFile: string;

  constructor(positionsDir: string = './var/positions') {
    this.positionsDir = positionsDir;
    this.positionsFile = path.join(positionsDir, 'positions.json');
  }

  /**
   * Load position for a specific file in a project
   */
  async loadPosition(projectName: string, filePath: string): Promise<number> {
    try {
      const position = await this.loadFilePosition(projectName, filePath);
      return position?.position ?? 0;
    } catch (error) {
      console.error(`Error loading position for ${projectName}:${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Save position for a specific file in a project
   */
  async savePosition(projectName: string, filePath: string, position: number): Promise<void> {
    try {
      const filePosition = new FilePosition(
        filePath,
        position,
        new Date(),
        projectName
      );
      await this.saveFilePosition(filePosition);
    } catch (error) {
      console.error(`Error saving position for ${projectName}:${filePath}:`, error);
    }
  }

  /**
   * Save a file position object
   */
  async saveFilePosition(position: FilePosition): Promise<void> {
    try {
      await this.ensurePositionsDir();
      
      const positions = await this.loadAllPositions();
      const key = position.getKey();
      
      positions[key] = position.toJSON();
      
      await this.saveAllPositions(positions);
    } catch (error) {
      console.error('Error saving file position:', error);
      throw error;
    }
  }

  /**
   * Load a file position object
   */
  async loadFilePosition(projectName: string, filePath: string): Promise<FilePosition | null> {
    try {
      const positions = await this.loadAllPositions();
      const key = `${projectName}:${filePath}`;
      const positionData = positions[key];
      
      if (!positionData) {
        return null;
      }
      
      return FilePosition.fromJSON(positionData as Record<string, unknown>);
    } catch (error) {
      console.error(`Error loading file position for ${projectName}:${filePath}:`, error);
      return null;
    }
  }

  /**
   * Force save all pending positions immediately
   */
  async forceSave(): Promise<void> {
    // File-based implementation doesn't need batching, so this is a no-op
    // But we ensure the directory exists
    await this.ensurePositionsDir();
  }

  /**
   * Clear all positions for a project
   */
  async clearPositions(projectName: string): Promise<void> {
    try {
      const positions = await this.loadAllPositions();
      const updatedPositions: Record<string, unknown> = {};
      
      for (const [key, positionData] of Object.entries(positions)) {
        if (!key.startsWith(`${projectName}:`)) {
          updatedPositions[key] = positionData;
        }
      }
      
      await this.saveAllPositions(updatedPositions);
    } catch (error) {
      console.error(`Error clearing positions for project ${projectName}:`, error);
    }
  }

  /**
   * Get all positions for a project
   */
  async getAllPositions(projectName: string): Promise<FilePosition[]> {
    try {
      const positions = await this.loadAllPositions();
      const projectPositions: FilePosition[] = [];
      
      for (const [key, positionData] of Object.entries(positions)) {
        if (key.startsWith(`${projectName}:`)) {
          projectPositions.push(FilePosition.fromJSON(positionData as Record<string, unknown>));
        }
      }
      
      return projectPositions;
    } catch (error) {
      console.error(`Error getting all positions for project ${projectName}:`, error);
      return [];
    }
  }

  /**
   * Ensure the positions directory exists
   */
  private async ensurePositionsDir(): Promise<void> {
    try {
      await fs.mkdir(this.positionsDir, { recursive: true });
    } catch (error) {
      console.error(`Error creating positions directory ${this.positionsDir}:`, error);
    }
  }

  /**
   * Load all positions from the positions file
   */
  private async loadAllPositions(): Promise<Record<string, unknown>> {
    try {
      const data = await fs.readFile(this.positionsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, return empty object
      return {};
    }
  }

  /**
   * Save all positions to the positions file
   */
  private async saveAllPositions(positions: Record<string, unknown>): Promise<void> {
    try {
      const data = JSON.stringify(positions, null, 2);
      await fs.writeFile(this.positionsFile, data, 'utf8');
    } catch (error) {
      console.error(`Error saving positions to ${this.positionsFile}:`, error);
      throw error;
    }
  }
} 