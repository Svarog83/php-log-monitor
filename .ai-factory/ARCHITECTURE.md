# Architecture: Clean Architecture

## Overview

This project follows **Clean Architecture** with DDD tactical patterns. The codebase is organized into four concentric layers — Domain, Application, Infrastructure, and Console — with dependencies strictly pointing inward. The Domain layer contains pure business logic with no external dependencies, while outer layers implement interfaces defined in inner layers.

This architecture was chosen because the project has moderate domain complexity (position tracking strategies, multi-project monitoring, log parsing) with clear boundaries between business rules and infrastructure concerns (file system, logging backends, storage strategies). The async nature of amphp makes dependency inversion especially valuable — infrastructure implementations can be swapped (file vs async-file vs cached storage) without touching business logic.

## Decision Rationale
- **Project type:** Long-running async CLI tool with multiple monitoring strategies
- **Tech stack:** PHP 8.4, amphp, Symfony Console (no framework container)
- **Key factor:** Multiple storage backends and logging adapters demand clean separation via interfaces

## Folder Structure
```
src/                                    # PSR-4 root (App\)
├── Domain/                             # Inner layer — pure business logic, zero dependencies
│   ├── Model/                          # Entities and Value Objects
│   │   ├── LogFile.php                 # Value Object — immutable file reference
│   │   ├── LogEntry.php                # Value Object — parsed log line
│   │   ├── FilePosition.php            # Value Object — read position in a file
│   │   ├── Project.php                 # Aggregate Root — project configuration
│   │   └── PositionTracker.php         # Domain Service — coordinates position persistence
│   └── Repository/                     # Interfaces only (contracts for Infrastructure)
│       ├── LogFileRepository.php       # Contract for file discovery and reading
│       └── PositionRepository.php      # Contract for position storage
├── Application/                        # Use cases — depends on Domain only
│   ├── Configuration/                  # Config loading and validation
│   │   ├── ProjectConfiguration.php    # YAML config parser → Project models
│   │   └── EnvironmentConfiguration.php # Environment/dotenv loading
│   └── Monitoring/                     # Core use case
│       └── LogMonitor.php              # Orchestrates monitoring loop
├── Infrastructure/                     # Outer layer — implements Domain interfaces
│   ├── FileSystem/                     # File discovery implementation
│   │   └── LogFileFinder.php           # Implements LogFileRepository (amphp/file)
│   ├── Logging/                        # Logging adapters
│   │   ├── MonologAdapter.php          # Forwards LogEntry to Monolog
│   │   ├── BuggregatorHandler.php      # Custom Monolog handler for Buggregator
│   │   ├── LoggerFactory.php           # Creates configured Monolog instances
│   │   └── DebugLogger.php             # Conditional debug output
│   └── Storage/                        # Position persistence implementations
│       ├── FilePositionRepository.php       # Sync file storage (implements PositionRepository)
│       ├── AsyncFilePositionRepository.php  # Async file storage (implements PositionRepository)
│       ├── CachedPositionRepository.php     # In-memory cache + periodic flush (decorator)
│       └── PositionStorageFactory.php       # Factory for storage backend selection
└── Console/                            # Outermost layer — composition root
    ├── MonitorCommand.php              # Wires all dependencies, runs the app
    └── console.php                     # Entry point (bootstraps Symfony Console)
```

## Dependency Rules

Dependencies flow strictly **inward** — from Console → Infrastructure → Application → Domain.

- ✅ `Domain\Model` depends on **nothing** (pure PHP, no vendor imports)
- ✅ `Domain\Repository` defines **interfaces only** — no implementations
- ✅ `Application\Monitoring` depends on `Domain\Model` and `Domain\Repository` interfaces
- ✅ `Infrastructure\Storage` implements `Domain\Repository\PositionRepository`
- ✅ `Infrastructure\FileSystem` implements `Domain\Repository\LogFileRepository`
- ✅ `Console\MonitorCommand` wires everything together (composition root)
- ❌ `Domain` must **never** import from `Application`, `Infrastructure`, or `Console`
- ❌ `Application` must **never** import from `Infrastructure` or `Console`
- ❌ `Infrastructure` must **never** import from `Console`

**Known deviation:** `LogMonitor` (Application layer) currently imports `DebugLogger` and `MonologAdapter` from Infrastructure. These should ideally be interfaces in Domain, but the pragmatic cost of abstracting debug logging is low given the project's scope.

## Layer/Module Communication

