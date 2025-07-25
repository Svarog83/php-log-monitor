<?php

declare(strict_types=1);

namespace App\Domain\Repository;

use App\Domain\Model\LogFile;

/**
 * Repository interface for log file operations
 */
interface LogFileRepository
{
    /**
     * Find all log files in the given directory matching the pattern
     *
     * @param string $directory Directory to search in
     * @param string $pattern File pattern to match
     * @return array<LogFile>
     */
    public function findLogFiles(string $directory, string $pattern): array;

    /**
     * Get the latest log file from a list of log files
     *
     * @param array<LogFile> $logFiles
     */
    public function getLatestLogFile(array $logFiles): ?LogFile;

    /**
     * Read new lines from a log file since the last position
     *
     * @param LogFile $logFile The log file to read from
     * @param int $lastPosition Last read position
     * @return array<string> Array of new lines
     */
    public function readNewLines(LogFile $logFile, int $lastPosition): array;

    /**
     * Get current file size
     */
    public function getFileSize(LogFile $logFile): int;
} 