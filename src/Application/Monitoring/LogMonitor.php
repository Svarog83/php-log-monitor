<?php

declare(strict_types=1);

namespace App\Application\Monitoring;

use App\Domain\Model\LogEntry;
use App\Domain\Model\LogFile;
use App\Domain\Model\Project;
use App\Domain\Repository\LogFileRepository;
use App\Infrastructure\Logging\DebugLogger;
use App\Infrastructure\Logging\MonologAdapter;
use danog\Loop\PeriodicLoop;

/**
 * Main application service for log monitoring
 */
final class LogMonitor
{
    private ?LogFile $currentLogFile = null;
    private int $lastPosition = 0;
    private PeriodicLoop $monitoringLoop;

    public function __construct(
        private Project $project,
        private LogFileRepository $logFileRepository,
        private MonologAdapter $logger,
        private DebugLogger $debugLogger,
        private float $scanInterval = 1.0
    ) {
        $this->monitoringLoop = new PeriodicLoop(
            $this->monitorCallback(...),
            "LogMonitor-{$this->project->name}",
            $this->scanInterval
        );
        
        $this->debugLogger->config("LogMonitor initialized for project: {$this->project->name}");
        $this->debugLogger->file("Monitored directories: " . implode(', ', $this->project->getMonitoredDirectories()));
        $this->debugLogger->search("Log pattern: {$this->project->getLogPattern()}");
        $this->debugLogger->time("Scan interval: {$this->scanInterval} seconds");
    }

    public function start(): void
    {
        $this->debugLogger->start("Starting LogMonitor for project: {$this->project->name}");
        
        // Initialize by finding the latest log file
        $this->initializeLatestLogFile();
        
        $this->monitoringLoop->start();
        
        $this->debugLogger->success("LogMonitor started successfully for project: {$this->project->name}");
    }

    public function stop(): void
    {
        $this->debugLogger->stop("Stopping LogMonitor for project: {$this->project->name}");
        
        $this->monitoringLoop->stop();
        
        $this->debugLogger->success("LogMonitor stopped for project: {$this->project->name}");
    }

    public function isRunning(): bool
    {
        return $this->monitoringLoop->isRunning();
    }

    private function monitorCallback(PeriodicLoop $loop): bool
    {
        $this->debugLogger->cycle("Monitoring cycle started for project: {$this->project->name}");
        
        try {
            // Only check for new files if we don't have a current file or if current file is no longer accessible
            if ($this->currentLogFile === null || !$this->isCurrentFileAccessible()) {
                $this->debugLogger->search("Current file not available, searching for latest log file");
                $this->findAndSwitchToLatestLogFile();
            }
            
            $this->monitorCurrentLogFile();
            
            $this->debugLogger->success("Monitoring cycle completed for project: {$this->project->name}");
        } catch (\Exception $e) {
            $this->debugLogger->error("Error in monitoring cycle for project {$this->project->name}: " . $e->getMessage());
            
            // Log error but continue monitoring
            $this->logger->logEntry(new LogEntry(
                content: "Monitoring error: {$e->getMessage()}",
                sourceFile: 'monitor',
                timestamp: new \DateTimeImmutable(),
                metadata: ['error' => $e->getMessage()]
            ));
        }

        return false; // Continue monitoring
    }

    private function initializeLatestLogFile(): void
    {
        $this->debugLogger->start("Initializing latest log file for project: {$this->project->name}");
        
        $this->findAndSwitchToLatestLogFile();
        
        if ($this->currentLogFile !== null) {
            $this->debugLogger->success("Initialized with log file: {$this->currentLogFile->filename}");
        } else {
            $this->debugLogger->warning("No log files found during initialization");
        }
    }

