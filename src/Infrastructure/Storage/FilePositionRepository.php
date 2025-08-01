<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Domain\Model\FilePosition;
use App\Domain\Repository\PositionRepository;
use App\Infrastructure\Logging\DebugLogger;

/**
 * File-based implementation of PositionRepository
 */
final class FilePositionRepository implements PositionRepository
{
    private string $storageDirectory;
    private DebugLogger $debugLogger;

    public function __construct(string $storageDirectory, ?DebugLogger $debugLogger = null)
    {
        $this->storageDirectory = rtrim($storageDirectory, '/');
        $this->debugLogger = $debugLogger ?? new DebugLogger();
        
        // Ensure storage directory exists
        if (!is_dir($this->storageDirectory)) {
            mkdir($this->storageDirectory, 0755, true);
        }
    }

    public function savePosition(FilePosition $position): void
    {
        $filename = $this->getPositionFilename($position->filePath, $position->projectName);
        $filePath = $this->storageDirectory . '/' . $filename;
        
        try {
            $data = $position->toArray();
            $jsonData = json_encode($data, JSON_PRETTY_PRINT);
            
            if ($jsonData === false) {
                throw new \RuntimeException('Failed to encode position data to JSON');
            }
            
            $result = file_put_contents($filePath, $jsonData);
            
            if ($result === false) {
                throw new \RuntimeException("Failed to write position file: {$filePath}");
            }
            
            $this->debugLogger->success("Saved position for file: $position->filePath, Position: $position->position");
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to save position: " . $e->getMessage());
            throw $e;
        }
    }

    public function loadPosition(string $logFile, string $projectName): ?FilePosition
    {
        $filename = $this->getPositionFilename($logFile, $projectName);
        $storagePath = $this->storageDirectory . '/' . $filename;

        if (!file_exists($storagePath)) {
            $this->debugLogger->warning("Position FILE $storagePath file does not exist");
            return null;
        }
        
        try {
            $jsonData = file_get_contents(filename: $storagePath);
            
            if ($jsonData === false) {
                $this->debugLogger->error("Failed to read position file");
                return null;
            }
            
            $data = json_decode($jsonData, true);
            
            if (!is_array($data)) {
                $this->debugLogger->error("Failed to decode position data from JSON");
                return null;
            }
            
            $position = FilePosition::fromArray($data);
            
            $this->debugLogger->success("Position in $storagePath loaded successfully: {$position->position}");
            
            return $position;
        } catch (\Exception $e) {
            $this->debugLogger->error("Failed to load position: " . $e->getMessage());
            return null;
        }
    }

    public function loadPositionsForProject(string $projectName): array
    {
        $positions = [];
        $pattern = $this->storageDirectory . '/' . $this->getProjectPattern($projectName);
        
        $files = glob($pattern);
        
        if ($files === false) {
            $this->debugLogger->warning("Failed to find position files for project");
            return [];
        }
        
        foreach ($files as $file) {
            try {
                $jsonData = file_get_contents($file);
                
                if ($jsonData === false) {
                    $this->debugLogger->warning("Failed to read position file: {$file}");
                    continue;
                }
                
                $data = json_decode($jsonData, true);
                
                if (!is_array($data)) {
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
        
        return $positions;
    }

    public function deletePosition(string $filePath, string $projectName): void
    {
        $filename = $this->getPositionFilename($filePath, $projectName);
        $filePath = $this->storageDirectory . '/' . $filename;
        
        $this->debugLogger->position("Deleting position for file: {$filePath}");
        
        if (file_exists($filePath)) {
            $result = unlink($filePath);
            
            if ($result) {
                $this->debugLogger->success("Position deleted successfully");
            } else {
                $this->debugLogger->error("Failed to delete position file");
            }
        }
    }

    public function deletePositionsForProject(string $projectName): void
    {
        $this->debugLogger->position("Deleting all positions for project: {$projectName}");
        
        $pattern = $this->storageDirectory . '/' . $this->getProjectPattern($projectName);
        $files = glob($pattern);
        
        if ($files === false) {
            $this->debugLogger->warning("Failed to find position files for project");
            return;
        }
        
        $deletedCount = 0;
        foreach ($files as $file) {
            if (unlink($file)) {
                $deletedCount++;
            } else {
                $this->debugLogger->warning("Failed to delete position file: {$file}");
            }
        }
        
        $this->debugLogger->stats("Deleted {$deletedCount} position files");
    }

    public function hasPosition(string $filePath, string $projectName): bool
    {
        $filename = $this->getPositionFilename($filePath, $projectName);
        $storagePath = $this->storageDirectory . '/' . $filename;
        
        return file_exists($storagePath);
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