- **Domain ↔ Application:** Application creates Domain models and calls their methods directly. No events or message bus — direct method calls.
- **Application ↔ Infrastructure:** Via **Dependency Inversion**. Application depends on Domain interfaces (`PositionRepository`, `LogFileRepository`); Infrastructure provides implementations. Wiring happens in Console (composition root).
- **Infrastructure ↔ Console:** Console instantiates Infrastructure classes and injects them into Application services. Manual wiring — no DI container.
- **Storage Strategy Selection:** `PositionStorageFactory` (Infrastructure) uses the **Factory Pattern** to select the appropriate `PositionRepository` implementation based on YAML configuration.

## Key Principles

1. **Dependency Inversion** — Domain defines contracts (interfaces); Infrastructure implements them. New storage backends (Redis, database) require only a new class implementing `PositionRepository`, with no changes to Domain or Application.

2. **Value Objects are Immutable** — `LogFile`, `LogEntry`, `FilePosition` are `readonly` classes. They carry data and behavior (e.g., `LogFile::isNewerThan()`) but have no identity — equality is by value.

3. **Composition Root in Console** — `MonitorCommand::execute()` is the only place where all dependencies are manually wired. No service container, no auto-wiring. This keeps the dependency graph explicit and auditable.

4. **Async as Infrastructure Detail** — The Domain layer is synchronous pure PHP. Async behavior (amphp, `PeriodicLoop`) lives in Application and Infrastructure layers only. Domain models are testable without any async runtime.

5. **Factory for Strategy Selection** — `PositionStorageFactory` encapsulates the decision of which `PositionRepository` to instantiate based on config (`file`, `async-file`, `cached`). Adding a new backend means adding a case to the factory.

## Code Examples

### Adding a New Position Storage Backend

To add a Redis-based position storage, create the implementation in Infrastructure and register it in the factory:

```php
<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Domain\Model\FilePosition;
use App\Domain\Repository\PositionRepository;

final class RedisPositionRepository implements PositionRepository
{
    public function __construct(
        private \Redis $redis,
        private string $prefix = 'logmonitor:positions:',
    ) {}

    public function savePosition(FilePosition $position): void
    {
        $key = $this->prefix . $position->projectName . ':' . md5($position->filePath);
        $this->redis->set($key, json_encode([
            'file_path' => $position->filePath,
            'position' => $position->position,
            'project_name' => $position->projectName,
            'updated_at' => $position->updatedAt->format('c'),
        ]));
    }

    public function loadPosition(string $logFile, string $projectName): null|FilePosition
    {
        $key = $this->prefix . $projectName . ':' . md5($logFile);
        $data = $this->redis->get($key);

        if ($data === false) {
            return null;
        }

        $decoded = json_decode($data, true);
        return new FilePosition(
            filePath: $decoded['file_path'],
            position: $decoded['position'],
            projectName: $decoded['project_name'],
        );
    }

    // ... implement remaining interface methods
}
```

Then register in the factory — no changes needed in Domain or Application:

```php
// In PositionStorageFactory::createRepository()
return match ($type) {
    'file' => $this->createFileRepository($storagePath),
    'async-file' => $this->createAsyncFileRepository($storagePath),
    'cached' => $this->createCachedRepository($storagePath, $saveInterval),
    'redis' => $this->createRedisRepository($config),
    default => throw new \InvalidArgumentException("Unsupported type: {$type}"),
};
```

### Domain Model with Behavior (Value Object)

```php
<?php

declare(strict_types=1);

namespace App\Domain\Model;

use DateTimeImmutable;

final readonly class LogFile
{
    public function __construct(
        public string $path,
        public string $filename,
        public DateTimeImmutable $lastModified,
        public int $size,
    ) {}

    public function isNewerThan(LogFile $other): bool
    {
        return $this->lastModified > $other->lastModified;
    }

    public function equals(LogFile $other): bool
    {
        return $this->path === $other->path;
    }
}
```

## Anti-Patterns

- ❌ **Do NOT import Infrastructure classes in Domain** — If you need a new capability in Domain, define an interface there and implement it in Infrastructure.
- ❌ **Do NOT add framework dependencies to Domain** — Domain must remain pure PHP. No Symfony, no amphp, no Monolog imports in `Domain/`.
- ❌ **Do NOT instantiate services outside the Console layer** — All wiring belongs in `MonitorCommand`. Infrastructure classes can create other Infrastructure classes (e.g., `PositionStorageFactory`), but Application services should receive their dependencies via constructor injection.
- ❌ **Do NOT make Value Objects mutable** — All models in `Domain/Model/` must use `readonly class`. State changes produce new instances, never mutations.
- ❌ **Do NOT bypass the Repository interface** — Even for "quick" file reads, go through `LogFileRepository`. Direct `file_get_contents()` calls in Application or Domain break the architecture boundary.
