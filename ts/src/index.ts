#!/usr/bin/env node

import { MonitorCommand } from './console/MonitorCommand.js';

/**
 * Main entry point for the log monitor application
 */
async function main(): Promise<void> {
  try {
    // Get command line arguments (skip first two: node and script path)
    const args = process.argv.slice(2);
    
    // Create and run the monitor command
    const command = new MonitorCommand();
    await command.run(args);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 