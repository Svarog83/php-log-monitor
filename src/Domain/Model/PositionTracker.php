<?php

declare(strict_types=1);

namespace App\Domain\Model;

use App\Domain\Repository\PositionRepository;
use DateTimeImmutable;

/**
 * Domain service for managing file positions
 */
final readonly class PositionTracker
{
    public function __construct(
        private PositionRepository $positionRepository,
        private string $projectName
    ) {
    }

    /**
     * Get the current position for a file, or 0 if not found
     */
    public function getPosition(string $filePath): int
    {
        $position = $this->positionRepository->loadPosition($filePath, $this->projectName);
        return $position?->position ?? 0;
    }

    /**
     * Update the position for a file
     */
    public function updatePosition(string $filePath, int $newPosition): void
    {
        $position = new FilePosition(
            filePath: $filePath,
            position: $newPosition,
            lastUpdated: new DateTimeImmutable(),
            projectName: $this->projectName
        );

        $this->positionRepository->savePosition($position);
    }

    /**
     * Load all positions for the current project
     * 
     * @return array<FilePosition>
     */
    public function loadAllPositions(): array
    {
        return $this->positionRepository->loadPositionsForProject($this->projectName);
    }

    /**
     * Check if a position exists for a file
     */
    public function hasPosition(string $filePath): bool
    {
        return $this->positionRepository->hasPosition($filePath, $this->projectName);
    }

    /**
     * Delete position for a file
     */
    public function deletePosition(string $filePath): void
    {
        $this->positionRepository->deletePosition($filePath, $this->projectName);
    }

    /**
     * Delete all positions for the current project
     */
    public function deleteAllPositions(): void
    {
        $this->positionRepository->deletePositionsForProject($this->projectName);
    }

    /**
     * Force save any pending positions (for cached repositories)
     */
    public function forceSave(): void
    {
        // Check if the repository has a forceSave method (for cached repositories)
        if (method_exists($this->positionRepository, 'forceSave')) {
            $this->positionRepository->forceSave();
        }
    }
} 