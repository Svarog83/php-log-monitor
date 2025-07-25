<?php

declare(strict_types=1);

namespace App\Domain\Model;

use DateTimeImmutable;

/**
 * Value object representing a log file
 */
final readonly class LogFile
{
    public function __construct(
        public string $path,
        public string $filename,
        public DateTimeImmutable $lastModified,
        public int $size
    ) {
    }

    public function isNewerThan(LogFile $other): bool
    {
        return $this->lastModified > $other->lastModified;
    }

    public function getDateFromFilename(): ?DateTimeImmutable
    {
        // Extract date from filename like "logstash-2025-07-24.json"
        if (preg_match('/logstash-(\d{4}-\d{2}-\d{2})\.json$/', $this->filename, $matches)) {
            $date = DateTimeImmutable::createFromFormat('Y-m-d', $matches[1]);
            return $date ?: null;
        }

        return null;
    }

    public function equals(LogFile $other): bool
    {
        return $this->path === $other->path;
    }
} 