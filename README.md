# Log Monitor

> Async log file monitoring tool for PHP — watches directories, tracks positions, forwards entries to Monolog.

A modern, non-blocking log monitoring tool built with PHP 8.3, amphp, and danog/loop. Monitors log files for changes and forwards new log entries to Monolog using Clean Architecture and DDD patterns.

## Quick Start

```bash
composer install
cp config/projects-example.yaml config/projects.yaml
# Edit config/projects.yaml with your directories
php src/console.php config/projects.yaml
```

## Key Features

- **Async & Non-blocking** — amphp-powered async file I/O prevents blocking
- **Position Tracking** — resumes from last read position between restarts
- **Multi-Project** — monitor multiple projects simultaneously with independent configs
- **Flexible Storage** — file, async-file, or cached position backends
- **Monolog Integration** — forwards parsed entries with proper level mapping
- **Buggregator Support** — real-time log forwarding for debugging
- **Graceful Shutdown** — POSIX signal handling with position persistence

## Example

```bash
# Monitor all projects
php src/console.php config/projects.yaml

# Monitor specific project with 0.5s interval and debug output
php src/console.php config/projects.yaml --project=myapp --interval=0.5 --debug
```

```yaml
# config/projects.yaml
projects:
  myapp:
    directories:
      - /var/log/myapp
    log_pattern: "logstash-*.json"
    position_storage:
      type: "cached"
      path: "var/positions"
      save_interval_seconds: 30
```

## Requirements

- PHP 8.3+
- ext-pcntl (for graceful shutdown)

## Mago Lint

- `/usr/local/bin/mago lint` — check for issues
- `/usr/local/bin/mago analyze` — find type errors
- `/usr/local/bin/mago fmt --dry-run` — see formatting suggestions

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Requirements](docs/requirements.md) | Project specifications and goals |
| [Architecture](docs/architecture.md) | System design, layers, and patterns |
| [Implementation](docs/implementation.md) | Technical implementation details |
| [API Reference](docs/api-reference.md) | Key classes and interfaces |
| [Configuration](docs/configuration.md) | YAML config, env vars, CLI options |
| [Position Tracking](docs/position-tracking.md) | Position tracking feature guide |
| [Deployment](docs/deployment.md) | Production deployment and operations |
| [Graceful Shutdown](docs/graceful-shutdown.md) | Signal handling and safe shutdown |
| [LLM Guide](docs/llm-guide.md) | Quick reference for AI assistants |

## Development

```bash
./vendor/bin/phpstan analyse        # Static analysis (level 9)
./vendor/bin/phpunit                # Run tests
```

## License

MIT
