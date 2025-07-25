# Log Monitor

A modern, async log monitoring tool built with PHP 8.3, amphp, and danog/loop. Monitors log files for changes and forwards new log entries to Monolog.

## Features

- **Async & Non-blocking**: Uses amphp for efficient async file operations
- **Configurable**: YAML-based project configuration
- **Modern Architecture**: Built with SOLID principles and DDD patterns
- **Multiple Projects**: Monitor multiple projects simultaneously
- **Real-time Monitoring**: Detects new log files and monitors changes
- **Monolog Integration**: Forwards log entries to Monolog with proper level mapping

## Requirements

- PHP 8.3+
- Composer

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   composer install
   ```

## Configuration

Create a YAML configuration file (e.g., `config/projects.yaml`):

```yaml
projects:
  myapp:
    directories:
      - /var/log/myapp
      - /opt/myapp/logs
    log_pattern: "logstash-*.json"
  
  api:
    directories:
      - /var/log/api
    log_pattern: "api-*.json"
```

## Usage

### Monitor all projects:
```bash
php src/console.php config/projects.yaml
```

### Monitor specific project:
```bash
php src/console.php config/projects.yaml --project=myapp
```

### Custom scan interval:
```bash
php src/console.php config/projects.yaml --interval=0.5
```

### Custom log output:
```bash
php src/console.php config/projects.yaml --log-file=/var/log/monitor.log
```

## Architecture

The application follows Clean Architecture principles with clear separation of concerns:

- **Domain Layer**: Core business logic and entities
- **Application Layer**: Use cases and orchestration
- **Infrastructure Layer**: External concerns (file system, logging)
- **Console Layer**: CLI interface

### Key Components

- `LogFile`: Value object representing a log file
- `Project`: Aggregate root for project configuration
- `LogMonitor`: Main application service using danog/loop
- `LogFileFinder`: Async file system operations
- `MonologAdapter`: Integration with Monolog

## Documentation

📚 **Comprehensive documentation** is available in the [`docs/`](./docs/) folder:

- [Requirements](./docs/requirements.md) - Project specifications and goals
- [Architecture](./docs/architecture.md) - System design and patterns
- [Implementation](./docs/implementation.md) - Technical implementation details
- [API Reference](./docs/api-reference.md) - Key classes and interfaces
- [Configuration](./docs/configuration.md) - Configuration format and options
- [LLM Guide](./docs/llm-guide.md) - Quick reference for AI assistants

## Development

### Running PHPStan (Level 9):
```bash
./vendor/bin/phpstan analyse
```

### Running Tests:
```bash
./vendor/bin/phpunit
```

## License

MIT 