<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\Model\FilePosition;
use App\Domain\Model\PositionTracker;
use App\Infrastructure\Storage\FilePositionRepository;
use App\Infrastructure\Logging\DebugLogger;
use PHPUnit\Framework\TestCase;

/**
 * Test for position tracking functionality
 */
class PositionTrackingTest extends TestCase
{
    private string $testStorageDir;
    private FilePositionRepository $repository;
    private PositionTracker $tracker;
    private DebugLogger $debugLogger;

    protected function setUp(): void
    {
        $this->testStorageDir = sys_get_temp_dir() . '/position-test-' . uniqid();
        $this->debugLogger = new DebugLogger();
        $this->repository = new FilePositionRepository($this->testStorageDir, $this->debugLogger);
        $this->tracker = new PositionTracker($this->repository, 'test-project');
    }

    protected function tearDown(): void
    {
        // Clean up test files
        if (is_dir($this->testStorageDir)) {
            $files = glob($this->testStorageDir . '/*');
            foreach ($files as $file) {
                unlink($file);
            }
            rmdir($this->testStorageDir);
        }
    }

    public function testSaveAndLoadPosition(): void
    {
        $filePath = '/var/log/test.log';
        $position = 1024;

        // Save position
        $this->tracker->updatePosition($filePath, $position);

        // Load position
        $loadedPosition = $this->tracker->getPosition($filePath);

        $this->assertEquals($position, $loadedPosition);
    }

    public function testLoadNonExistentPosition(): void
    {
        $filePath = '/var/log/nonexistent.log';
        $position = $this->tracker->getPosition($filePath);

        $this->assertEquals(0, $position);
    }

    public function testUpdatePosition(): void
    {
        $filePath = '/var/log/test.log';
        $initialPosition = 1024;
        $newPosition = 2048;

        // Save initial position
        $this->tracker->updatePosition($filePath, $initialPosition);

        // Update position
        $this->tracker->updatePosition($filePath, $newPosition);

        // Load position
        $loadedPosition = $this->tracker->getPosition($filePath);

        $this->assertEquals($newPosition, $loadedPosition);
    }

    public function testLoadAllPositions(): void
    {
        $file1 = '/var/log/test1.log';
        $file2 = '/var/log/test2.log';

        // Save positions
        $this->tracker->updatePosition($file1, 1024);
        $this->tracker->updatePosition($file2, 2048);

        // Load all positions
        $positions = $this->tracker->loadAllPositions();

        $this->assertCount(2, $positions);

        $filePaths = array_map(fn(FilePosition $p) => $p->filePath, $positions);
        $this->assertContains($file1, $filePaths);
        $this->assertContains($file2, $filePaths);
    }

    public function testDeletePosition(): void
    {
        $filePath = '/var/log/test.log';
        $position = 1024;

        // Save position
        $this->tracker->updatePosition($filePath, $position);

        // Verify position exists
        $this->assertTrue($this->tracker->hasPosition($filePath));

        // Delete position
        $this->tracker->deletePosition($filePath);

        // Verify position is deleted
        $this->assertFalse($this->tracker->hasPosition($filePath));
        $this->assertEquals(0, $this->tracker->getPosition($filePath));
    }

    public function testFilePositionValueObject(): void
    {
        $filePath = '/var/log/test.log';
        $position = 1024;
        $projectName = 'test-project';

        $filePosition = new FilePosition($filePath, $position, new \DateTimeImmutable(), $projectName);

        $this->assertEquals($filePath, $filePosition->filePath);
        $this->assertEquals($position, $filePosition->position);
        $this->assertEquals($projectName, $filePosition->projectName);
    }

    public function testFilePositionValidation(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new FilePosition('', 0, new \DateTimeImmutable(), 'test');
    }

    public function testFilePositionNegativePosition(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new FilePosition('/var/log/test.log', -1, new \DateTimeImmutable(), 'test');
    }

    public function testFilePositionEmptyProjectName(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new FilePosition('/var/log/test.log', 0, new \DateTimeImmutable(), '');
    }
} 