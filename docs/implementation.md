# Implementation

## Implementation Strategy

The solution uses a **periodic monitoring approach** with **true async file operations** to achieve non-blocking, efficient log file monitoring.

## Core Implementation Components

### 1. File Monitoring Strategy

**Approach**: Latest file tracking with startup initialization
- Find latest log file once at startup
- Monitor only the current latest file for changes
- Switch to new file only when current becomes inaccessible
- Read only new content since last position

**Benefits**:
- Minimal CPU usage (no continuous directory scanning)
- No file system watchers required
- Works across different operating systems
- Simple and reliable
- Improved performance with reduced I/O operations

### 2. Async Operations

**amphp Integration**:
- Uses `Amp\delay()` for non-blocking delays
- Uses `amphp/file` for true async file operations
- Periodic operations don't block the main thread
- Efficient resource utilization

**danog/loop Integration**:
- `PeriodicLoop` for scheduled monitoring
- Automatic pause/resume functionality
- Built-in error handling and recovery

### 3. Async File Operations

**amphp/file Implementation**:
- `Filesystem::listFiles()` for async directory scanning
- `Filesystem::getStatus()` for async file metadata
- `Filesystem::openFile()` for async file reading
- `File::seek()` and `File::read()` for async content reading
- Automatic driver selection (UV, EIO, or Parallel)

**Benefits of Async File I/O**:
- Non-blocking file operations
- Better performance under high I/O load
- Scalable to multiple concurrent operations
- Proper error handling with exceptions

### 4. Log File Detection

**Pattern Matching**:
- Supports glob patterns (e.g., `logstash-*.json`)
- Converts to regex for precise matching
- Handles date-based filenames

**Latest File Selection**:
- Compares modification timestamps
- Finds latest file at startup only
- Automatically switches to new file when current becomes inaccessible
- Maintains monitoring continuity with minimal directory scanning

### 5. Log Entry Processing

**JSON Parsing**:
- Expects JSON log entries (one per line)
- Extracts timestamp, level, and message
- Handles malformed JSON gracefully

**Monolog Integration**:
- Maps log levels to Monolog levels
- Preserves metadata and context
- Structured logging with source file information

### 6. Enhanced Logging System

**Multi-Handler Logging**:
- File logging with JSON formatter
- Console output with JSON formatter
- Buggregator integration for real-time debugging

**Buggregator Integration**:
- Custom SocketHandler for TCP connection
- JSON formatter for structured output
- Error suppression for connection issues
- Configurable host and port

**Symfony VarDumper Integration**:
- Server dumper for remote debugging
- Configurable via environment variables
- Automatic initialization on startup

### 7. Environment Configuration

**Configuration Management**:
- `.env` file support via Symfony Dotenv
- Environment-specific settings
- Default values for all configurations
- Type-safe configuration access

## Key Implementation Decisions

### 1. Async File Operations vs Native PHP

**Decision**: Use amphp/file for true async file operations
**Reason**: Non-blocking I/O, better performance, proper async architecture

### 2. Periodic Scanning vs File System Events

**Decision**: Periodic scanning
**Reason**: Cross-platform compatibility, no external dependencies, simpler error handling

### 3. File Size Tracking vs Line Counting

**Decision**: File size tracking
**Reason**: More efficient, handles file truncation, simpler implementation

### 4. Single vs Multiple Monitor Instances

**Decision**: Multiple instances per project
**Reason**: Better isolation, independent error handling, easier debugging

### 5. Enhanced Logging vs Simple Output

**Decision**: Multi-handler logging with Buggregator
**Reason**: Better debugging capabilities, structured logging, real-time monitoring

## Performance Optimizations

1. **Efficient File Reading**: Only read new content since last position
2. **Smart File Tracking**: Find latest file at startup, monitor only that file
3. **Minimal Directory Scanning**: Scan directories only when current file becomes inaccessible
4. **Configurable Intervals**: Adjust monitoring frequency per use case
5. **Memory Management**: Process logs line by line, don't load entire files
6. **Async I/O**: Non-blocking file operations prevent thread blocking
7. **JSON Formatting**: Efficient structured logging
8. **Connection Pooling**: Persistent connections where possible

## Error Handling Strategy

1. **Graceful Degradation**: Continue monitoring on file errors
2. **Logging**: Record errors in application logs
3. **Recovery**: Automatic retry on temporary failures
4. **Validation**: Validate configuration and file paths early
5. **Connection Error Suppression**: Handle network issues gracefully

## Testing Approach

1. **Unit Tests**: Test individual components
2. **Integration Tests**: Test component interactions
3. **Configuration Tests**: Validate YAML parsing
4. **Error Scenarios**: Test error handling paths
5. **Environment Tests**: Test configuration loading 