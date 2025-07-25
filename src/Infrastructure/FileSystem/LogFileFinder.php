<?php

declare(strict_types=1);

namespace App\Infrastructure\FileSystem;

use App\Domain\Model\LogFile;
use App\Domain\Repository\LogFileRepository;
use Amp\File\File;
use Amp\File\Filesystem;
use DateTimeImmutable;

use function Amp\File\filesystem;

/**
 * Async implementation of LogFileRepository using amphp/file
 */
final class LogFileFinder implements LogFileRepository
{
    private Filesystem $filesystem;

    public function __construct(?Filesystem $filesystem = null)
    {
        $this->filesystem = $filesystem ?? filesystem();
    }

    public function findLogFiles(string $directory, string $pattern): array
    {
        $files = [];
        $pattern = str_replace('*', '.*', $pattern);
        $pattern = '/^' . $pattern . '$/';

        try {
            $entries = $this->filesystem->listFiles($directory);
            
            foreach ($entries as $entry) {
                if (preg_match($pattern, $entry)) {
                    $filePath = $directory . '/' . $entry;
                    $stat = $this->filesystem->getStatus($filePath);
                    
                    if ($stat !== null && $this->filesystem->isFile($filePath)) {
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
        } catch (\Exception) {
            // Directory might not exist or be inaccessible
            return [];
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
        try {
            $file = $this->filesystem->openFile($logFile->path, 'r');
            $file->seek($lastPosition);
            
            $content = $file->read();
            $file->close();
            
            if ($content === null) {
                return [];
            }

            $lines = explode("\n", $content);
            return array_filter($lines, fn(string $line) => !empty(trim($line)));
        } catch (\Exception) {
            return [];
        }
    }

    public function getFileSize(LogFile $logFile): int
    {
        try {
            $stat = $this->filesystem->getStatus($logFile->path);
            if ($stat === null) {
                return 0;
            }
            return $stat['size'] ?? 0;
        } catch (\Exception) {
            return 0;
        }
    }
} 