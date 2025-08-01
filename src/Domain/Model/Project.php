<?php

declare(strict_types=1);

namespace App\Domain\Model;

/**
 * Aggregate root representing a project configuration
 */
final readonly class Project
{
    /**
     * @param string $name Project name
     * @param array<string> $monitoredDirectories List of directories to monitor
     * @param string $logPattern Pattern to match log files (default: logstash-*.json)
     * @param array<string, mixed> $positionStorage Position storage configuration
     */
    public function __construct(
        public string $name,
        public array $monitoredDirectories,
        public string $logPattern = 'logstash-*.json',
        public array $positionStorage = []
    ) {
        if (empty($this->name)) {
            throw new \InvalidArgumentException('Project name cannot be empty');
        }

        if (empty($this->monitoredDirectories)) {
            throw new \InvalidArgumentException('At least one monitored directory is required');
        }

        foreach ($this->monitoredDirectories as $directory) {
            if (!is_dir($directory)) {
                throw new \InvalidArgumentException("Directory does not exist: {$directory}");
            }
        }
    }

    /**
     * @return array<string>
     */
    public function getMonitoredDirectories(): array
    {
        return $this->monitoredDirectories;
    }

    public function getLogPattern(): string
    {
        return $this->logPattern;
    }

    /**
     * Get position storage configuration
     * 
     * @return array<string, mixed>
     */
    public function getPositionStorageConfig(): array
    {
        return $this->positionStorage;
    }

    /**
     * Check if position tracking is enabled
     */
    public function isPositionTrackingEnabled(): bool
    {
        return !empty($this->positionStorage);
    }
} 