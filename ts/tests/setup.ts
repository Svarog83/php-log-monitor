// Jest setup file
import { jest } from '@jest/globals';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Global teardown to ensure all watchers are closed
afterAll(async () => {
  // Give any remaining async operations time to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Force close any remaining file watchers
  const chokidar = require('chokidar');
  if (chokidar && chokidar.watch) {
    // This will close any remaining watchers
    const mockWatcher = chokidar.watch('', { persistent: false });
    if (mockWatcher && typeof mockWatcher.close === 'function') {
      await mockWatcher.close();
    }
  }
});

// Ensure each test cleans up after itself
afterEach(async () => {
  // Clear any timers
  jest.clearAllTimers();

  // Give async operations time to complete
  await new Promise(resolve => setTimeout(resolve, 50));
}); 