# API Reference

## Core Domain Models

### LogFile
```php
final readonly class LogFile
{
    public function __construct(
        public string $path,
        public string $filename,
        public DateTimeImmutable $lastModified,
        public int $size
    );
    
    public function isNewerThan(LogFile $other): bool;
    public function getDateFromFilename(): ?DateTimeImmutable;
    public function equals(LogFile $other): bool;
}
```

### Project
```php
final readonly class Project
{
    public function __construct(
        public string $name,
        public array $monitoredDirectories,
        public string $logPattern = 'logstash-*.json'
    );
    
    public function getMonitoredDirectories(): array;
    public function getLogPattern(): string;
}
```

### LogEntry
```php
final readonly class LogEntry
{
    public function __construct(
        public string $content,
        public string $sourceFile,
        public DateTimeImmutable $timestamp,
        public ?array $metadata = null
    );
    
    public static function fromJsonLine(string $line, string $sourceFile): ?self;
    public function getLevel(): string;
    public function getMessage(): string;
}
```

## Repository Interface

### LogFileRepository
```php
interface LogFileRepository
{
    public function findLogFiles(string $directory, string $pattern): array;
    public function getLatestLogFile(array $logFiles): ?LogFile;
    public function readNewLines(LogFile $logFile, int $lastPosition): array;
    public function getFileSize(LogFile $logFile): int;
}
```

## Application Services

### LogMonitor
```php
final class LogMonitor
{
    public function __construct(
        private Project $project,
        private LogFileRepository $logFileRepository,
        private MonologAdapter $logger,
        private float $scanInterval = 1.0
    );
    
    public function start(): void;
    public function stop(): void;
    public function isRunning(): bool;
}
```

### ProjectConfiguration
```php
final class ProjectConfiguration
{
    public function __construct(array $projects = []);
    public static function fromYamlFile(string $configPath): self;
    public function getProjects(): array;
    public function getProject(string $name): ?Project;
    public function hasProject(string $name): bool;
}
```

## Infrastructure Components

### LogFileFinder
```php
final class LogFileFinder implements LogFileRepository
{
    public function findLogFiles(string $directory, string $pattern): array;
    public function getLatestLogFile(array $logFiles): ?LogFile;
    public function readNewLines(LogFile $logFile, int $lastPosition): array;
    public function getFileSize(LogFile $logFile): int;
}
```

### MonologAdapter
```php
final class MonologAdapter
{
    public function __construct(private Logger $logger);
    public function logEntry(LogEntry $entry): void;
    private function mapLevel(string $level): Level;
}
```

## Console Commands

### MonitorCommand
```php
final class MonitorCommand extends Command
{
    public function __construct();
    protected function configure(): void;
    protected function execute(InputInterface $input, OutputInterface $output): int;
}
```

## Key Dependencies

- **amphp/amp**: Async programming primitives
- **danog/loop**: Periodic task execution
- **monolog/monolog**: Logging framework
- **symfony/console**: CLI framework
- **symfony/yaml**: Configuration parsing

## Usage Patterns

### Basic Monitoring Setup
```php
$project = new Project('myapp', ['/var/log/myapp']);
$fileFinder = new LogFileFinder();
$logger = new Logger('monitor');
$adapter = new MonologAdapter($logger);
$monitor = new LogMonitor($project, $fileFinder, $adapter);
$monitor->start();
```

### Configuration Loading
```php
$config = ProjectConfiguration::fromYamlFile('config.yaml');
$projects = $config->getProjects();
```

### CLI Usage
```bash
php src/console.php config.yaml --project=myapp --interval=0.5
``` 