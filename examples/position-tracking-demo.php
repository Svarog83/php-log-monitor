<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Domain\Model\FilePosition;
use App\Domain\Model\PositionTracker;
use App\Infrastructure\Storage\FilePositionRepository;
use App\Infrastructure\Logging\DebugLogger;

/**
 * Demonstration of position tracking functionality
 */
class PositionTrackingDemo
{
    private string $storageDir;
    private FilePositionRepository $repository;
    private PositionTracker $tracker;
    private DebugLogger $debugLogger;

    public function __construct()
    {
        $this->storageDir = __DIR__ . '/../var/positions-demo';
        $this->debugLogger = new DebugLogger(true);
        $this->repository = new FilePositionRepository($this->storageDir, $this->debugLogger);
        $this->tracker = new PositionTracker($this->repository, 'demo-project');
    }

    public function run(): void
    {
        echo "🦊 Position Tracking Demo\n";
        echo "========================\n\n";

        $this->demoBasicOperations();
        $this->demoPersistence();
        $this->demoValidation();
        
        echo "\n✅ Demo completed successfully!\n";
    }

    private function demoBasicOperations(): void
    {
        echo "1. Basic Position Operations\n";
        echo "----------------------------\n";

        $filePath = '/var/log/demo.log';
        $position = 1024;

        echo "Saving position {$position} for file: {$filePath}\n";
        $this->tracker->updatePosition($filePath, $position);

        $loadedPosition = $this->tracker->getPosition($filePath);
        echo "Loaded position: {$loadedPosition}\n";

        echo "✅ Position saved and loaded successfully\n\n";
    }

    private function demoPersistence(): void
    {
        echo "2. Position Persistence\n";
        echo "------------------------\n";

        $file1 = '/var/log/app1.log';
        $file2 = '/var/log/app2.log';

        echo "Saving positions for multiple files...\n";
        $this->tracker->updatePosition($file1, 2048);
        $this->tracker->updatePosition($file2, 4096);

        echo "Loading all positions...\n";
        $positions = $this->tracker->loadAllPositions();

        echo "Found " . count($positions) . " saved positions:\n";
        foreach ($positions as $position) {
            echo "  - {$position->filePath}: {$position->position} bytes\n";
        }

        echo "✅ Positions persisted successfully\n\n";
    }

    private function demoValidation(): void
    {
        echo "3. Position Validation\n";
        echo "----------------------\n";

        $filePath = '/var/log/test.log';
        $position = 512;

        // Create a FilePosition object
        $filePosition = new FilePosition(
            filePath: $filePath,
            position: $position,
            lastUpdated: new \DateTimeImmutable(),
            projectName: 'demo-project'
        );

        // Simulate a log file
        $logFile = new \App\Domain\Model\LogFile(
            path: $filePath,
            filename: 'test.log',
            lastModified: new \DateTimeImmutable(),
            size: 1024
        );

        $isValid = $this->tracker->isPositionValid($filePosition, $logFile);
        echo "Position validation result: " . ($isValid ? '✅ Valid' : '❌ Invalid') . "\n";

        echo "✅ Validation demo completed\n\n";
    }
}

// Run the demo
$demo = new PositionTrackingDemo();
$demo->run(); 