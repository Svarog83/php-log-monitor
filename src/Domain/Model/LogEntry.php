<?php

declare(strict_types=1);

namespace App\Domain\Model;

use DateTimeImmutable;

/**
 * Domain model representing a log entry
 */
final readonly class LogEntry
{
    /**
     * @param array<string, mixed>|null $metadata
     */
    public function __construct(
        public string $content,
        public string $sourceFile,
        public DateTimeImmutable $timestamp,
        public ?array $metadata = null
    ) {
    }

    public static function fromJsonLine(string $line, string $sourceFile): ?self
    {
        $data = json_decode($line, true);
        if (!is_array($data)) {
            return null;
        }

        $timestamp = new DateTimeImmutable();
        if (isset($data['@timestamp'])) {
            $parsedTimestamp = DateTimeImmutable::createFromFormat('Y-m-d\TH:i:s.u\Z', $data['@timestamp']);
            if ($parsedTimestamp !== false) {
                $timestamp = $parsedTimestamp;
            }
        }

        return new self(
            content: $line,
            sourceFile: $sourceFile,
            timestamp: $timestamp,
            metadata: $data
        );
    }

    public function getLevel(): string
    {
        if ($this->metadata === null) {
            return 'info';
        }

        $level = $this->metadata['level'] ?? null;
        return is_string($level) ? $level : 'info';
    }

    public function getMessage(): string
    {
        if ($this->metadata === null) {
            return $this->content;
        }

        $message = $this->metadata['message'] ?? null;
        return is_string($message) ? $message : $this->content;
    }
} 