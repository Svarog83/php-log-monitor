# Configuration

## Configuration Format

The application uses YAML configuration files to define projects and their monitoring settings.

## Basic Configuration Structure

```yaml
projects:
  project_name:
    directories:
      - /path/to/log/directory1
      - /path/to/log/directory2
    log_pattern: "logstash-*.json"
```

## Configuration Options

### Project Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `directories` | array | Yes | - | List of directories to monitor |
| `log_pattern` | string | No | `logstash-*.json` | Pattern to match log files |

### Directory Paths

- **Absolute paths**: `/var/log/myapp`
- **Relative paths**: `./logs` (relative to working directory)
- **Multiple directories**: Monitor multiple locations for the same project

### Log File Patterns

- **Glob patterns**: `logstash-*.json`
- **Date patterns**: `app-2025-*.log`
- **Specific patterns**: `error-*.json`

## Example Configurations

### Single Project
```yaml
projects:
  myapp:
    directories:
      - /var/log/myapp
    log_pattern: "logstash-*.json"
```

### Multiple Projects
```yaml
projects:
  webapp:
    directories:
      - /var/log/nginx
      - /var/log/apache
    log_pattern: "access-*.log"
  
  api:
    directories:
      - /var/log/api
    log_pattern: "api-*.json"
  
  database:
    directories:
      - /var/log/mysql
      - /var/log/postgresql
    log_pattern: "db-*.log"
```

### Complex Pattern Matching
```yaml
projects:
  application:
    directories:
      - /opt/app/logs
      - /var/log/app
    log_pattern: "app-*-*.json"
```

## CLI Configuration Options

### Command Line Arguments
- `config`: Path to configuration file (required)

### Command Line Options
- `--project, -p`: Monitor specific project only
- `--interval, -i`: Scan interval in seconds (default: 1.0)
- `--log-file, -l`: Log output file (default: php://stdout)

## Usage Examples

### Monitor All Projects
```bash
php src/console.php config/projects.yaml
```

### Monitor Specific Project
```bash
php src/console.php config/projects.yaml --project=webapp
```

### Custom Scan Interval
```bash
php src/console.php config/projects.yaml --interval=0.5
```

### Custom Log Output
```bash
php src/console.php config/projects.yaml --log-file=/var/log/monitor.log
```

### Combined Options
```bash
php src/console.php config/projects.yaml \
  --project=api \
  --interval=2.0 \
  --log-file=/var/log/api-monitor.log
```

## Configuration Validation

The application validates configuration at startup:

1. **File existence**: Configuration file must exist
2. **YAML format**: Valid YAML syntax required
3. **Directory existence**: All specified directories must exist
4. **Project names**: Must be non-empty strings
5. **Pattern format**: Must be valid glob patterns

## Error Handling

- **Missing config file**: Application exits with error
- **Invalid YAML**: Detailed error message with line number
- **Missing directories**: Error for each non-existent directory
- **Invalid patterns**: Warning for malformed patterns

## Best Practices

1. **Use absolute paths** for production configurations
2. **Group related logs** in the same project
3. **Use descriptive project names** for easy identification
4. **Test patterns** with actual log files before deployment
5. **Monitor log file permissions** and access rights 