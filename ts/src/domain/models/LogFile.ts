import { promises as fs } from 'fs';
import path from 'path';

/**
 * Value object representing a log file
 */
export class LogFile {
  constructor(
    public readonly path: string,
    public readonly size: number,
    public readonly modifiedAt: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.path.trim()) {
      throw new Error('Log file path cannot be empty');
    }

    if (this.size < 0) {
      throw new Error('Log file size cannot be negative');
    }
  }

  public getFileName(): string {
    return path.basename(this.path);
  }

  public getDirectory(): string {
    return path.dirname(this.path);
  }

  public async exists(): Promise<boolean> {
    try {
      await fs.access(this.path);
      return true;
    } catch {
      return false;
    }
  }

  public async getCurrentSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.path);
      return stats.size;
    } catch {
      return 0;
    }
  }

  public async getCurrentModifiedAt(): Promise<Date> {
    try {
      const stats = await fs.stat(this.path);
      return stats.mtime;
    } catch {
      return new Date(0);
    }
  }

  public isNewerThan(other: LogFile): boolean {
    return this.modifiedAt.getTime() > other.modifiedAt.getTime();
  }

  public isLargerThan(other: LogFile): boolean {
    return this.size > other.size;
  }

  public toJSON(): Record<string, unknown> {
    return {
      path: this.path,
      size: this.size,
      modifiedAt: this.modifiedAt.toISOString(),
    };
  }

  public static async fromPath(filePath: string): Promise<LogFile> {
    const stats = await fs.stat(filePath);
    return new LogFile(filePath, stats.size, stats.mtime);
  }
} 