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
        public string $logPattern = 'logstash-*.json',
        public array $positionStorage = []
    );
    
    public function getMonitoredDirectories(): array;
    public function getLogPattern(): string;
    public function getPositionStorageConfig(): array;
    public function isPositionTrackingEnabled(): bool;
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

### FilePosition
```php
final readonly class FilePosition
{
    public function __construct(
        public string $filePath,
        public int $position,
        public DateTimeImmutable $lastUpdated,
        public string $projectName
    );
    
    public function updatePosition(int $newPosition): self;
    public function isForFile(string $filePath): bool;
    public function isForProject(string $projectName): bool;
    public function toArray(): array;
    public static function fromArray(array $data): self;
}
```

### PositionTracker
```php
final class PositionTracker
{
    public function __construct(
        private PositionRepository $positionRepository,
        private string $projectName
    );
    
    public function getPosition(string $filePath): int;
    public function updatePosition(string $filePath, int $newPosition): void;
    public function loadAllPositions(): array;
    public function hasPosition(string $filePath): bool;
    public function deletePosition(string $filePath): void;
    public function deleteAllPositions(): void;
    public function isPositionValid(FilePosition $position, LogFile $logFile): bool;
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

### PositionRepository
```php
interface PositionRepository
{
    public function savePosition(FilePosition $position): void;
    public function loadPosition(string $filePath, string $projectName): ?FilePosition;
    public function loadPositionsForProject(string $projectName): array;
    public function deletePosition(string $filePath, string $projectName): void;
    public function deletePositionsForProject(string $projectName): void;
    public function hasPosition(string $filePath, string $projectName): bool;
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
    
    public function setPositionTracker(PositionTracker $positionTracker): void;
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