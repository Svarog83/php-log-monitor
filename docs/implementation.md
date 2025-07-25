# Implementation

## Implementation Strategy

The solution uses a **periodic monitoring approach** with **async file operations** to achieve non-blocking, efficient log file monitoring.

## Core Implementation Components

### 1. File Monitoring Strategy

**Approach**: Periodic scanning with file size tracking
- Scan directories every N seconds (configurable interval)
- Track file size to detect changes
- Switch to newest file when detected
- Read only new content since last position

**Benefits**:
- Minimal CPU usage
- No file system watchers required
- Works across different operating systems
- Simple and reliable

### 2. Async Operations

**amphp Integration**:
- Uses `Amp\delay()` for non-blocking delays
- Periodic operations don't block the main thread
- Efficient resource utilization

**danog/loop Integration**:
- `PeriodicLoop` for scheduled monitoring
- Automatic pause/resume functionality
- Built-in error handling and recovery

### 3. Log File Detection

**Pattern Matching**:
- Supports glob patterns (e.g., `logstash-*.json`)
- Converts to regex for precise matching
- Handles date-based filenames

**Latest File Selection**:
- Compares modification timestamps
- Automatically switches to newest file
- Maintains monitoring continuity

### 4. Log Entry Processing

**JSON Parsing**:
- Expects JSON log entries (one per line)
- Extracts timestamp, level, and message
- Handles malformed JSON gracefully

**Monolog Integration**:
- Maps log levels to Monolog levels
- Preserves metadata and context
- Structured logging with source file information

## Key Implementation Decisions

### 1. Native PHP vs Async File Operations

**Decision**: Use native PHP file operations
**Reason**: Simpler implementation, better compatibility, sufficient performance for monitoring use case

### 2. Periodic Scanning vs File System Events

**Decision**: Periodic scanning
**Reason**: Cross-platform compatibility, no external dependencies, simpler error handling

### 3. File Size Tracking vs Line Counting

**Decision**: File size tracking
**Reason**: More efficient, handles file truncation, simpler implementation

### 4. Single vs Multiple Monitor Instances

**Decision**: Multiple instances per project
**Reason**: Better isolation, independent error handling, easier debugging

## Performance Optimizations

1. **Efficient File Reading**: Only read new content since last position
2. **Minimal Directory Scanning**: Scan only when needed
3. **Configurable Intervals**: Adjust monitoring frequency per use case
4. **Memory Management**: Process logs line by line, don't load entire files

## Error Handling Strategy

1. **Graceful Degradation**: Continue monitoring on file errors
2. **Logging**: Record errors in application logs
3. **Recovery**: Automatic retry on temporary failures
4. **Validation**: Validate configuration and file paths early

## Testing Approach

1. **Unit Tests**: Test individual components
2. **Integration Tests**: Test component interactions
3. **Configuration Tests**: Validate YAML parsing
4. **Error Scenarios**: Test error handling paths 