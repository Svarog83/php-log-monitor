import { LogEntryUtils, LogLevel } from '../../../../src/domain/models/LogEntry.js';

describe('LogEntryUtils', () => {
  describe('parseJsonLog', () => {
    it('should parse valid JSON log entry', () => {
      const jsonLog = JSON.stringify({
        message: 'Test log message',
        level: 'ERROR',
        timestamp: '2024-01-01T00:00:00Z',
        context: { userId: 123 }
      });

      const result = LogEntryUtils.parseJsonLog(jsonLog);

      expect(result).toEqual({
        timestamp: '2024-01-01T00:00:00Z',
        level: 'ERROR',
        message: 'Test log message',
        context: { userId: 123 }
      });
    });

    it('should handle missing fields with defaults', () => {
      const jsonLog = JSON.stringify({
        message: 'Test log message'
      });

      const result = LogEntryUtils.parseJsonLog(jsonLog);

      expect(result).toEqual({
        timestamp: expect.any(String),
        level: 'INFO',
        message: 'Test log message',
        context: {}
      });
    });

    it('should handle datetime field', () => {
      const jsonLog = JSON.stringify({
        message: 'Test log message',
        datetime: '2024-01-01T00:00:00Z'
      });

      const result = LogEntryUtils.parseJsonLog(jsonLog);

      expect(result?.timestamp).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle meta field as context', () => {
      const jsonLog = JSON.stringify({
        message: 'Test log message',
        meta: { userId: 123 }
      });

      const result = LogEntryUtils.parseJsonLog(jsonLog);

      expect(result?.context).toEqual({ userId: 123 });
    });

    it('should return null for invalid JSON', () => {
      const result = LogEntryUtils.parseJsonLog('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for non-object JSON', () => {
      const result = LogEntryUtils.parseJsonLog('"string"');
      expect(result).toBeNull();
    });
  });

  describe('normalizeLevel', () => {
    it('should normalize uppercase levels', () => {
      expect(LogEntryUtils.normalizeLevel('ERROR')).toBe('ERROR');
      expect(LogEntryUtils.normalizeLevel('WARNING')).toBe('WARNING');
      expect(LogEntryUtils.normalizeLevel('INFO')).toBe('INFO');
      expect(LogEntryUtils.normalizeLevel('DEBUG')).toBe('DEBUG');
    });

    it('should normalize lowercase levels', () => {
      expect(LogEntryUtils.normalizeLevel('error')).toBe('ERROR');
      expect(LogEntryUtils.normalizeLevel('warning')).toBe('WARNING');
      expect(LogEntryUtils.normalizeLevel('info')).toBe('INFO');
      expect(LogEntryUtils.normalizeLevel('debug')).toBe('DEBUG');
    });

    it('should handle WARN as WARNING', () => {
      expect(LogEntryUtils.normalizeLevel('WARN')).toBe('WARNING');
      expect(LogEntryUtils.normalizeLevel('warn')).toBe('WARNING');
    });

    it('should return INFO for unknown levels', () => {
      expect(LogEntryUtils.normalizeLevel('UNKNOWN')).toBe('INFO');
      expect(LogEntryUtils.normalizeLevel('')).toBe('INFO');
    });
  });

  describe('isValidLevel', () => {
    it('should return true for valid levels', () => {
      expect(LogEntryUtils.isValidLevel('ERROR')).toBe(true);
      expect(LogEntryUtils.isValidLevel('WARNING')).toBe(true);
      expect(LogEntryUtils.isValidLevel('INFO')).toBe(true);
      expect(LogEntryUtils.isValidLevel('DEBUG')).toBe(true);
    });

    it('should return false for invalid levels', () => {
      expect(LogEntryUtils.isValidLevel('UNKNOWN')).toBe(false);
      expect(LogEntryUtils.isValidLevel('')).toBe(false);
      expect(LogEntryUtils.isValidLevel('warn')).toBe(false);
    });
  });

  describe('createFromRaw', () => {
    const rawEntry = {
      content: JSON.stringify({
        message: 'Test message',
        level: 'ERROR',
        context: { userId: 123 }
      }),
      lineNumber: 1,
      filePath: '/var/log/test.log'
    };

    it('should create tracked log entry from raw entry', () => {
      const result = LogEntryUtils.createFromRaw(rawEntry, 'test-project', 100);

      expect(result).toEqual({
        timestamp: expect.any(String),
        level: 'ERROR',
        message: 'Test message',
        context: { userId: 123 },
        source: 'test-project',
        rawContent: rawEntry.content,
        lineNumber: 1,
        filePath: '/var/log/test.log',
        position: 100,
        projectName: 'test-project'
      });
    });

    it('should handle non-JSON content', () => {
      const nonJsonEntry = {
        content: 'Plain text log message',
        lineNumber: 1,
        filePath: '/var/log/test.log'
      };

      const result = LogEntryUtils.createFromRaw(nonJsonEntry, 'test-project', 100);

      expect(result).toEqual({
        timestamp: expect.any(String),
        level: 'INFO',
        message: 'Plain text log message',
        context: {},
        source: 'test-project',
        rawContent: 'Plain text log message',
        lineNumber: 1,
        filePath: '/var/log/test.log',
        position: 100,
        projectName: 'test-project'
      });
    });
  });
}); 