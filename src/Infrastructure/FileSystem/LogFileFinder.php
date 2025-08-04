<?php

declare(strict_types=1);

namespace App\Infrastructure\FileSystem;

use App\Domain\Model\LogFile;
use App\Domain\Repository\LogFileRepository;
use App\Infrastructure\Logging\DebugLogger;
use Amp\File\Filesystem;
use DateTimeImmutable;

use function Amp\File\filesystem;

/**
 * Async implementation of LogFileRepository using amphp/file
 */
final class LogFileFinder implements LogFileRepository
{
    private Filesystem $filesystem;
    private DebugLogger $debugLogger;

    public function __construct(?Filesystem $filesystem = null, ?DebugLogger $debugLogger = null)
    {
        $this->filesystem = $filesystem ?? filesystem();
        $this->debugLogger = $debugLogger ?? new DebugLogger();
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
                            $logFile = new LogFile(
                                path: $filePath,
                                filename: $entry,
                                lastModified: $lastModified,
                                size: $stat['size']
                            );
                            
                            $files[] = $logFile;
                        } else {
                            $this->debugLogger->warning("Failed to parse modification time for: {$entry}");
                        }
                    } else {
                        $this->debugLogger->warning("Entry is not a file or stat failed: {$entry}");
                    }
                }
            }
        } catch (\Exception $e) {
            $this->debugLogger->error("Error accessing directory {$directory}: " . $e->getMessage());
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
            $this->debugLogger->warning("No log files provided");
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
            
            // Read all content from current position to end of file
            $content = '';
            while (!$file->eof()) {
                $chunk = $file->read();
                if ($chunk === null) {
                    break;
                }
                $content .= $chunk;
            }
            
            $file->close();
            
            if (empty($content)) {
                $this->debugLogger->warning("No content read from file");
                return [];
            }

            $lines = explode("\n", $content);

            return array_filter($lines, fn(string $line) => !empty(trim($line)));
        } catch (\Exception $e) {
            $this->debugLogger->error("Error reading file {$logFile->filename}: " . $e->getMessage());
            return [];
        }
    }

    public function getFileSize(LogFile $logFile): int
    {
        try {
            // Use native PHP filesize() to get real-time file size without caching issues
            clearstatcache(true, $logFile->path);
            $size = filesize($logFile->path);
//            $this->debugLogger->warning('filesize = ' . $size);
            
            if ($size === false) {
                $this->debugLogger->warning("Could not get file size for: {$logFile->filename}");
                return 0;
            }
            
            return $size;
        } catch (\Exception $e) {
            $this->debugLogger->error("Error getting file size for {$logFile->filename}: " . $e->getMessage());
            return 0;
        }
    }
}