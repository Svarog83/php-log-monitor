<?php

declare(strict_types=1);

namespace App\Infrastructure\Logging;

use App\Domain\Model\LogEntry;
use Monolog\Level;
use Monolog\Logger;

/**
 * Adapter for Monolog integration
 */
final class MonologAdapter
{
    public function __construct(
        private Logger $logger
    ) {
    }

    public function logEntry(LogEntry $entry): void
    {
        $level = $this->mapLevel($entry->getLevel());
        $context = [
            'source_file' => $entry->sourceFile,
            'timestamp' => $entry->timestamp->format('Y-m-d H:i:s'),
        ];

        if ($entry->metadata !== null) {
            $context['metadata'] = $entry->metadata;
        }

        $this->logger->log($level, $entry->getMessage(), $context);
    }

    private function mapLevel(string $level): Level
    {
        return match (strtolower($level)) {
            'emergency' => Level::Emergency,
            'alert' => Level::Alert,
            'critical' => Level::Critical,
            'error' => Level::Error,
            'warning' => Level::Warning,
            'notice' => Level::Notice,
            'info' => Level::Info,
            'debug' => Level::Debug,
            default => Level::Info,
        };
    }
} 