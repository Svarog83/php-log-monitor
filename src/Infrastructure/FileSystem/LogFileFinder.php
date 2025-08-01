<?php

declare(strict_types=1);

namespace App\Infrastructure\FileSystem;

use App\Domain\Model\LogFile;
use App\Domain\Repository\LogFileRepository;
use App\Infrastructure\Logging\DebugLogger;
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
    private DebugLogger $debugLogger;

    public function __construct(?Filesystem $filesystem = null, ?DebugLogger $debugLogger = null)
    {
        $this->filesystem = $filesystem ?? filesystem();
        $this->debugLogger = $debugLogger ?? new DebugLogger();
    }

    public function findLogFiles(string $directory, string $pattern): array
    {
        $this->debugLogger->search("Searching for log files in directory: {$directory}");
        $this->debugLogger->search("Using pattern: {$pattern}");
        
        $files = [];
        $pattern = str_replace('*', '.*', $pattern);
        $pattern = '/^' . $pattern . '$/';

        $this->debugLogger->search("Compiled regex pattern: {$pattern}");

        try {
            $entries = $this->filesystem->listFiles($directory);
            
            $this->debugLogger->stats("Found " . count($entries) . " entries in directory: {$directory}");
            
            foreach ($entries as $entry) {
                $this->debugLogger->search("Checking entry: {$entry}");
                
                if (preg_match($pattern, $entry)) {
                    $this->debugLogger->found("Entry matches pattern: {$entry}");
                    
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
                            
                            $this->debugLogger->data("Created LogFile object for: {$entry}");
                            $this->debugLogger->data("Path: {$filePath}");
                            $this->debugLogger->size("Size: {$stat['size']} bytes");
                            $this->debugLogger->time("Modified: " . $lastModified->format('Y-m-d H:i:s'));
                            
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

        $this->debugLogger->stats("Total matching log files found: " . count($files));

        return $files;
    }

    /**
     * @param array<LogFile> $logFiles
     */
    public function getLatestLogFile(array $logFiles): ?LogFile
    {
        $this->debugLogger->latest("Finding latest log file from " . count($logFiles) . " candidates");
        
        if (empty($logFiles)) {
            $this->debugLogger->warning("No log files provided");
            return null;
        }

        $latest = $logFiles[0];
        
        $this->debugLogger->target("Initial candidate: {$latest->filename} (modified: " . $latest->lastModified->format('Y-m-d H:i:s') . ")");
        
        foreach ($logFiles as $logFile) {
            $this->debugLogger->search("Comparing with: {$logFile->filename} (modified: " . $logFile->lastModified->format('Y-m-d H:i:s') . ")");
            
            if ($logFile->isNewerThan($latest)) {
                $this->debugLogger->switch("Found newer file: {$logFile->filename} is newer than {$latest->filename}");
                $latest = $logFile;
            } else {
                $this->debugLogger->success("Current latest is still newer: {$latest->filename}");
            }
        }

        $this->debugLogger->latest("Latest log file determined: {$latest->filename}");

        return $latest;
    }

    public function readNewLines(LogFile $logFile, int $lastPosition): array
    {
        $this->debugLogger->read("Reading new lines from file: {$logFile->filename}");
        $this->debugLogger->size("Starting from position: {$lastPosition}");
        
        try {
            $file = $this->filesystem->openFile($logFile->path, 'r');
            
            $this->debugLogger->success("File opened successfully");
            
            $file->seek($lastPosition);
            
            $this->debugLogger->size("Seeked to position: {$lastPosition}");
            
            $content = $file->read();
            $file->close();
            
            $this->debugLogger->data("Read content length: " . (strlen($content ?? '') . " characters"));
            
            if ($content === null) {
                $this->debugLogger->warning("No content read from file");
                return [];
            }

            $lines = explode("\n", $content);
            $filteredLines = array_filter($lines, fn(string $line) => !empty(trim($line)));
            
            $this->debugLogger->stats("Total lines found: " . count($lines));
            $this->debugLogger->stats("Non-empty lines: " . count($filteredLines));
            
            foreach ($filteredLines as $index => $line) {
                $this->debugLogger->processing("Line " . ($index + 1) . ": " . substr($line, 0, 100) . (strlen($line) > 100 ? '...' : ''));
            }
            
            return $filteredLines;
        } catch (\Exception $e) {
            $this->debugLogger->error("Error reading file {$logFile->filename}: " . $e->getMessage());
            return [];
        }
    }

    public function getFileSize(LogFile $logFile): int
    {
        $this->debugLogger->size("Getting file size for: {$logFile->filename}");
        
        try {
            // Use native PHP filesize() to get real-time file size without caching issues
            $size = filesize($logFile->path);
            
            if ($size === false) {
                $this->debugLogger->warning("Could not get file size for: {$logFile->filename}");
                return 0;
            }
            
            $this->debugLogger->size("File size: {$size} bytes");
            
            return $size;
        } catch (\Exception $e) {
            $this->debugLogger->error("Error getting file size for {$logFile->filename}: " . $e->getMessage());
            return 0;
        }
    }
} 