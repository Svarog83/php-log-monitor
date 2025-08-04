<?php

declare(strict_types=1);

namespace App\Infrastructure\Logging;

use App\Application\Configuration\EnvironmentConfiguration;
use Monolog\Formatter\LineFormatter;
use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;

/**
 * Factory for creating configured Monolog loggers
 */
final class LoggerFactory
{
    public function __construct(
        private EnvironmentConfiguration $envConfig
    ) {
    }

    public function createLogger(string $name = 'log-monitor'): Logger
    {
        $logger = new Logger($name);

        // Add file handler with JSON formatter
        $logPath = sprintf($this->envConfig->getLogPath(), date('Y-m-d'));
        $fileHandler = new StreamHandler($logPath, Level::Debug);
        $fileHandler->setFormatter(new JsonFormatter());
        $logger->pushHandler($fileHandler);

        // Add Buggregator handler
        $buggregatorHandler = new BuggregatorHandler(
            $this->envConfig->getBuggregatorConnectionString(),
            Level::Info
        );
        $logger->pushHandler($buggregatorHandler);

        return $logger;
    }

    public function createConsoleLogger(): Logger
    {
        $logger = new Logger('console');

        // Buggregator handler
        $buggregatorHandler = new BuggregatorHandler(
            $this->envConfig->getBuggregatorConnectionString(),
            Level::Info
        );
        $logger->pushHandler($buggregatorHandler);

        return $logger;
    }

    public function createDebugLogger(): Logger
    {
        $logger = new Logger('debug');
        
        // Console output with human-readable formatter for debug messages
        $consoleHandler = new StreamHandler('php://stdout', Level::Debug);
        $formatter = new LineFormatter(
            "[%datetime%] %channel%.%level_name%: %message% %context% %extra%\n",
            'Y-m-d H:i:s'
        );
        $consoleHandler->setFormatter($formatter);
        $logger->pushHandler($consoleHandler);

        return $logger;
    }
} 