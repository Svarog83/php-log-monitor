<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Domain\Model\FilePosition;
use App\Domain\Repository\PositionRepository;
use App\Infrastructure\Logging\DebugLogger;
use Amp\File\File;
use Amp\File\Filesystem;
use Amp\Promise;
use function Amp\File\filesystem;

/**
 * Async implementation of FilePositionRepository using amphp/file
 */
final class AsyncFilePositionRepository implements PositionRepository
{
    private Filesystem $filesystem;
    private string $storageDirectory;
    private DebugLogger $debugLogger;

    public function __construct(string $storageDirectory, ?Filesystem $filesystem = null, ?DebugLogger $debugLogger = null)
    {
        $this->storageDirectory = rtrim($storageDirectory, '/');
        $this->filesystem = $filesystem ?? filesystem();
        $this->debugLogger = $debugLogger ?? new DebugLogger();
        
        // Ensure storage directory exists (async)
        $this->ensureStorageDirectory();
    }

    public function savePosition(FilePosition $position): void
    {
        $filename = $this->getPositionFilename($position->filePath, $position->projectName);
        $filePath = $this->storageDirectory . '/' . $filename;
        
        $this->debugLogger->position("Saving position for file: {$position->filePath}");
        $this->debugLogger->position("Position: {$position->position}");
        $this->debugLogger->position("Storage file: {$filePath}");
        
        try {
            $data = $position->toArray();
            $jsonData = json_encode($data, JSON_PRETTY_PRINT);
            
            if ($jsonData === false) {
                throw new \RuntimeException('Failed to encode position data to JSON');
            }
            
            // Async file write
            $this->filesystem->write($filePath, $jsonData);
            
            $this->debugLogger->success("Position saved successfully");
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to save position: " . $e->getMessage());
            throw $e;
        }
    }

    public function loadPosition(string $filePath, string $projectName): ?FilePosition
    {
        $filename = $this->getPositionFilename($filePath, $projectName);
        $storagePath = $this->storageDirectory . '/' . $filename;
        
        $this->debugLogger->position("Loading position for file: {$filePath}");
        $this->debugLogger->position("Storage file: {$storagePath}");
        
        try {
            if (!$this->filesystem->exists($storagePath)) {
                $this->debugLogger->warning("Position file does not exist");
                return null;
            }
            
            $jsonData = $this->filesystem->read($storagePath);
            
            if ($jsonData === '') {
                $this->debugLogger->error("Failed to read position file");
                return null;
            }
            
            $data = json_decode($jsonData, true);
            
            if ($data === null || !is_array($data)) {
                $this->debugLogger->error("Failed to decode position data from JSON");
                return null;
            }
            
            $position = FilePosition::fromArray($data);
            
            $this->debugLogger->success("Position loaded successfully: {$position->position}");
            
            return $position;
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to load position: " . $e->getMessage());
            return null;
        }
    }

    public function loadPositionsForProject(string $projectName): array
    {
        $this->debugLogger->position("Loading all positions for project: {$projectName}");
        
        $positions = [];
        $pattern = $this->storageDirectory . '/' . $this->getProjectPattern($projectName);
        
        try {
            $files = $this->filesystem->listFiles($this->storageDirectory);
            
            if (empty($files)) {
                $this->debugLogger->warning("Failed to list position files for project");
                return [];
            }
            
            $projectPattern = $this->getProjectPattern($projectName);
            $projectPattern = str_replace('*', '.*', $projectPattern);
            $projectPattern = '/^' . $projectPattern . '$/';
            
            $matchingFiles = array_filter($files, fn(string $file): bool => (bool) preg_match($projectPattern, $file));
            
            $this->debugLogger->stats("Found " . count($matchingFiles) . " position files for project");
            
            foreach ($matchingFiles as $file) {
                try {
                    $filePath = $this->storageDirectory . '/' . $file;
                    $jsonData = $this->filesystem->read($filePath);
                    
                    if ($jsonData === '') {
                        $this->debugLogger->warning("Failed to read position file: {$file}");
                        continue;
                    }
                    
                    $data = json_decode($jsonData, true);
                    
                    if ($data === null || !is_array($data)) {
                        $this->debugLogger->warning("Failed to decode position data from: {$file}");
                        continue;
                    }
                    
                    $position = FilePosition::fromArray($data);
                    $positions[] = $position;
                    
                    $this->debugLogger->data("Loaded position for: {$position->filePath} (pos: {$position->position})");
                } catch (\Exception $e) {
                    $this->debugLogger->warning("Failed to load position from {$file}: " . $e->getMessage());
                }
            }
            
            $this->debugLogger->stats("Successfully loaded " . count($positions) . " positions");
            
            return $positions;
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to load positions for project: " . $e->getMessage());
            return [];
        }
    }

    public function deletePosition(string $filePath, string $projectName): void
    {
        $filename = $this->getPositionFilename($filePath, $projectName);
        $filePath = $this->storageDirectory . '/' . $filename;
        
        $this->debugLogger->position("Deleting position for file: {$filePath}");
        
        try {
            if ($this->filesystem->exists($filePath)) {
                $this->filesystem->deleteFile($filePath);
                $this->debugLogger->success("Position deleted successfully");
            } else {
                $this->debugLogger->warning("Position file does not exist");
            }
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to delete position file: " . $e->getMessage());
        }
    }

    public function deletePositionsForProject(string $projectName): void
    {
        $this->debugLogger->position("Deleting all positions for project: {$projectName}");
        
        try {
            $files = $this->filesystem->listFiles($this->storageDirectory);
            
            if (empty($files)) {
                $this->debugLogger->warning("Failed to list position files for project");
                return;
            }
            
            $projectPattern = $this->getProjectPattern($projectName);
            $projectPattern = str_replace('*', '.*', $projectPattern);
            $projectPattern = '/^' . $projectPattern . '$/';
            
            $matchingFiles = array_filter($files, fn(string $file): bool => (bool) preg_match($projectPattern, $file));
            
            $deletedCount = 0;
            foreach ($matchingFiles as $file) {
                try {
                    $filePath = $this->storageDirectory . '/' . $file;
                    $this->filesystem->deleteFile($filePath);
                    $deletedCount++;
                } catch (\Exception $e) {
                    $this->debugLogger->warning("Failed to delete position file: {$file}");
                }
            }
            
            $this->debugLogger->stats("Deleted {$deletedCount} position files");
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to delete positions for project: " . $e->getMessage());
        }
    }

    public function hasPosition(string $filePath, string $projectName): bool
    {
        $filename = $this->getPositionFilename($filePath, $projectName);
        $storagePath = $this->storageDirectory . '/' . $filename;
        
        try {
            return $this->filesystem->exists($storagePath);
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to check position file existence: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Ensure storage directory exists
     */
    private function ensureStorageDirectory(): void
    {
        try {
            if (!$this->filesystem->exists($this->storageDirectory)) {
                $this->filesystem->createDirectoryRecursively($this->storageDirectory, 0755);
            }
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to create storage directory: " . $e->getMessage());
        }
    }

    /**
     * Generate filename for position storage
     */
    private function getPositionFilename(string $filePath, string $projectName): string
    {
        $hash = md5($filePath);
        return "{$projectName}_{$hash}.json";
    }

    /**
     * Generate pattern for finding project position files
     */
    private function getProjectPattern(string $projectName): string
    {
        return "{$projectName}_*.json";
    }
} 