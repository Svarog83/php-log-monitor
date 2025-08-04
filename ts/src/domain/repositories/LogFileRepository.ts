import { LogFile } from '../models/LogFile.js';
import { Project } from '../models/Project.js';

/**
 * Repository interface for log file operations
 */
export interface LogFileRepository {
  /**
   * Find the latest log file for a project
   */
  findLatestLogFile(project: Project): Promise<LogFile | null>;

  /**
   * Watch a directory for changes
   */
  watchDirectory(
    path: string,
    pattern: string,
    onFileChange: (filePath: string) => void
  ): Promise<void>;

  /**
   * Get file size
   */
  getFileSize(filePath: string): Promise<number>;

  /**
   * Read new lines from a file starting from a position
   */
  readNewLines(filePath: string, fromPosition: number): Promise<string[]>;

  /**
   * Check if a file exists
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
   * Get file modification time
   */
  getFileModifiedTime(filePath: string): Promise<Date>;

  /**
   * Stop watching all directories
   */
  stopWatching(): Promise<void>;
} 