    private function findAndSwitchToLatestLogFile(): void
    {
        $this->debugLogger->search("Finding latest log file across all monitored directories");
        
        $allLogFiles = [];
        
        foreach ($this->project->getMonitoredDirectories() as $directory) {
            $this->debugLogger->file("Scanning directory: {$directory}");
            
            $logFiles = $this->logFileRepository->findLogFiles($directory, $this->project->getLogPattern());
            
            $this->debugLogger->stats("Found " . count($logFiles) . " log files in directory: {$directory}");
            foreach ($logFiles as $logFile) {
                $this->debugLogger->data("  - {$logFile->filename} (size: {$logFile->size} bytes, modified: " . $logFile->lastModified->format('Y-m-d H:i:s') . ")");
            }
            
            $allLogFiles = array_merge($allLogFiles, $logFiles);
        }

        $this->debugLogger->stats("Total log files found across all directories: " . count($allLogFiles));

        $latestLogFile = $this->logFileRepository->getLatestLogFile($allLogFiles);
        
        if ($latestLogFile === null) {
            $this->debugLogger->warning("No log files found in any monitored directory");
            $this->currentLogFile = null;
            $this->lastPosition = 0;
            return;
        }

        $this->debugLogger->latest("Latest log file: {$latestLogFile->filename} (size: {$latestLogFile->size} bytes, modified: " . $latestLogFile->lastModified->format('Y-m-d H:i:s') . ")");

        // Check if we have a new latest log file
        if ($this->currentLogFile === null || $latestLogFile->isNewerThan($this->currentLogFile)) {
            if ($this->currentLogFile === null) {
                $this->debugLogger->target("Setting initial log file: {$latestLogFile->filename}");
            } else {
                $this->debugLogger->switch("Switching from {$this->currentLogFile->filename} to {$latestLogFile->filename}");
            }
            
            $this->switchToNewLogFile($latestLogFile);
        } else {
            $this->debugLogger->success("Current log file is still the latest: {$this->currentLogFile->filename}");
        }
    }

    private function isCurrentFileAccessible(): bool
    {
        if ($this->currentLogFile === null) {
            return false;
        }

        try {
            $currentSize = $this->logFileRepository->getFileSize($this->currentLogFile);
            return $currentSize >= 0; // If we can get the size, file is accessible
        } catch (\Exception $e) {
            $this->debugLogger->warning("Current file is no longer accessible: {$this->currentLogFile->filename} - " . $e->getMessage());
            return false;
        }
    }

    private function switchToNewLogFile(LogFile $newLogFile): void
    {
        if ($this->currentLogFile !== null) {
            $this->debugLogger->switch("Switching log files:");
            $this->debugLogger->switch("  From: {$this->currentLogFile->filename}");
            $this->debugLogger->switch("  To: {$newLogFile->filename}");
            
            $this->logger->logEntry(new LogEntry(
                content: "Switching from {$this->currentLogFile->filename} to {$newLogFile->filename}",
                sourceFile: 'monitor',
                timestamp: new \DateTimeImmutable(),
                metadata: [
                    'old_file' => $this->currentLogFile->filename,
                    'new_file' => $newLogFile->filename
                ]
            ));
        }

        $this->currentLogFile = $newLogFile;
        $this->lastPosition = 0;
        
        $this->debugLogger->success("Successfully switched to new log file: {$newLogFile->filename}");
        $this->debugLogger->size("Reset position to: 0");
    }

    private function monitorCurrentLogFile(): void
    {
        if ($this->currentLogFile === null) {
            $this->debugLogger->warning("No current log file to monitor");
            return;
        }

        $this->debugLogger->monitor("Monitoring current log file: {$this->currentLogFile->filename}");
        $this->debugLogger->size("Last position: {$this->lastPosition}");

        // Check if file size has changed (indicating new content)
        $currentSize = $this->logFileRepository->getFileSize($this->currentLogFile);
        
        $this->debugLogger->size("Current file size: {$currentSize} bytes");
        
        if ($currentSize > $this->lastPosition) {
            $newContentSize = $currentSize - $this->lastPosition;
            
            $this->debugLogger->size("File has grown by {$newContentSize} bytes");
            $this->debugLogger->read("Reading new lines from position {$this->lastPosition}...");
            
            $newLines = $this->logFileRepository->readNewLines($this->currentLogFile, $this->lastPosition);
            
            $this->debugLogger->stats("Found " . count($newLines) . " new lines");
            
            $processedEntries = 0;
            foreach ($newLines as $lineNumber => $line) {
                $this->debugLogger->processing("Processing line " . ($lineNumber + 1) . ": " . substr($line, 0, 100) . (strlen($line) > 100 ? '...' : ''));
                
                $logEntry = LogEntry::fromJsonLine($line, $this->currentLogFile->filename, $this->debugLogger);
                if ($logEntry !== null) {
                    $this->debugLogger->success("Valid log entry found and processed");
                    $this->logger->logEntry($logEntry);
                    $processedEntries++;
                } else {
                    $this->debugLogger->warning("Invalid log entry format, skipping");
                }
            }
            
            $this->debugLogger->stats("Processed {$processedEntries} valid log entries");
            
            $this->lastPosition = $currentSize;
            
            $this->debugLogger->size("Updated last position to: {$this->lastPosition}");
        } else {
            $this->debugLogger->success("No new content detected in log file");
        }
    }
} 