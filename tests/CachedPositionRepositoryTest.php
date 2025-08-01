<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\Model\FilePosition;
use App\Domain\Repository\PositionRepository;
use App\Infrastructure\Logging\DebugLogger;
use App\Infrastructure\Storage\CachedPositionRepository;
use App\Infrastructure\Storage\FilePositionRepository;
use PHPUnit\Framework\TestCase;
use DateTimeImmutable;

/**
 * Test for CachedPositionRepository
 */
class CachedPositionRepositoryTest extends TestCase
{
    private string $tempDir;
    private PositionRepository $fileRepository;
    private CachedPositionRepository $cachedRepository;
    private DebugLogger $debugLogger;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/cached-position-test-' . uniqid();
        mkdir($this->tempDir, 0755, true);
        
        $this->debugLogger = new DebugLogger();
        $this->fileRepository = new FilePositionRepository($this->tempDir, $this->debugLogger);
        $this->cachedRepository = new CachedPositionRepository($this->fileRepository, 1, $this->debugLogger); // 1 second interval for testing
    }

    protected function tearDown(): void
    {
        // Clean up temp directory
        if (is_dir($this->tempDir)) {
            $files = glob($this->tempDir . '/*');
            foreach ($files as $file) {
                unlink($file);
            }
            rmdir($this->tempDir);
        }
    }

    public function testSavePositionStoresInMemory(): void
    {
        $position = new FilePosition(
            filePath: '/test/file.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position);

        // Position should be in memory cache
        $this->assertEquals(1, $this->cachedRepository->getCacheSize());
        $this->assertEquals(1, $this->cachedRepository->getDirtyCount());

        // Position should not be in file yet (unless interval has passed)
        $loadedPosition = $this->fileRepository->loadPosition('/test/file.log', 'test-project');
        $this->assertNull($loadedPosition);
    }

    public function testLoadPositionFromCache(): void
    {
        $position = new FilePosition(
            filePath: '/test/file.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position);

        // Load from cache
        $loadedPosition = $this->cachedRepository->loadPosition('/test/file.log', 'test-project');
        
        $this->assertNotNull($loadedPosition);
        $this->assertEquals($position->filePath, $loadedPosition->filePath);
        $this->assertEquals($position->position, $loadedPosition->position);
        $this->assertEquals($position->projectName, $loadedPosition->projectName);
    }

    public function testLoadPositionFromFile(): void
    {
        $position = new FilePosition(
            filePath: '/test/file.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        // Save directly to file repository
        $this->fileRepository->savePosition($position);

        // Load from cached repository (should fall back to file)
        $loadedPosition = $this->cachedRepository->loadPosition('/test/file.log', 'test-project');
        
        $this->assertNotNull($loadedPosition);
        $this->assertEquals($position->filePath, $loadedPosition->filePath);
        $this->assertEquals($position->position, $loadedPosition->position);
        $this->assertEquals($position->projectName, $loadedPosition->projectName);

        // Should now be cached
        $this->assertEquals(1, $this->cachedRepository->getCacheSize());
    }

    public function testForceSavePersistsToFile(): void
    {
        $position = new FilePosition(
            filePath: '/test/file.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position);

        // Force save
        $this->cachedRepository->forceSave();

        // Position should now be in file
        $loadedPosition = $this->fileRepository->loadPosition('/test/file.log', 'test-project');
        $this->assertNotNull($loadedPosition);
        $this->assertEquals($position->filePath, $loadedPosition->filePath);
        $this->assertEquals($position->position, $loadedPosition->position);

        // Should no longer be dirty
        $this->assertEquals(0, $this->cachedRepository->getDirtyCount());
    }

    public function testSaveIntervalTriggersPersist(): void
    {
        $position = new FilePosition(
            filePath: '/test/file.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position);

        // Wait for save interval (1 second)
        sleep(2);

        // Save another position to trigger interval check
        $position2 = new FilePosition(
            filePath: '/test/file2.log',
            position: 200,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position2);

        // Both positions should now be in file
        $loadedPosition1 = $this->fileRepository->loadPosition('/test/file.log', 'test-project');
        $loadedPosition2 = $this->fileRepository->loadPosition('/test/file2.log', 'test-project');
        
        $this->assertNotNull($loadedPosition1);
        $this->assertNotNull($loadedPosition2);
    }

    public function testDeletePositionRemovesFromCache(): void
    {
        $position = new FilePosition(
            filePath: '/test/file.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position);
        $this->assertEquals(1, $this->cachedRepository->getCacheSize());

        $this->cachedRepository->deletePosition('/test/file.log', 'test-project');
        $this->assertEquals(0, $this->cachedRepository->getCacheSize());
        $this->assertEquals(0, $this->cachedRepository->getDirtyCount());
    }

    public function testLoadPositionsForProject(): void
    {
        $position1 = new FilePosition(
            filePath: '/test/file1.log',
            position: 100,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $position2 = new FilePosition(
            filePath: '/test/file2.log',
            position: 200,
            lastUpdated: new DateTimeImmutable(),
            projectName: 'test-project'
        );

        $this->cachedRepository->savePosition($position1);
        $this->cachedRepository->savePosition($position2);

        $positions = $this->cachedRepository->loadPositionsForProject('test-project');
        $this->assertCount(2, $positions);
    }

    public function testConfigurableSaveInterval(): void
    {
        $cachedRepo = new CachedPositionRepository($this->fileRepository, 30, $this->debugLogger);
        $this->assertEquals(30, $cachedRepo->getSaveIntervalSeconds());

        $cachedRepo->setSaveIntervalSeconds(60);
        $this->assertEquals(60, $cachedRepo->getSaveIntervalSeconds());
    }
} 