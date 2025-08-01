<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Domain\Repository\PositionRepository;
use App\Infrastructure\Logging\DebugLogger;

/**
 * Factory for creating position storage implementations
 */
final class PositionStorageFactory
{
    public function __construct(
        private DebugLogger $debugLogger
    ) {
    }

    /**
     * Create position repository based on configuration
     * 
     * @param array<string, mixed> $config
     */
    public function createRepository(array $config): PositionRepository
    {
        $type = $config['type'] ?? 'file';
        $storagePath = $config['path'] ?? 'var/positions';
        $saveInterval = $config['save_interval_seconds'] ?? 30;
        
        if (!is_string($type)) {
            throw new \InvalidArgumentException('Position storage type must be a string');
        }
        
        if (!is_string($storagePath)) {
            throw new \InvalidArgumentException('Position storage path must be a string');
        }
        
        if (!is_int($saveInterval) || $saveInterval < 1) {
            throw new \InvalidArgumentException('Save interval must be a positive integer');
        }
        
        $this->debugLogger->config("Creating position repository");
        $this->debugLogger->config("Type: {$type}");
        $this->debugLogger->config("Storage path: {$storagePath}");
        $this->debugLogger->config("Save interval: {$saveInterval}s");
        
        return match ($type) {
            'file' => $this->createFileRepository($storagePath),
            'async-file' => $this->createAsyncFileRepository($storagePath),
            'cached' => $this->createCachedRepository($storagePath, $saveInterval),
            default => throw new \InvalidArgumentException("Unsupported position storage type: {$type}")
        };
    }

    /**
     * Create file-based position repository
     */
    private function createFileRepository(string $storagePath): FilePositionRepository
    {
        $this->debugLogger->config("Creating file-based position repository");
        $this->debugLogger->config("Storage directory: {$storagePath}");
        
        return new FilePositionRepository($storagePath, $this->debugLogger);
    }

    /**
     * Create async file-based position repository
     */
    private function createAsyncFileRepository(string $storagePath): AsyncFilePositionRepository
    {
        $this->debugLogger->config("Creating async file-based position repository");
        $this->debugLogger->config("Storage directory: {$storagePath}");
        
        return new AsyncFilePositionRepository($storagePath, null, $this->debugLogger);
    }

    /**
     * Create cached position repository with periodic file writes
     */
    private function createCachedRepository(string $storagePath, int $saveInterval): CachedPositionRepository
    {
        $this->debugLogger->config("Creating cached position repository");
        $this->debugLogger->config("Storage directory: {$storagePath}");
        $this->debugLogger->config("Save interval: {$saveInterval}s");
        
        $fileRepository = new AsyncFilePositionRepository($storagePath, null, $this->debugLogger);
        
        return new CachedPositionRepository($fileRepository, $saveInterval, $this->debugLogger);
    }

    /**
     * Get default configuration for position storage
     * 
     * @return array<string, mixed>
     */
    public static function getDefaultConfig(): array
    {
        return [
            'type' => 'cached',
            'path' => 'var/positions',
            'save_interval_seconds' => 30
        ];
    }
} 