<?php

declare(strict_types=1);

namespace App\Infrastructure\Logging;

use Monolog\Logger;

/**
 * Debug logger wrapper that provides convenient debug methods
 */
final class DebugLogger
{
    private ?Logger $logger = null;

    public function __construct(bool $enabled = false, ?Logger $logger = null)
    {
        if ($enabled && $logger !== null) {
            $this->logger = $logger;
        }
    }

    public function isEnabled(): bool
    {
        return $this->logger !== null;
    }

    /** @param array<string, mixed> $context */
    public function start(string $message, array $context = []): void
    {
        $this->log('🚀 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function info(string $message, array $context = []): void
    {
        $this->log('ℹ️  ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function success(string $message, array $context = []): void
    {
        $this->log('✅ ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function warning(string $message, array $context = []): void
    {
        $this->log('⚠️  ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function error(string $message, array $context = []): void
    {
        $this->log('❌ ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function step(string $message, array $context = []): void
    {
        $this->log('🔄 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function file(string $message, array $context = []): void
    {
        $this->log('📁 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function search(string $message, array $context = []): void
    {
        $this->log('🔍 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function found(string $message, array $context = []): void
    {
        $this->log('✅ ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function notFound(string $message, array $context = []): void
    {
        $this->log('❌ ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function processing(string $message, array $context = []): void
    {
        $this->log('📝 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function config(string $message, array $context = []): void
    {
        $this->log('🔧 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function stats(string $message, array $context = []): void
    {
        $this->log('📊 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function data(string $message, array $context = []): void
    {
        $this->log('📄 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function size(string $message, array $context = []): void
    {
        $this->log('📏 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function time(string $message, array $context = []): void
    {
        $this->log('⏱️  ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function target(string $message, array $context = []): void
    {
        $this->log('🎯 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function switch(string $message, array $context = []): void
    {
        $this->log('🔄 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function read(string $message, array $context = []): void
    {
        $this->log('📖 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function send(string $message, array $context = []): void
    {
        $this->log('📤 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function parse(string $message, array $context = []): void
    {
        $this->log('🔍 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function latest(string $message, array $context = []): void
    {
        $this->log('🏆 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function monitor(string $message, array $context = []): void
    {
        $this->log('📖 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function cycle(string $message, array $context = []): void
    {
        $this->log('🔄 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function stop(string $message, array $context = []): void
    {
        $this->log('🛑 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function position(string $message, array $context = []): void
    {
        $this->log('📍 ' . $message, $context);
    }

    /** @param array<string, mixed> $context */
    private function log(string $message, array $context = []): void
    {
        $this->logger?->debug($message, $context);
    }
} 