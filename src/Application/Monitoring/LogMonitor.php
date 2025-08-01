<?php

declare(strict_types=1);

namespace App\Application\Monitoring;

use App\Domain\Model\LogEntry;
use App\Domain\Model\LogFile;
use App\Domain\Model\PositionTracker;
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
    private ?PositionTracker $positionTracker = null;
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
        $this->debugLogger->time("Scan interval: {$this->scanInterval} seconds");
        
        if ($this->project->isPositionTrackingEnabled()) {
            $this->debugLogger->config("Position tracking is enabled for project: {$this->project->name}");
        } else {
            $this->debugLogger->config("Position tracking is disabled for project: {$this->project->name}");
        }
    }

    /**
     * Set the position tracker for this monitor
     */
    public function setPositionTracker(PositionTracker $positionTracker): void
    {
        $this->positionTracker = $positionTracker;
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

    /**
     * Force save current position immediately (for graceful shutdown)
     */
    public function forceSavePosition(): void
    {
        if ($this->positionTracker !== null && $this->currentLogFile !== null) {
            $this->debugLogger->position("Force saving current position for graceful shutdown");
            $this->positionTracker->updatePosition($this->currentLogFile->path, $this->lastPosition);
            $this->positionTracker->forceSave();
        }
    }

    public function isRunning(): bool
    {
        return $this->monitoringLoop->isRunning();
    }

    private function monitorCallback(PeriodicLoop $loop): bool
    {
//        $this->debugLogger->cycle("Monitoring cycle started for project: {$this->project->name}");
        
        try {
            // Only check for new files if we don't have a current file or if current file is no longer accessible
            if ($this->currentLogFile === null) {
                $this->debugLogger->search("Current file not available, searching for latest log file");
                $this->findAndSwitchToLatestLogFile();
            }
            
            $this->monitorCurrentLogFile();
            
//            $this->debugLogger->success("Monitoring cycle completed for project: {$this->project->name}");
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
        
        // Load saved positions if position tracking is enabled
        if ($this->positionTracker !== null) {
            $this->loadSavedPositions();
        }
        
        $this->findAndSwitchToLatestLogFile();
        
        if ($this->currentLogFile !== null) {
            $this->debugLogger->success("Initialized with log file: {$this->currentLogFile->filename}");
        } else {
            $this->debugLogger->warning("No log files found during initialization");
        }
    }

    /**
     * Load saved positions and validate them against current log files
     */
    private function loadSavedPositions(): void
    {
        if ($this->positionTracker === null) {
            return;
        }
        
        $this->debugLogger->position("Loading saved positions for project: {$this->project->name}");
        
        $this->positionTracker->loadAllPositions();
    }

    private function findAndSwitchToLatestLogFile(): void
    {
        $allLogFiles = [];
        
        foreach ($this->project->getMonitoredDirectories() as $directory) {
            $logFiles = $this->logFileRepository->findLogFiles($directory, $this->project->getLogPattern());
            foreach ($logFiles as $logFile) {
                $this->debugLogger->data("  - {$logFile->filename} (size: {$logFile->size} bytes, modified: " . $logFile->lastModified->format('Y-m-d H:i:s') . ")");
            }
            
            $allLogFiles = array_merge($allLogFiles, $logFiles);
        }

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
            $this->switchToNewLogFile($latestLogFile);
        }
    }

    private function isCurrentFileAccessible(): bool
    {
        if ($this->currentLogFile === null) {
            return false;
        }

        try {
            $this->debugLogger->info("Checking if current file is accessible: {$this->currentLogFile->filename}");;
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
        
        // Load saved position if available, otherwise start from 0
        if ($this->positionTracker !== null) {
            $savedPosition = $this->positionTracker->getPosition($newLogFile->path);
            $this->lastPosition = $savedPosition;
            $this->debugLogger->position("Loaded saved position for {$newLogFile->filename}: {$savedPosition}");
        } else {
            $this->lastPosition = 0;
            $this->debugLogger->size("Reset position to: 0 (no position tracking)");
        }
        
        $this->debugLogger->success("Successfully switched to new log file: {$newLogFile->filename}");
        $this->debugLogger->size("Current position: {$this->lastPosition}");
    }

    private function monitorCurrentLogFile(): void
    {
        if ($this->currentLogFile === null) {
            $this->debugLogger->warning("No current log file to monitor");
            return;
        }

        // Check if file size has changed (indicating new content)
        $currentSize = $this->logFileRepository->getFileSize($this->currentLogFile);

//        $this->debugLogger->size("Current file size: {$currentSize} bytes");
        
        if ($currentSize > $this->lastPosition) {
            $newContentSize = $currentSize - $this->lastPosition;
            
            $this->debugLogger->size("File has grown by {$newContentSize} bytes");
            $newLines = $this->logFileRepository->readNewLines($this->currentLogFile, $this->lastPosition);
            
            foreach ($newLines as $line) {
                $logEntry = LogEntry::fromJsonLine($line, $this->currentLogFile->filename);
                if ($logEntry !== null) {
                    $this->logger->logEntry($logEntry);
                } else {
                    $this->debugLogger->warning("Invalid log entry format, skipping");
                }
            }
            
            $this->lastPosition = $currentSize;

            // Save position if position tracking is enabled
            if ($this->positionTracker !== null) {
                $this->positionTracker->updatePosition($this->currentLogFile->path, $this->lastPosition);
            }
        }
    }
} 