export type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';

/**
 * Interface representing a parsed log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  source?: string;
}

/**
 * Raw log entry as read from file
 */
export interface RawLogEntry {
  content: string;
  lineNumber: number;
  filePath: string;
}

/**
 * Parsed log entry with additional metadata
 */
export interface ParsedLogEntry extends LogEntry {
  rawContent: string;
  lineNumber: number;
  filePath: string;
}

/**
 * Log entry with position tracking information
 */
export interface TrackedLogEntry extends ParsedLogEntry {
  position: number;
  projectName: string;
}

/**
 * Utility class for log entry operations
 */
export class LogEntryUtils {
  public static parseJsonLog(content: string): LogEntry | null {
    try {
      const parsed = JSON.parse(content);
      
      return {
        timestamp: parsed.timestamp || parsed.datetime || new Date().toISOString(),
        level: this.normalizeLevel(parsed.level || 'INFO'),
        message: parsed.message || content,
        context: parsed.context || parsed.meta || {},
      };
    } catch {
      return null;
    }
  }

  public static normalizeLevel(level: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      'ERROR': 'ERROR',
      'WARNING': 'WARNING',
      'WARN': 'WARNING',
      'INFO': 'INFO',
      'DEBUG': 'DEBUG',
      'error': 'ERROR',
      'warning': 'WARNING',
      'warn': 'WARNING',
      'info': 'INFO',
      'debug': 'DEBUG',
    };

    return levelMap[level.toUpperCase()] || 'INFO';
  }

  public static isValidLevel(level: string): level is LogLevel {
    return ['ERROR', 'WARNING', 'INFO', 'DEBUG'].includes(level);
  }

  public static createFromRaw(
    raw: RawLogEntry,
    projectName: string,
    position: number
  ): TrackedLogEntry {
    const parsed = this.parseJsonLog(raw.content);
    
    return {
      timestamp: parsed?.timestamp || new Date().toISOString(),
      level: parsed?.level || 'INFO',
      message: parsed?.message || raw.content,
      context: parsed?.context || {},
      source: projectName,
      rawContent: raw.content,
      lineNumber: raw.lineNumber,
      filePath: raw.filePath,
      position,
      projectName,
    };
  }
} 