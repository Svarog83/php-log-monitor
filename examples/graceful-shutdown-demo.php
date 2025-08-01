<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Application\Configuration\EnvironmentConfiguration;
use App\Application\Configuration\ProjectConfiguration;
use App\Console\MonitorCommand;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\ConsoleOutput;

/**
 * Demo script to test graceful shutdown functionality
 * 
 * This script demonstrates how the log monitor handles different signals:
 * - Ctrl+C (SIGINT): Graceful shutdown with position saving
 * - Ctrl+Z (SIGTSTP): Graceful shutdown with position saving  
 * - kill command (SIGTERM): Graceful shutdown with position saving
 * 
 * Usage:
 * php examples/graceful-shutdown-demo.php
 * 
 * Then try:
 * - Press Ctrl+C to test SIGINT handling
 * - Press Ctrl+Z to test SIGTSTP handling
 * - In another terminal: kill -TERM <pid> to test SIGTERM handling
 */

echo "=== Log Monitor Graceful Shutdown Demo ===\n";
echo "This demo shows how the application handles process interruption signals.\n\n";

echo "Signal handling features:\n";
echo "- SIGINT (Ctrl+C): Graceful shutdown with position saving\n";
echo "- SIGTERM (kill): Graceful shutdown with position saving\n";
echo "- SIGTSTP (Ctrl+Z): Graceful shutdown with position saving\n\n";

echo "Current PID: " . getmypid() . "\n";
echo "You can test signals from another terminal with: kill -TERM " . getmypid() . "\n\n";

// Check if pcntl extension is available
if (!function_exists('pcntl_signal')) {
    echo "WARNING: pcntl extension not available. Signal handling will be limited.\n";
    echo "Install pcntl extension for full signal handling support.\n\n";
}

echo "Starting log monitor...\n";
echo "Press Ctrl+C to test graceful shutdown\n\n";

try {
    // Create demo log file
    $logDir = __DIR__ . '/../var/log';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }

    $logFile = $logDir . '/demo.log';
    if (!file_exists($logFile)) {
        file_put_contents($logFile, "Demo log file created at " . date('Y-m-d H:i:s') . "\n");
    }

    // Create positions directory
    $positionsDir = __DIR__ . '/../var/positions-demo';
    if (!is_dir($positionsDir)) {
        mkdir($positionsDir, 0755, true);
    }

    // Create a simple configuration for demo
    $configContent = <<<YAML
projects:
  demo-project:
    name: demo-project
    directories:
      - {$logDir}
    log_pattern: "*.log"
    position_storage:
      type: file
      directory: {$positionsDir}
YAML;

    // Write demo config
    $configPath = __DIR__ . '/../config/demo-graceful-shutdown.yaml';
    file_put_contents($configPath, $configContent);

    // Setup application
    $envConfig = new EnvironmentConfiguration('.env');
    
    $application = new Application('Log Monitor Demo', '1.0.0');
    $application->add(new MonitorCommand());
    $application->setDefaultCommand('monitor', true);

    // Create input with demo config
    $input = new ArrayInput([
        'config' => $configPath,
        '--debug' => true,
        '--interval' => '2.0'
    ]);

    $output = new ConsoleOutput();

    echo "Demo configuration:\n";
    echo "- Config file: {$configPath}\n";
    echo "- Log file: {$logFile}\n";
    echo "- Positions directory: {$positionsDir}\n";
    echo "- Scan interval: 2 seconds\n\n";

    echo "Starting monitor...\n";
    echo "The monitor will continuously check for new log entries.\n";
    echo "Try adding content to {$logFile} to see it being processed.\n\n";

    // Run the application
    $exitCode = $application->run($input, $output);

    echo "\nDemo completed with exit code: {$exitCode}\n";

    // Cleanup demo files
    if (file_exists($configPath)) {
        unlink($configPath);
    }

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n=== Demo Summary ===\n";
echo "The graceful shutdown implementation ensures that:\n";
echo "1. Current file positions are saved before shutdown\n";
echo "2. All monitors are stopped properly\n";
echo "3. No data loss occurs during process interruption\n";
echo "4. The application responds to system signals (SIGINT, SIGTERM, SIGTSTP)\n\n";

echo "Test results:\n";
if (function_exists('pcntl_signal')) {
    echo "✓ Signal handling: Available (pcntl extension)\n";
} else {
    echo "✗ Signal handling: Not available (pcntl extension missing)\n";
}

$positionsDir = __DIR__ . '/../var/positions-demo';
if (is_dir($positionsDir)) {
    $positionFiles = glob($positionsDir . '/*.json');
    echo "✓ Position files: " . count($positionFiles) . " saved\n";
} else {
    echo "✗ Position files: Directory not found\n";
}

echo "\nDemo completed successfully!\n"; 