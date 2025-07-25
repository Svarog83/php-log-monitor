# Configuration

## Environment Configuration

The application uses environment variables for configuration. Create a `.env` file in the project root:

```bash
# Symfony VarDumper Configuration
VAR_DUMPER_FORMAT=server
VAR_DUMPER_SERVER=host.docker.internal:9912

# Logging Configuration
LOG_PATH="var/log/logstash-%s.json"

# Buggregator Configuration
BUGGREGATOR_HOST=host.docker.internal
BUGGREGATOR_PORT=9913
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VAR_DUMPER_FORMAT` | `server` | VarDumper output format |
| `VAR_DUMPER_SERVER` | `host.docker.internal:9912` | VarDumper server address |
| `LOG_PATH` | `var/log/logstash-%s.json` | Log file path pattern (%s = date) |
| `BUGGREGATOR_HOST` | `host.docker.internal` | Buggregator host |
| `BUGGREGATOR_PORT` | `9913` | Buggregator port |

## Project Configuration

Projects are configured using YAML files. The configuration defines which directories to monitor and what log files to look for.

### Configuration Format

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

  web:
    directories:
      - /var/log/nginx
      - /var/log/apache
    log_pattern: "access-*.log"
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `directories` | array | Yes | List of directories to monitor |
| `log_pattern` | string | No | File pattern to match (default: `logstash-*.json`) |

### Pattern Examples

- `logstash-*.json` - Matches logstash files
- `api-*.json` - Matches API log files
- `access-*.log` - Matches access log files
- `app-*.log` - Matches application log files

## CLI Usage

### Basic Usage

```bash
# Monitor all projects
php src/console.php config/projects.yaml

# Monitor specific project
php src/console.php config/projects.yaml --project=myapp

# Custom scan interval
php src/console.php config/projects.yaml --interval=2.0

# Custom environment file
php src/console.php config/projects.yaml --env-file=.env.local
```

### Command Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--project` | `-p` | All projects | Specific project to monitor |
| `--interval` | `-i` | `1.0` | Scan interval in seconds |
| `--env-file` | `-e` | `.env` | Environment file path |

## Logging Configuration

### Log Output

The application logs to multiple destinations:

1. **File Logs**: JSON-formatted logs in `var/log/logstash-YYYY-MM-DD.json`
2. **Console Output**: JSON-formatted logs to stdout
3. **Buggregator**: Real-time logs sent to Buggregator server

### Log Format

All logs are formatted as JSON with the following structure:

```json
{
  "message": "Log message",
  "context": {
    "source_file": "logstash-2025-01-27.json",
    "timestamp": "2025-01-27 10:30:45",
    "metadata": {
      "level": "info",
      "additional": "data"
    }
  },
  "level": 200,
  "level_name": "INFO",
  "channel": "log-monitor",
  "datetime": "2025-01-27T10:30:45.123456+00:00",
  "extra": []
}
```

## Validation

### Configuration Validation

The application validates:

1. **Project Names**: Must not be empty
2. **Directories**: Must exist and be accessible
3. **Patterns**: Must be valid glob patterns
4. **Environment Variables**: Must have valid values

### Error Handling

- Invalid configurations cause immediate failure
- Missing directories are logged as warnings
- Network errors (Buggregator) are suppressed
- File access errors are logged but don't stop monitoring

## Examples

### Development Setup

```yaml
# config/projects.yaml
projects:
  dev:
    directories:
      - ./logs
    log_pattern: "app-*.log"
```

```bash
# .env
VAR_DUMPER_FORMAT=server
VAR_DUMPER_SERVER=localhost:9912
LOG_PATH="logs/app-%s.log"
BUGGREGATOR_HOST=localhost
BUGGREGATOR_PORT=9913
```

### Production Setup

```yaml
# config/projects.yaml
projects:
  production:
    directories:
      - /var/log/application
      - /var/log/nginx
    log_pattern: "*.json"
```

```bash
# .env
VAR_DUMPER_FORMAT=server
VAR_DUMPER_SERVER=monitoring.internal:9912
LOG_PATH="/var/log/monitor-%s.json"
BUGGREGATOR_HOST=monitoring.internal
BUGGREGATOR_PORT=9913
``` 