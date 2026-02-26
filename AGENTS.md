# AGENTS.md

> Project map for AI agents. Keep this file up-to-date as the project evolves.

## Project Overview
Async PHP log monitoring tool that watches directories for log file changes, tracks read positions, and forwards new entries to Monolog/Buggregator. Built with amphp and danog/loop on PHP 8.4.

## Tech Stack
- **Language:** PHP 8.4 (strict types)
- **Async Runtime:** amphp v3 + danog/loop
- **CLI:** Symfony Console 7.x
- **Config:** Symfony YAML 7.x
- **Logging:** Monolog 3.x + Buggregator
- **Static Analysis:** PHPStan (level 9), Mago
- **Testing:** PHPUnit 10
- **CI:** GitHub Actions

## Project Structure
```
├── src/                        # Main application source (PSR-4: App\)
│   ├── Domain/                 # Core business logic
│   │   ├── Model/              # Value objects & entities (LogFile, LogEntry, FilePosition, Project, PositionTracker)
│   │   └── Repository/         # Repository interfaces (LogFileRepository, PositionRepository)
│   ├── Application/            # Use cases & orchestration
│   │   ├── Configuration/      # Config loading (ProjectConfiguration, EnvironmentConfiguration)
│   │   └── Monitoring/         # Main monitor service (LogMonitor)
│   ├── Infrastructure/         # External concerns
│   │   ├── FileSystem/         # Async file operations (LogFileFinder)
│   │   ├── Logging/            # Monolog adapters (MonologAdapter, BuggregatorHandler, LoggerFactory)
│   │   └── Storage/            # Position persistence (File, AsyncFile, Cached repositories + factory)
│   ├── Console/                # CLI interface (MonitorCommand)
│   ├── console.php             # CLI entry point
│   ├── checks.php              # Standalone check scripts
│   └── fibers.php              # Fiber experiments
├── ts/                         # TypeScript port (separate package.json)
│   ├── src/                    # TS source code
│   └── tests/                  # TS tests
├── config/                     # YAML project configurations
├── tests/                      # PHPUnit tests
├── docs/                       # Comprehensive documentation
├── examples/                   # Demo scripts (position tracking, graceful shutdown)
├── scripts/                    # Management script (monitor.sh)
├── docker/                     # Docker setup (VPN/Transmission — separate concern)
├── var/                        # Runtime data (logs, positions, cache — gitignored)
├── vendor/                     # Composer dependencies (gitignored)
├── composer.json               # PHP dependencies
├── phpstan.neon                # PHPStan config (level 9)
├── phpunit.xml                 # PHPUnit config
└── mago.toml                   # Mago linter/formatter config
```

## Key Entry Points
| File | Purpose |
|------|---------|
| `src/console.php` | CLI entry point — wires dependencies, runs Symfony Console |
| `src/Application/Monitoring/LogMonitor.php` | Core monitoring service using danog/loop |
| `src/Console/MonitorCommand.php` | Symfony Console command definition |
| `config/projects.yaml` | Active project monitoring configuration |
| `composer.json` | PHP dependencies and autoloading |

## Commands
| Command | Purpose |
|---------|---------|
| `php src/console.php config/projects.yaml` | Run the log monitor |
| `./vendor/bin/phpstan analyse` | Static analysis (level 9) |
| `./vendor/bin/phpunit` | Run tests |
| `/usr/local/bin/mago lint` | Mago linting |
| `/usr/local/bin/mago fmt --dry-run` | Mago formatting check |

## Documentation
| Document | Path | Description |
|----------|------|-------------|
| README | `README.md` | Project landing page |
| Requirements | `docs/requirements.md` | Project specifications and goals |
| Architecture | `docs/architecture.md` | System design, layers, and patterns |
| Implementation | `docs/implementation.md` | Technical implementation details |
| API Reference | `docs/api-reference.md` | Key classes and interfaces |
| Configuration | `docs/configuration.md` | YAML config, env vars, CLI options |
| Position Tracking | `docs/position-tracking.md` | Position tracking feature guide |
| Deployment | `docs/deployment.md` | Production deployment and operations |
| Graceful Shutdown | `docs/graceful-shutdown.md` | Signal handling and safe shutdown |
| LLM Guide | `docs/llm-guide.md` | Quick reference for AI assistants |

## AI Context Files
| File | Purpose |
|------|---------|
| `AGENTS.md` | This file — project structure map |
| `.ai-factory/DESCRIPTION.md` | Project specification and tech stack |
| `.ai-factory/ARCHITECTURE.md` | Architecture decisions and guidelines |
| `docs/llm-guide.md` | Quick reference for AI assistants |
