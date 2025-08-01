<?php

declare(strict_types=1);

namespace App\Domain\Model;

use DateTimeImmutable;

/**
 * Value object representing a file position for tracking
 */
final readonly class FilePosition
{
    public function __construct(
        public string $filePath,
        public int $position,
        public DateTimeImmutable $lastUpdated,
        public string $projectName
    ) {
        if (empty($this->filePath)) {
            throw new \InvalidArgumentException('File path cannot be empty');
        }

        if ($this->position < 0) {
            throw new \InvalidArgumentException('Position cannot be negative');
        }

        if (empty($this->projectName)) {
            throw new \InvalidArgumentException('Project name cannot be empty');
        }
    }

    public function updatePosition(int $newPosition): self
    {
        return new self(
            filePath: $this->filePath,
            position: $newPosition,
            lastUpdated: new DateTimeImmutable(),
            projectName: $this->projectName
        );
    }

    public function isForFile(string $filePath): bool
    {
        return $this->filePath === $filePath;
    }

    public function isForProject(string $projectName): bool
    {
        return $this->projectName === $projectName;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'file_path' => $this->filePath,
            'position' => $this->position,
            'last_updated' => $this->lastUpdated->format('Y-m-d H:i:s'),
            'project_name' => $this->projectName
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        if (!isset($data['file_path']) || !is_string($data['file_path'])) {
            throw new \InvalidArgumentException('file_path must be a string');
        }
        
        if (!isset($data['position']) || !is_int($data['position'])) {
            throw new \InvalidArgumentException('position must be an integer');
        }
        
        if (!isset($data['last_updated']) || !is_string($data['last_updated'])) {
            throw new \InvalidArgumentException('last_updated must be a string');
        }
        
        if (!isset($data['project_name']) || !is_string($data['project_name'])) {
            throw new \InvalidArgumentException('project_name must be a string');
        }
        
        $lastUpdated = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $data['last_updated']);
        if ($lastUpdated === false) {
            throw new \InvalidArgumentException('Invalid date format for last_updated');
        }
        
        return new self(
            filePath: $data['file_path'],
            position: $data['position'],
            lastUpdated: $lastUpdated,
            projectName: $data['project_name']
        );
    }
} 