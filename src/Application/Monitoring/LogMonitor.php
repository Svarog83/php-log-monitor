<?php

declare(strict_types=1);

namespace App\Application\Monitoring;

use App\Domain\Model\LogEntry;
use App\Domain\Model\LogFile;
use App\Domain\Model\Project;
use App\Domain\Repository\LogFileRepository;
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
        private float $scanInterval = 1.0
    ) {
        $this->monitoringLoop = new PeriodicLoop(
            $this->monitorCallback(...),
            "LogMonitor-{$this->project->name}",
            $this->scanInterval
        );
    }

    public function start(): void
    {
        $this->monitoringLoop->start();
    }

    public function stop(): void
    {
        $this->monitoringLoop->stop();
    }

    public function isRunning(): bool
    {
        return $this->monitoringLoop->isRunning();
    }

    private function monitorCallback(PeriodicLoop $loop): bool
    {
        try {
            $this->checkForNewLogFiles();
            $this->monitorCurrentLogFile();
        } catch (\Exception $e) {
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

    private function checkForNewLogFiles(): void
    {
        $allLogFiles = [];
        
        foreach ($this->project->getMonitoredDirectories() as $directory) {
            $logFiles = $this->logFileRepository->findLogFiles($directory, $this->project->getLogPattern());
            $allLogFiles = array_merge($allLogFiles, $logFiles);
        }

        $latestLogFile = $this->logFileRepository->getLatestLogFile($allLogFiles);
        
        if ($latestLogFile === null) {
            return;
        }

        // Check if we have a new latest log file
        if ($this->currentLogFile === null || $latestLogFile->isNewerThan($this->currentLogFile)) {
            $this->switchToNewLogFile($latestLogFile);
        }
    }

    private function switchToNewLogFile(LogFile $newLogFile): void
    {
        if ($this->currentLogFile !== null) {
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
    }

    private function monitorCurrentLogFile(): void
    {
        if ($this->currentLogFile === null) {
            return;
        }

        // Check if file size has changed (indicating new content)
        $currentSize = $this->logFileRepository->getFileSize($this->currentLogFile);
        
        if ($currentSize > $this->lastPosition) {
            $newLines = $this->logFileRepository->readNewLines($this->currentLogFile, $this->lastPosition);
            
            foreach ($newLines as $line) {
                $logEntry = LogEntry::fromJsonLine($line, $this->currentLogFile->filename);
                if ($logEntry !== null) {
                    $this->logger->logEntry($logEntry);
                }
            }
            
            $this->lastPosition = $currentSize;
        }
    }
} 