<?php

declare(strict_types=1);

namespace App\Domain\Repository;

use App\Domain\Model\FilePosition;

/**
 * Repository interface for position tracking storage
 */
interface PositionRepository
{
    /**
     * Save a file position
     */
    public function savePosition(FilePosition $position): void;

    /**
     * Load position for a specific file and project
     */
    public function loadPosition(string $logFile, string $projectName): ?FilePosition;

    /**
     * Load all positions for a project
     * 
     * @return array<FilePosition>
     */
    public function loadPositionsForProject(string $projectName): array;

    /**
     * Delete position for a specific file and project
     */
    public function deletePosition(string $filePath, string $projectName): void;

    /**
     * Delete all positions for a project
     */
    public function deletePositionsForProject(string $projectName): void;

    /**
     * Check if position exists for a file and project
     */
    public function hasPosition(string $filePath, string $projectName): bool;
} 