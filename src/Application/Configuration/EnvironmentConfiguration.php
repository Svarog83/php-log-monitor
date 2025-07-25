<?php

declare(strict_types=1);

namespace App\Application\Configuration;

use Symfony\Component\Dotenv\Dotenv;

/**
 * Environment configuration management
 */
final class EnvironmentConfiguration
{
    /** @var array<string, string> */
    private array $env;

    public function __construct(string $envPath = null)
    {
        $this->env = [];
        
        if ($envPath !== null && file_exists($envPath)) {
            $dotenv = new Dotenv();
            $content = file_get_contents($envPath);
            if ($content !== false) {
                $this->env = $dotenv->parse($content);
            }
        }
    }

    public function getVarDumperFormat(): string
    {
        return $this->env['VAR_DUMPER_FORMAT'] ?? 'server';
    }

    public function getVarDumperServer(): string
    {
        return $this->env['VAR_DUMPER_SERVER'] ?? 'host.docker.internal:9912';
    }

    public function getLogPath(): string
    {
        return $this->env['LOG_PATH'] ?? 'var/log/logstash-%s.json';
    }

    public function getBuggregatorHost(): string
    {
        return $this->env['BUGGREGATOR_HOST'] ?? 'host.docker.internal';
    }

    public function getBuggregatorPort(): int
    {
        return (int) ($this->env['BUGGREGATOR_PORT'] ?? 9913);
    }

    public function getBuggregatorConnectionString(): string
    {
        return sprintf('tcp://%s:%d', $this->getBuggregatorHost(), $this->getBuggregatorPort());
    }
} 