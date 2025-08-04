# Log Monitor - TypeScript Version

A modern, type-safe log monitoring tool written in TypeScript with Node.js runtime. This application monitors log files across multiple projects and forwards log entries to Monolog/Buggregator for centralized logging.

## Features

- **Multi-Project Monitoring**: Monitor log files across multiple projects simultaneously
- **Real-Time File Watching**: Uses Chokidar for efficient file system monitoring
- **Hot Reload Configuration**: Configuration changes are detected and applied without restart
- **Position Tracking**: Tracks file positions to avoid re-processing logs
- **Monolog/Buggregator Integration**: Forward logs to Monolog/Buggregator via TCP socket
- **Graceful Shutdown**: Proper signal handling for clean application termination
- **Environment-Driven Configuration**: Support for different environments (dev, prod, custom)
- **Comprehensive Logging**: Winston-based logging with file and console output
- **Type Safety**: Full TypeScript implementation with strict type checking

## Architecture

The application follows a clean architecture pattern with clear separation of concerns:

```
src/
├── domain/           # Domain models and business logic
│   ├── models/       # Core entities (Project, LogFile, LogEntry, etc.)
│   └── repositories/ # Repository interfaces
├── application/      # Application services and orchestration
│   ├── configuration/ # Configuration loading and management
│   └── monitoring/   # Log monitoring service
├── infrastructure/   # External dependencies and implementations
│   ├── filesystem/   # File system operations
│   ├── logging/      # Logging implementations
│   └── storage/      # Position storage implementations
└── console/          # CLI interface
```

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd loop/ts

# Install dependencies
npm install

# Build the application
npm run build
```

## Configuration

Create a YAML configuration file (default: `./config/projects.yaml`):

```yaml
projects:
  my-project:
    directories:
      - /var/log/my-project
      - /var/log/my-project/backup
    log_pattern: "*.log"
    position_storage:
      type: cached
      path: var/positions
      save_interval_seconds: 30
  
  another-project:
    directories:
      - /var/log/another-project
    log_pattern: "logstash-*.json"
    position_storage:
      type: async
      batch_size: 100
      flush_interval_seconds: 60
```

## Usage

### Basic Usage

```bash
# Start with default configuration
npm start

# Start with custom configuration file
npm start -- --config ./config/custom.yaml

# Start in production mode
npm start -- --env production

# Start with debug logging
npm start -- --log-level debug
```

### Command Line Options

- `-c, --config <path>`: Configuration file path (default: `./config/projects.yaml`)
- `-e, --env <environment>`: Environment (development, production, or custom)
- `-l, --log-level <level>`: Log level (error, warn, info, debug)
- `--monolog-host <host>`: Monolog/Buggregator host (default: localhost)
- `--monolog-port <port>`: Monolog/Buggregator port (default: 9912)
- `--log-dir <path>`: Log directory (default: `./var/log`)
- `-h, --help`: Show help information
- `-v, --version`: Show version information

### Environment Variables

- `MONOLOG_HOST`: Monolog/Buggregator host
- `MONOLOG_PORT`: Monolog/Buggregator port
- `LOG_DIR`: Log directory
- `CONFIG_PATH`: Configuration file path
- `LOG_LEVEL`: Log level

### Examples

```bash
# Development mode with debug logging
npm start -- --env development --log-level debug

# Production mode with custom Monolog host
npm start -- --env production --monolog-host 192.168.1.100 --monolog-port 9913

# Custom configuration with specific log directory
npm start -- --config ./config/production.yaml --log-dir /var/logs
```

## Position Storage Types

### File Storage
Simple file-based storage for position tracking.

```yaml
position_storage:
  type: file
  path: var/positions
```

### Cached Storage
In-memory caching with periodic saves to file.

```yaml
position_storage:
  type: cached
  path: var/positions
  save_interval_seconds: 30
  cache_timeout_seconds: 300
```

### Async Storage
Batched async saves for high-performance scenarios.

```yaml
position_storage:
  type: async
  path: var/positions
  batch_size: 100
  flush_interval_seconds: 60
```

## Monolog/Buggregator Integration

The application can forward logs to Monolog/Buggregator via TCP socket. Configure the connection:

```bash
# Set environment variables
export MONOLOG_HOST=localhost
export MONOLOG_PORT=9912

# Or use command line options
npm start -- --monolog-host localhost --monolog-port 9912
```

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Scripts

- `npm run build`: Build the TypeScript application
- `npm run dev`: Watch mode for development
- `npm start`: Run the application
- `npm test`: Run tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage
- `npm run lint`: Lint the code
- `npm run lint:fix`: Fix linting issues
- `npm run format`: Format the code
- `npm run clean`: Clean build artifacts
- `npm run type-check`: Type checking without emitting

## Testing

The application includes comprehensive tests:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete application workflows

Run tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=MonitorCommand.test.ts

# Run tests with coverage
npm run test:coverage
```

## Logging

The application uses Winston for logging with the following features:

- **Console Output**: Colored console logging for development
- **File Output**: Rotating file logs for production
- **Monolog Integration**: Forward logs to Monolog/Buggregator
- **Configurable Levels**: Error, warn, info, debug levels

## Signal Handling

The application handles various signals for graceful shutdown:

- `SIGINT` (Ctrl+C): Graceful shutdown
- `SIGTERM`: Graceful shutdown
- `SIGQUIT`: Graceful shutdown
- `uncaughtException`: Log error and shutdown
- `unhandledRejection`: Log error and shutdown

## Error Handling

The application includes robust error handling:

- **Configuration Errors**: Invalid configuration files
- **File System Errors**: Missing directories, permission issues
- **Network Errors**: Monolog connection failures
- **Process Errors**: Uncaught exceptions and unhandled rejections

## Performance Considerations

- **Efficient File Watching**: Uses Chokidar for optimized file system monitoring
- **Position Tracking**: Avoids re-processing log files
- **Batched Operations**: Async storage for high-throughput scenarios
- **Memory Management**: Proper cleanup and resource management

## Security

- **Input Validation**: All inputs are validated
- **File Permissions**: Respects file system permissions
- **Network Security**: Secure TCP connections to Monolog
- **Error Sanitization**: Sensitive information is not logged

## Troubleshooting

### Common Issues

1. **Configuration File Not Found**
   - Ensure the configuration file exists and is readable
   - Check the file path in the `--config` option

2. **Permission Denied**
   - Check file and directory permissions
   - Ensure the application has read access to log directories

3. **Monolog Connection Failed**
   - Verify Monolog/Buggregator is running
   - Check host and port configuration
   - Ensure network connectivity

4. **Position File Errors**
   - Check write permissions for position storage directory
   - Verify disk space availability

### Debug Mode

Enable debug logging for troubleshooting:

```bash
npm start -- --log-level debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Version History

- **1.0.0**: Initial TypeScript implementation with full feature parity
  - Multi-project log monitoring
  - Real-time file watching
  - Monolog/Buggregator integration
  - Hot reload configuration
  - Graceful shutdown handling
  - Comprehensive test coverage
