/**
 * Global teardown for Jest tests
 * Ensures all file watchers and async operations are properly cleaned up
 */
export default async function globalTeardown(): Promise<void> {
  console.log('Running global teardown...');
  
  try {
    // Force close any remaining Chokidar watchers
    const chokidar = require('chokidar');
    if (chokidar && chokidar.watch) {
      // Create a temporary watcher and close it to trigger cleanup
      const tempWatcher = chokidar.watch('', { 
        persistent: false,
        ignoreInitial: true,
        awaitWriteFinish: false
      });
      
      if (tempWatcher && typeof tempWatcher.close === 'function') {
        await tempWatcher.close();
      }
    }
    
    // Give any remaining async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('Global teardown completed');
  } catch (error) {
    console.error('Error during global teardown:', error);
  }
} 