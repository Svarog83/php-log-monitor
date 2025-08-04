import { promises as fs } from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { LogFileRepository } from '../../domain/repositories/LogFileRepository.js';
import { LogFile } from '../../domain/models/LogFile.js';
import { Project } from '../../domain/models/Project.js';

/**
 * Chokidar-based implementation of LogFileRepository
 */
export class ChokidarLogFileRepository implements LogFileRepository {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();

  /**
   * Find the latest log file for a project
   */
  async findLatestLogFile(project: Project): Promise<LogFile | null> {
    try {
      // Check all monitored directories for the latest log file
      let latestFile: LogFile | null = null;
      
      for (const directory of project.monitoredDirectories) {
        const files = await this.findLogFilesInDirectory(directory, project.logPattern);
        
        if (files.length > 0) {
          // Sort by modification time, newest first
          files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
          
          const directoryLatest = files[0];
          if (directoryLatest && (!latestFile || directoryLatest.isNewerThan(latestFile))) {
            latestFile = directoryLatest;
          }
        }
      }
      
      return latestFile;
    } catch (error) {
      console.error(`Error finding latest log file for project ${project.name}:`, error);
      return null;
    }
  }

  /**
   * Watch a directory for changes
   */
  async watchDirectory(
    path: string,
    pattern: string,
    onFileChange: (filePath: string) => void
  ): Promise<void> {
    const watcher = chokidar.watch(path, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    watcher.on('add', (filePath) => {
      if (this.matchesPattern(filePath, pattern)) {
        onFileChange(filePath);
      }
    });

    watcher.on('change', (filePath) => {
      if (this.matchesPattern(filePath, pattern)) {
        onFileChange(filePath);
      }
    });

    this.watchers.set(path, watcher);
  }

  /**
   * Get file size
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Read new lines from a file starting from a position
   */
  async readNewLines(filePath: string, fromPosition: number): Promise<string[]> {
    try {
      const stats = await fs.stat(filePath);
      const currentSize = stats.size;

      if (fromPosition >= currentSize) {
        return [];
      }

      const fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - fromPosition);
      
      await fileHandle.read(buffer, 0, buffer.length, fromPosition);
      await fileHandle.close();

      const content = buffer.toString('utf8');
      return content.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      console.error(`Error reading new lines from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file modification time
   */
  async getFileModifiedTime(filePath: string): Promise<Date> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime;
    } catch {
      return new Date(0);
    }
  }

  /**
   * Stop watching all directories
   */
  async stopWatching(): Promise<void> {
    for (const [path, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Find all log files in a directory matching the pattern
   */
  private async findLogFilesInDirectory(dirPath: string, pattern: string): Promise<LogFile[]> {
    try {
      const files = await fs.readdir(dirPath);
      const logFiles: LogFile[] = [];

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && this.matchesPattern(filePath, pattern)) {
          logFiles.push(new LogFile(filePath, stats.size, stats.mtime));
        }
      }

      return logFiles;
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Check if a file path matches the given pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const fileName = path.basename(filePath);
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(fileName);
  }
} 