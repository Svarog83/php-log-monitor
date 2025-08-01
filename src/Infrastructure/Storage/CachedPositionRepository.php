<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Domain\Model\FilePosition;
use App\Domain\Repository\PositionRepository;
use App\Infrastructure\Logging\DebugLogger;

/**
 * Cached implementation of PositionRepository with periodic file writes
 */
final class CachedPositionRepository implements PositionRepository
{
    private PositionRepository $fileRepository;
    private DebugLogger $debugLogger;
    private int $saveIntervalSeconds;
    private float|null $lastSaveTime = null;
    
    /**
     * @var array<string, FilePosition> In-memory cache of positions
     */
    private array $positionCache = [];
    
    /**
     * @var array<string, bool> Track which positions have been modified since last save
     */
    private array $dirtyPositions = [];

    public function __construct(
        PositionRepository $fileRepository,
        int $saveIntervalSeconds = 30,
        ?DebugLogger $debugLogger = null
    ) {
        $this->fileRepository = $fileRepository;
        $this->saveIntervalSeconds = $saveIntervalSeconds;
        $this->debugLogger = $debugLogger ?? new DebugLogger();
    }

    public function savePosition(FilePosition $position): void
    {
        $cacheKey = $this->getCacheKey($position->filePath, $position->projectName);
        
        $this->debugLogger->position("Caching position for file: $position->filePath, Position: $position->position");

        // Store in memory cache
        $this->positionCache[$cacheKey] = $position;
        $this->dirtyPositions[$cacheKey] = true;
        
        // Check if we need to persist to file
        $this->maybePersistToFile();
    }

    public function loadPosition(string $logFile, string $projectName): ?FilePosition
    {
        $cacheKey = $this->getCacheKey($logFile, $projectName);
        
        // First check memory cache
        if (isset($this->positionCache[$cacheKey])) {
            return $this->positionCache[$cacheKey];
        }
        
        // Fall back to file repository
        $this->debugLogger->position("Loading position from file for file: {$logFile}");
        $position = $this->fileRepository->loadPosition($logFile, $projectName);
        
        if ($position !== null) {
            // Cache the loaded position
            $this->positionCache[$cacheKey] = $position;
        }
        
        return $position;
    }

    public function loadPositionsForProject(string $projectName): array
    {
        // First, try to get from cache
        $cachedPositions = [];
        foreach ($this->positionCache as $position) {
            if ($position->isForProject($projectName)) {
                $cachedPositions[] = $position;
            }
        }
        
        if (!empty($cachedPositions)) {
            return $cachedPositions;
        }
        
        // Fall back to file repository
        $positions = $this->fileRepository->loadPositionsForProject($projectName);
        
        // Cache all loaded positions
        foreach ($positions as $position) {
            $cacheKey = $this->getCacheKey($position->filePath, $position->projectName);
            $this->positionCache[$cacheKey] = $position;
        }
        
        return $positions;
    }

    public function deletePosition(string $filePath, string $projectName): void
    {
        $cacheKey = $this->getCacheKey($filePath, $projectName);
        
        $this->debugLogger->position("Deleting position for file: {$filePath}");
        
        // Remove from cache
        unset($this->positionCache[$cacheKey]);
        unset($this->dirtyPositions[$cacheKey]);
        
        // Delete from file repository
        $this->fileRepository->deletePosition($filePath, $projectName);
    }

    public function deletePositionsForProject(string $projectName): void
    {
        $this->debugLogger->position("Deleting all positions for project: $projectName");
        
        // Remove from cache
        $keysToRemove = [];
        foreach ($this->positionCache as $cacheKey => $position) {
            if ($position->isForProject($projectName)) {
                $keysToRemove[] = $cacheKey;
            }
        }
        
        foreach ($keysToRemove as $cacheKey) {
            unset($this->positionCache[$cacheKey]);
            unset($this->dirtyPositions[$cacheKey]);
        }
        
        // Delete from file repository
        $this->fileRepository->deletePositionsForProject($projectName);
    }

    public function hasPosition(string $filePath, string $projectName): bool
    {
        $cacheKey = $this->getCacheKey($filePath, $projectName);
        
        // Check cache first
        if (isset($this->positionCache[$cacheKey])) {
            return true;
        }
        
        // Fall back to file repository
        return $this->fileRepository->hasPosition($filePath, $projectName);
    }

    /**
     * Force save all dirty positions to file
     */
    public function forceSave(): void
    {
        if (empty($this->dirtyPositions)) {
            return;
        }
        
        foreach ($this->dirtyPositions as $cacheKey => $isDirty) {
            if (!$isDirty) {
                continue;
            }
            
            $position = $this->positionCache[$cacheKey] ?? null;
            if ($position === null) {
                continue;
            }
            
            try {
                $this->fileRepository->savePosition($position);
                $this->dirtyPositions[$cacheKey] = false;
            } catch (\Exception $e) {
                $this->debugLogger->error("Failed to save position for {$position->filePath}: " . $e->getMessage());
                // Keep it dirty so we can retry later
            }
        }
        
        $this->lastSaveTime = null;
    }

    /**
     * Check if we need to persist positions to file based on time interval
     */
    private function maybePersistToFile(): void
    {
        if ($this->lastSaveTime === null) {
            $this->lastSaveTime = microtime(true);
            return;
        }
        $currentTime = microtime(true);
        $timeSinceLastSave = $currentTime - $this->lastSaveTime;
        
        if ($timeSinceLastSave >= $this->saveIntervalSeconds) {
            $this->debugLogger->position("Save interval reached ({$this->saveIntervalSeconds}s), persisting positions");
            $this->forceSave();
        }
    }

    /**
     * Generate cache key for a file and project
     */
    private function getCacheKey(string $filePath, string $projectName): string
    {
        return "{$projectName}:{$filePath}";
    }

    /**
     * Get the save interval in seconds
     */
    public function getSaveIntervalSeconds(): int
    {
        return $this->saveIntervalSeconds;
    }

    /**
     * Set the save interval in seconds
     */
    public function setSaveIntervalSeconds(int $seconds): void
    {
        $this->saveIntervalSeconds = $seconds;
    }

    /**
     * Get the number of cached positions
     */
    public function getCacheSize(): int
    {
        return count($this->positionCache);
    }

    /**
     * Get the number of dirty positions
     */
    public function getDirtyCount(): int
    {
        return count(array_filter($this->dirtyPositions));
    }
} 