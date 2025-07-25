<?php

declare(strict_types=1);

namespace App\Infrastructure\Logging;

use App\Application\Configuration\EnvironmentConfiguration;
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
        
        // Console output with JSON formatter
        $consoleHandler = new StreamHandler('php://stdout', Level::Info);
        $consoleHandler->setFormatter(new JsonFormatter());
        $logger->pushHandler($consoleHandler);

        // Buggregator handler
        $buggregatorHandler = new BuggregatorHandler(
            $this->envConfig->getBuggregatorConnectionString(),
            Level::Info
        );
        $logger->pushHandler($buggregatorHandler);

        return $logger;
    }
} 