<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Domain\Model\FilePosition;
use App\Infrastructure\Logging\DebugLogger;
use App\Infrastructure\Storage\FilePositionRepository;
use App\Infrastructure\Storage\CachedPositionRepository;
use DateTimeImmutable;

/**
 * Demo script for CachedPositionRepository
 * 
 * This demonstrates the new in-memory caching with periodic file writes.
 * Positions are stored in memory and only written to disk every X seconds.
 */

echo "🦊 Cached Position Repository Demo\n";
echo "================================\n\n";

// Create debug logger
$debugLogger = new DebugLogger();

// Create temp directory for demo
$tempDir = sys_get_temp_dir() . '/cached-demo-' . uniqid();
mkdir($tempDir, 0755, true);

echo "📁 Using temp directory: {$tempDir}\n\n";

// Create repositories
$fileRepository = new FilePositionRepository($tempDir, $debugLogger);
$cachedRepository = new CachedPositionRepository($fileRepository, 3, $debugLogger); // 3 second interval

echo "⚙️  Cached repository configured with 3-second save interval\n\n";

// Create test positions
$positions = [
    new FilePosition('/var/log/app1.log', 100, new DateTimeImmutable(), 'demo-project'),
    new FilePosition('/var/log/app2.log', 200, new DateTimeImmutable(), 'demo-project'),
    new FilePosition('/var/log/app3.log', 300, new DateTimeImmutable(), 'demo-project'),
];

echo "💾 Saving positions to cached repository...\n";
foreach ($positions as $position) {
    $cachedRepository->savePosition($position);
    echo "  - Saved position for {$position->filePath} (pos: {$position->position})\n";
}

echo "\n📊 Cache status:\n";
echo "  - Cached positions: {$cachedRepository->getCacheSize()}\n";
echo "  - Dirty positions: {$cachedRepository->getDirtyCount()}\n";

// Check if positions are in file (should not be yet)
echo "\n🔍 Checking if positions are in file (should not be yet)...\n";
foreach ($positions as $position) {
    $filePosition = $fileRepository->loadPosition($position->filePath, $position->projectName);
    $status = $filePosition !== null ? '✅ Found' : '❌ Not found';
    echo "  - {$position->filePath}: {$status}\n";
}

echo "\n⏰ Waiting 4 seconds for save interval to trigger...\n";
sleep(4);

// Save another position to trigger the interval check
$newPosition = new FilePosition('/var/log/app4.log', 400, new DateTimeImmutable(), 'demo-project');
$cachedRepository->savePosition($newPosition);

echo "💾 Saved additional position to trigger interval check\n";

echo "\n🔍 Checking if positions are now in file...\n";
foreach (array_merge($positions, [$newPosition]) as $position) {
    $filePosition = $fileRepository->loadPosition($position->filePath, $position->projectName);
    $status = $filePosition !== null ? '✅ Found' : '❌ Not found';
    echo "  - {$position->filePath}: {$status}\n";
}

echo "\n📊 Final cache status:\n";
echo "  - Cached positions: {$cachedRepository->getCacheSize()}\n";
echo "  - Dirty positions: {$cachedRepository->getDirtyCount()}\n";

// Test force save
echo "\n🔄 Testing force save...\n";
$cachedRepository->forceSave();

echo "📊 Cache status after force save:\n";
echo "  - Cached positions: {$cachedRepository->getCacheSize()}\n";
echo "  - Dirty positions: {$cachedRepository->getDirtyCount()}\n";

// Test loading from cache
echo "\n📖 Testing load from cache...\n";
$loadedPosition = $cachedRepository->loadPosition('/var/log/app1.log', 'demo-project');
if ($loadedPosition !== null) {
    echo "  ✅ Successfully loaded from cache: {$loadedPosition->filePath} (pos: {$loadedPosition->position})\n";
} else {
    echo "  ❌ Failed to load from cache\n";
}

// Clean up
echo "\n🧹 Cleaning up...\n";
$files = glob($tempDir . '/*');
foreach ($files as $file) {
    unlink($file);
}
rmdir($tempDir);

echo "✅ Demo completed successfully!\n";
echo "\n🎯 Key benefits of cached repository:\n";
echo "  - Positions stored in memory for fast access\n";
echo "  - Periodic file writes reduce I/O overhead\n";
echo "  - Configurable save intervals per project\n";
echo "  - Graceful handling of file write failures\n";
echo "  - Automatic fallback to file storage\n"; 