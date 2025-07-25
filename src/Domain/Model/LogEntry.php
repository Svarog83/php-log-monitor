<?php

declare(strict_types=1);

namespace App\Domain\Model;

use App\Infrastructure\Logging\DebugLogger;
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

    public static function fromJsonLine(string $line, string $sourceFile, ?DebugLogger $debugLogger = null): ?self
    {
        if ($debugLogger !== null) {
            $debugLogger->parse("Parsing JSON line from file: {$sourceFile}");
            $debugLogger->parse("Raw line: " . substr($line, 0, 200) . (strlen($line) > 200 ? '...' : ''));
        }
        
        $data = json_decode($line, true);
        if (!is_array($data)) {
            if ($debugLogger !== null) {
                $debugLogger->error("Failed to parse JSON line");
            }
            return null;
        }

        if ($debugLogger !== null) {
            $debugLogger->success("JSON parsed successfully");
        }

        $timestamp = new DateTimeImmutable();
        if (isset($data['@timestamp'])) {
            if ($debugLogger !== null) {
                $debugLogger->time("Found timestamp in data: {$data['@timestamp']}");
            }
            
            $parsedTimestamp = DateTimeImmutable::createFromFormat('Y-m-d\TH:i:s.u\Z', $data['@timestamp']);
            if ($parsedTimestamp !== false) {
                $timestamp = $parsedTimestamp;
                if ($debugLogger !== null) {
                    $debugLogger->success("Timestamp parsed successfully: " . $timestamp->format('Y-m-d H:i:s'));
                }
            } else {
                if ($debugLogger !== null) {
                    $debugLogger->warning("Failed to parse timestamp, using current time");
                }
            }
        } else {
            if ($debugLogger !== null) {
                $debugLogger->warning("No timestamp found in data, using current time");
            }
        }

        $logEntry = new self(
            content: $line,
            sourceFile: $sourceFile,
            timestamp: $timestamp,
            metadata: $data
        );
        
        if ($debugLogger !== null) {
            $debugLogger->success("LogEntry created successfully");
            $debugLogger->data("Source: {$sourceFile}");
            $debugLogger->time("Timestamp: " . $timestamp->format('Y-m-d H:i:s'));
            $debugLogger->info("Level: " . $logEntry->getLevel());
            $debugLogger->info("Message: " . substr($logEntry->getMessage(), 0, 100) . (strlen($logEntry->getMessage()) > 100 ? '...' : ''));
        }

        return $logEntry;
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