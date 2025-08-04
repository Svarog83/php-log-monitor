# Log Monitor

A modern, async log monitoring tool built with PHP 8.3, amphp, and danog/loop. Monitors log files for changes and forwards new log entries to Monolog.

## Features

- **Async & Non-blocking**: Uses amphp for efficient async file operations
- **Configurable**: YAML-based project configuration
- **Modern Architecture**: Built with SOLID principles and DDD patterns
- **Multiple Projects**: Monitor multiple projects simultaneously
- **Real-time Monitoring**: Detects new log files and monitors changes
- **Position Tracking**: Maintains file positions between runs to avoid reprocessing
- **Flexible Storage**: Support for different position storage backends (file, Redis, database)
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
    position_storage:
      type: "cached"
      path: "var/positions"
      save_interval_seconds: 30
  
  api:
    directories:
      - /var/log/api
    log_pattern: "api-*.json"
    position_storage:
      type: "cached"
      path: "var/positions"
      save_interval_seconds: 30
```

📁 **See [config/projects-example.yaml](./config/projects-example.yaml) for a complete example with all options**

## Usage

### Basic Usage

#### Monitor all projects:
```bash
php src/console.php config/projects.yaml
```

#### Monitor specific project:
```bash
php src/console.php config/projects.yaml --project=myapp
```

#### Custom scan interval:
```bash
php src/console.php config/projects.yaml --interval=0.5
```

#### Debug mode:
```bash
php src/console.php config/projects.yaml --debug
```

### Background Execution (Production)

For production environments, run the monitor in the background:

#### Start the monitor:
```bash
nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &
```

#### Check if running:
```bash
ps aux | grep "php src/console.php" | grep -v grep
```

#### View logs:
```bash
tail -f var/log/monitor.log
```

#### Stop the monitor:
```bash
pkill -f "php src/console.php"
```

#### Restart the monitor:
```bash
pkill -f "php src/console.php" && nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &
```

### Using the Management Script

For easier management, use the provided script:

```bash
# Start the monitor
./scripts/monitor.sh start

# Start with debug output
./scripts/monitor.sh start --debug

# Check status
./scripts/monitor.sh status

# View logs
./scripts/monitor.sh logs

# Stop the monitor
./scripts/monitor.sh stop

# Restart the monitor
./scripts/monitor.sh restart

# Restart with debug output
./scripts/monitor.sh restart --debug
```

📖 **For detailed deployment instructions, see [Deployment Guide](./docs/deployment.md)**

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
- [Position Tracking](./docs/position-tracking.md) - Position tracking feature guide
- [Deployment](./docs/deployment.md) - Production deployment and operations guide
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