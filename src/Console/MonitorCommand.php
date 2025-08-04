<?php

declare(strict_types=1);

namespace App\Console;

use App\Application\Configuration\EnvironmentConfiguration;
use App\Application\Configuration\ProjectConfiguration;
use App\Application\Monitoring\LogMonitor;
use App\Domain\Model\PositionTracker;
use App\Domain\Model\Project;
use App\Infrastructure\FileSystem\LogFileFinder;
use App\Infrastructure\Logging\DebugLogger;
use App\Infrastructure\Logging\LoggerFactory;
use App\Infrastructure\Logging\MonologAdapter;
use App\Infrastructure\Storage\PositionStorageFactory;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

use function Amp\delay;

/**
 * CLI command for log monitoring
 */
final class MonitorCommand extends Command
{
    protected static string $defaultName = 'monitor';
    protected static string $defaultDescription = 'Monitor log files for changes';

    /** @var array<LogMonitor> */
    private array $monitors = [];
    private bool $shutdownRequested = false;
    private OutputInterface $output;

    public function __construct()
    {
        parent::__construct('monitor');
    }

    protected function configure(): void
    {
        $this
            ->addArgument('config', InputArgument::REQUIRED, 'Path to configuration file')
            ->addOption('project', 'p', InputOption::VALUE_REQUIRED, 'Specific project to monitor')
            ->addOption('interval', 'i', InputOption::VALUE_REQUIRED, 'Scan interval in seconds', '1.0')
            ->addOption('env-file', 'e', InputOption::VALUE_REQUIRED, 'Environment file path', '.env')
            ->addOption('debug', 'd', InputOption::VALUE_NONE, 'Enable debug output');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->output = $output;
        $isDebug = (bool) $input->getOption('debug');
        
        $configPath = $input->getArgument('config');
        if (!is_string($configPath)) {
            $output->writeln('<error>Config path must be a string</error>');
            return Command::FAILURE;
        }

        $projectName = $input->getOption('project');
        if ($projectName !== null && !is_string($projectName)) {
            $output->writeln('<error>Project name must be a string</error>');
            return Command::FAILURE;
        }

        $intervalOption = $input->getOption('interval');
        if (!is_string($intervalOption)) {
            $output->writeln('<error>Interval must be a string</error>');
            return Command::FAILURE;
        }
        $interval = (float) $intervalOption;

        $envFileOption = $input->getOption('env-file');
        if (!is_string($envFileOption)) {
            $output->writeln('<error>Environment file must be a string</error>');
            return Command::FAILURE;
        }

        try {
            // Setup signal handlers for graceful shutdown
            $this->setupSignalHandlers();

            // Load environment configuration
            $envConfig = new EnvironmentConfiguration($envFileOption);

            // Load project configuration
            $config = ProjectConfiguration::fromYamlFile($configPath);

            // Setup logger factory and create loggers
            $loggerFactory = new LoggerFactory($envConfig);
            $appLogger = $loggerFactory->createConsoleLogger();
            $debugLogger = new DebugLogger($isDebug, $loggerFactory->createDebugLogger());

            // Setup file finder
            $fileFinder = new LogFileFinder(null, $debugLogger);

            // Setup position storage factory
            $positionStorageFactory = new PositionStorageFactory($debugLogger);

            if ($projectName !== null) {
                // Monitor specific project
                $project = $config->getProject($projectName);
                if ($project === null) {
                    $output->writeln("<error>Project '{$projectName}' not found in configuration</error>");
                    return Command::FAILURE;
                }

                $monologAdapter = new MonologAdapter($appLogger, $project);
                $this->monitors[] = $this->createMonitor($project, $fileFinder, $monologAdapter, $interval, $debugLogger, $positionStorageFactory);
            } else {
                // Monitor all projects
                foreach ($config->getProjects() as $project) {
                    $monologAdapter = new MonologAdapter($appLogger, $project);
                    $this->monitors[] = $this->createMonitor($project, $fileFinder, $monologAdapter, $interval, $debugLogger, $positionStorageFactory);
                }
            }

            if (empty($this->monitors)) {
                $output->writeln('<error>No projects to monitor</error>');
                return Command::FAILURE;
            }

            $output->writeln('Starting log monitoring...');
            $output->writeln('Monitoring ' . count($this->monitors) . ' project(s)');
            $output->writeln('Press Ctrl+C to stop gracefully');

            // Start all monitors
            foreach ($this->monitors as $monitor) {
                $monitor->start();
            }

            // Keep running until interrupted - this is intentional for a long-running process
            while (!$this->shutdownRequested) {
                // Dispatch signals periodically to ensure they are handled
                if (function_exists('pcntl_signal_dispatch')) {
                    pcntl_signal_dispatch();
                }
                delay(1);
            }

            // Graceful shutdown
            $this->performGracefulShutdown();

        } catch (\Exception $e) {
            $output->writeln("<error>Error: {$e->getMessage()}</error>");
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    /**
     * Setup signal handlers for graceful shutdown
     */
    private function setupSignalHandlers(): void
    {
        // Handle SIGINT (Ctrl+C)
        if (function_exists('pcntl_signal')) {
            pcntl_signal(SIGINT, function () {
                $this->handleShutdownSignal('SIGINT (Ctrl+C)');
            });

            // Handle SIGTERM (kill command)
            pcntl_signal(SIGTERM, function () {
                $this->handleShutdownSignal('SIGTERM');
            });

            // Handle SIGTSTP (Ctrl+Z) - suspend
            pcntl_signal(SIGTSTP, function () {
                $this->handleShutdownSignal('SIGTSTP (Ctrl+Z)');
            });

            // Enable signal handling
            pcntl_signal_dispatch();
        } else {
            $this->output->writeln('<comment>Warning: pcntl extension not available. Signal handling disabled.</comment>');
        }
    }

    /**
     * Handle shutdown signals
     */
    private function handleShutdownSignal(string $signal): void
    {
        if ($this->shutdownRequested) {
            return; // Already shutting down
        }

        $this->output->writeln("\n<info>Received {$signal}. Starting graceful shutdown...</info>");
        $this->shutdownRequested = true;
    }

    /**
     * Perform graceful shutdown of all monitors
     */
    private function performGracefulShutdown(): void
    {
        $this->output->writeln('<info>Stopping all monitors...</info>');

        foreach ($this->monitors as $monitor) {
            try {
                // Force save current position immediately
                $monitor->forceSavePosition();
                
                // Stop the monitor
                $monitor->stop();
            } catch (\Exception $e) {
                $this->output->writeln("<error>Error stopping monitor: {$e->getMessage()}</error>");
            }
        }

        $this->output->writeln('<info>Graceful shutdown completed. All positions saved.</info>');
    }

    private function createMonitor(
        Project $project,
        LogFileFinder $fileFinder,
        MonologAdapter $logger,
        float $interval,
        DebugLogger $debugLogger,
        PositionStorageFactory $positionStorageFactory
    ): LogMonitor {
        $monitor = new LogMonitor($project, $fileFinder, $logger, $debugLogger, $interval);
        
        // Setup position tracking if enabled for this project
        if ($project->isPositionTrackingEnabled()) {
            $positionConfig = $project->getPositionStorageConfig();
            $positionRepository = $positionStorageFactory->createRepository($positionConfig);
            $positionTracker = new PositionTracker($positionRepository, $project->name);
            $monitor->setPositionTracker($positionTracker);
        }
        
        return $monitor;
    }
} 