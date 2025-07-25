<?php

declare(strict_types=1);

namespace App\Infrastructure\FileSystem;

use App\Domain\Model\LogFile;
use App\Domain\Repository\LogFileRepository;
use DateTimeImmutable;

/**
 * Implementation of LogFileRepository using native PHP file operations
 */
final class LogFileFinder implements LogFileRepository
{
    public function findLogFiles(string $directory, string $pattern): array
    {
        $files = [];
        $pattern = str_replace('*', '.*', $pattern);
        $pattern = '/^' . $pattern . '$/';

        if (!is_dir($directory)) {
            return [];
        }

        $entries = scandir($directory);
        if ($entries === false) {
            return [];
        }

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            if (preg_match($pattern, $entry)) {
                $filePath = $directory . '/' . $entry;
                if (is_file($filePath)) {
                    $stat = stat($filePath);
                    if ($stat !== false) {
                        $lastModified = DateTimeImmutable::createFromFormat('U', (string) $stat['mtime']);
                        if ($lastModified !== false) {
                            $files[] = new LogFile(
                                path: $filePath,
                                filename: $entry,
                                lastModified: $lastModified,
                                size: $stat['size']
                            );
                        }
                    }
                }
            }
        }

        return $files;
    }

    /**
     * @param array<LogFile> $logFiles
     */
    public function getLatestLogFile(array $logFiles): ?LogFile
    {
        if (empty($logFiles)) {
            return null;
        }

        $latest = $logFiles[0];
        foreach ($logFiles as $logFile) {
            if ($logFile->isNewerThan($latest)) {
                $latest = $logFile;
            }
        }

        return $latest;
    }

    public function readNewLines(LogFile $logFile, int $lastPosition): array
    {
        if (!file_exists($logFile->path)) {
            return [];
        }

        $handle = fopen($logFile->path, 'r');
        if ($handle === false) {
            return [];
        }

        fseek($handle, $lastPosition);
        $content = stream_get_contents($handle);
        fclose($handle);

        if ($content === false || $content === '') {
            return [];
        }

        $lines = explode("\n", $content);
        return array_filter($lines, fn(string $line) => !empty(trim($line)));
    }

    public function getFileSize(LogFile $logFile): int
    {
        if (!file_exists($logFile->path)) {
            return 0;
        }

        $size = filesize($logFile->path);
        return $size !== false ? $size : 0;
    }
} 