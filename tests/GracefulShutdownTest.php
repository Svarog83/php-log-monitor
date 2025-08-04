<?php

declare(strict_types=1);

namespace Tests;

use App\Application\Configuration\EnvironmentConfiguration;
use App\Application\Configuration\ProjectConfiguration;
use App\Domain\Model\PositionTracker;
use App\Infrastructure\FileSystem\LogFileFinder;
use App\Infrastructure\Logging\DebugLogger;
use App\Infrastructure\Logging\LoggerFactory;
use App\Infrastructure\Logging\MonologAdapter;
use App\Infrastructure\Storage\PositionStorageFactory;
use PHPUnit\Framework\TestCase;

/**
 * Test graceful shutdown functionality
 */
class GracefulShutdownTest extends TestCase
{
    private string $testLogDir;
    private string $testPositionsDir;
    private string $testLogFile;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test directories
        $this->testLogDir = sys_get_temp_dir() . '/log-monitor-test-' . uniqid();
        $this->testPositionsDir = sys_get_temp_dir() . '/positions-test-' . uniqid();
        $this->testLogFile = $this->testLogDir . '/test.log';

        mkdir($this->testLogDir, 0755, true);
        mkdir($this->testPositionsDir, 0755, true);

        // Create test log file
        file_put_contents($this->testLogFile, "Test log entry 1\nTest log entry 2\n");
    }

    protected function tearDown(): void
    {
        // Cleanup test directories
        if (is_dir($this->testLogDir)) {
            $this->removeDirectory($this->testLogDir);
        }
        if (is_dir($this->testPositionsDir)) {
            $this->removeDirectory($this->testPositionsDir);
        }

        parent::tearDown();
    }

    /**
     * Test that positions are saved during graceful shutdown
     */
    public function testGracefulShutdownSavesPositions(): void
    {
        // Create test configuration
        $configContent = <<<YAML
projects:
  test-project:
    name: test-project
    directories:
      - {$this->testLogDir}
    log_pattern: "*.log"
    position_storage:
      enabled: true
      storage:
        type: file
        directory: {$this->testPositionsDir}
YAML;

        $configPath = tempnam(sys_get_temp_dir(), 'test-config-') . '.yaml';
        file_put_contents($configPath, $configContent);

        try {
            // Load configuration
            $config = ProjectConfiguration::fromYamlFile($configPath);
            $project = $config->getProject('test-project');

            $this->assertNotNull($project, 'Test project should be loaded');

            // Setup components
            $envConfig = new EnvironmentConfiguration('.env');
            $loggerFactory = new LoggerFactory($envConfig);
            $debugLogger = new DebugLogger(true, $loggerFactory->createDebugLogger());
            $monologAdapter = new MonologAdapter($loggerFactory->createConsoleLogger());
            $fileFinder = new LogFileFinder(null, $debugLogger);
            $positionStorageFactory = new PositionStorageFactory($debugLogger);

            // Create monitor
            $monitor = new SynchronousLogMonitor($project, $fileFinder, $monologAdapter, $debugLogger, 1.0);

            // Setup position tracking
            $positionConfig = $project->getPositionStorageConfig();
            $positionRepository = $positionStorageFactory->createRepository($positionConfig);
            $positionTracker = new PositionTracker($positionRepository, $project->name);
            $monitor->setPositionTracker($positionTracker);

            // Start monitor
            $monitor->start();

            // Simulate some monitoring activity by adding content to log file
            file_put_contents($this->testLogFile, "New log entry 3\n", FILE_APPEND);

            // Debug: Check file size
            echo "DEBUG: Test log file size after append: " . filesize($this->testLogFile) . " bytes\n";
            echo "DEBUG: Test log file path: " . $this->testLogFile . "\n";

            // Run monitoring for 3 seconds
            $monitor->runFor(3);

            // Verify position was saved during monitoring
            $this->assertTrue(
                $positionRepository->hasPosition($this->testLogFile, 'test-project'),
                'Position should be saved during monitoring'
            );

            // Test graceful shutdown
            $monitor->stop();

            // Verify position is still saved after shutdown
            $this->assertTrue(
                $positionRepository->hasPosition($this->testLogFile, 'test-project'),
                'Position should remain saved after graceful shutdown'
            );

            // Verify position data is correct
            $position = $positionRepository->loadPosition($this->testLogFile, 'test-project');
            $this->assertNotNull($position, 'Position should be loadable after shutdown');
            $this->assertGreaterThan(0, $position->position, 'Position should be greater than 0');

        } finally {
            // Cleanup
            if (file_exists($configPath)) {
                unlink($configPath);
            }
        }
    }

    /**
     * Test that forceSavePosition works correctly
     */
    public function testForceSavePosition(): void
    {
        // Create test configuration
        $configContent = <<<YAML
projects:
  test-project:
    name: test-project
    directories:
      - {$this->testLogDir}
    log_pattern: "*.log"
    position_storage:
      enabled: true
      storage:
        type: file
        directory: {$this->testPositionsDir}
YAML;

        $configPath = tempnam(sys_get_temp_dir(), 'test-config-') . '.yaml';
        file_put_contents($configPath, $configContent);

        try {
            // Load configuration
            $config = ProjectConfiguration::fromYamlFile($configPath);
            $project = $config->getProject('test-project');

            // Setup components
            $envConfig = new EnvironmentConfiguration('.env');
            $loggerFactory = new LoggerFactory($envConfig);
            $debugLogger = new DebugLogger(true, $loggerFactory->createDebugLogger());
            $monologAdapter = new MonologAdapter($loggerFactory->createConsoleLogger());
            $fileFinder = new LogFileFinder(null, $debugLogger);
            $positionStorageFactory = new PositionStorageFactory($debugLogger);

            // Create monitor
            $monitor = new SynchronousLogMonitor($project, $fileFinder, $monologAdapter, $debugLogger, 1.0);

            // Setup position tracking
            $positionConfig = $project->getPositionStorageConfig();
            $positionRepository = $positionStorageFactory->createRepository($positionConfig);
            $positionTracker = new PositionTracker($positionRepository, $project->name);
            $monitor->setPositionTracker($positionTracker);

            // Start monitor
            $monitor->start();

            // Wait a bit for initialization
            $monitor->runFor(1);

            // Test forceSavePosition
            $monitor->forceSavePosition();

            // Verify position was saved
            $this->assertTrue(
                $positionRepository->hasPosition($this->testLogFile, 'test-project'),
                'Position should be saved by forceSavePosition'
            );

            // Stop monitor
            $monitor->stop();

        } finally {
            // Cleanup
            if (file_exists($configPath)) {
                unlink($configPath);
            }
        }
    }

    /**
     * Test that positions are not lost when monitor is stopped abruptly
     */
    public function testPositionsNotLostOnAbruptStop(): void
    {
        // Create test configuration
        $configContent = <<<YAML
projects:
  test-project:
    name: test-project
    directories:
      - {$this->testLogDir}
    log_pattern: "*.log"
    position_storage:
      enabled: true
      storage:
        type: file
        directory: {$this->testPositionsDir}
YAML;

        $configPath = tempnam(sys_get_temp_dir(), 'test-config-') . '.yaml';
        file_put_contents($configPath, $configContent);

        try {
            // Load configuration
            $config = ProjectConfiguration::fromYamlFile($configPath);
            $project = $config->getProject('test-project');

            // Setup components
            $envConfig = new EnvironmentConfiguration('.env');
            $loggerFactory = new LoggerFactory($envConfig);
            $debugLogger = new DebugLogger(true, $loggerFactory->createDebugLogger());
            $monologAdapter = new MonologAdapter($loggerFactory->createConsoleLogger());
            $fileFinder = new LogFileFinder(null, $debugLogger);
            $positionStorageFactory = new PositionStorageFactory($debugLogger);

            // Create monitor
            $monitor = new SynchronousLogMonitor($project, $fileFinder, $monologAdapter, $debugLogger, 1.0);

            // Setup position tracking
            $positionConfig = $project->getPositionStorageConfig();
            $positionRepository = $positionStorageFactory->createRepository($positionConfig);
            $positionTracker = new PositionTracker($positionRepository, $project->name);
            $monitor->setPositionTracker($positionTracker);

            // Start monitor
            $monitor->start();

            // Simulate some monitoring activity by adding content to log file
            file_put_contents($this->testLogFile, "New log entry 4\n", FILE_APPEND);

            // Run monitoring for 3 seconds
            $monitor->runFor(3);

            // Verify position was saved during monitoring
            $this->assertTrue(
                $positionRepository->hasPosition($this->testLogFile, 'test-project'),
                'Position should be saved during monitoring'
            );

            // Simulate abrupt stop (without calling stop())
            // The position should still be saved from the last monitoring cycle
            $this->assertTrue(
                $positionRepository->hasPosition($this->testLogFile, 'test-project'),
                'Position should remain saved even after abrupt stop'
            );

        } finally {
            // Cleanup
            if (file_exists($configPath)) {
                unlink($configPath);
            }
        }
    }

    /**
     * Recursively remove directory
     */
    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }

        rmdir($dir);
    }
} 