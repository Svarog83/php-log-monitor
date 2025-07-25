<?php

declare(strict_types=1);

namespace App\Infrastructure\Logging;

use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\SocketHandler;
use Monolog\Level;
use Monolog\LogRecord;

/**
 * Custom Monolog handler for Buggregator integration
 */
final class BuggregatorHandler extends SocketHandler
{
    public function __construct(string $connectionString, Level $level = Level::Info)
    {
        parent::__construct($connectionString, $level, true, false);
        $this->setFormatter(new JsonFormatter());
        $this->setPersistent(false);
    }

    protected function write(LogRecord $record): void
    {
        try {
            parent::write($record);
        } catch (\Exception $e) {
            // Suppress connection errors as requested
            // Log to error log if needed
            error_log("Buggregator connection error: " . $e->getMessage());
        }
    }
} 