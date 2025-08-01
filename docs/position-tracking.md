# Position Tracking

The log monitor now supports position tracking to maintain the last read position in each log file between different runs of the tool. This ensures that when you stop and restart the monitor, it continues from where it left off instead of re-processing old log entries.

## Features

- **Persistent Positions**: Save and restore file positions between runs
- **Flexible Storage**: Support for different storage backends (file, Redis, database)
- **Backward Compatibility**: Existing configurations work without position tracking
- **Project-Specific**: Each project can have its own position tracking configuration
- **Automatic Validation**: Positions are validated against current file state

## Configuration

### Basic Configuration

Add `position_storage` configuration to your project:

```yaml
projects:
  myapp:
    directories:
      - /var/log/myapp
    log_pattern: "logstash-*.json"
    position_storage:
      type: "file"
      path: "var/positions"
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | `cached` | Storage backend type (`file`, `async-file`, `cached`, `redis`, `database`) |
| `path` | string | `var/positions` | Storage path (for file storage) |
| `save_interval_seconds` | int | `30` | Save interval in seconds (for cached storage) |

### Storage Backends

#### File Storage (Synchronous)

Stores positions in JSON files using synchronous I/O:

```yaml
position_storage:
  type: "file"
  path: "var/positions"
```

**Characteristics:**
- ✅ Simple and reliable
- ⚠️ Can block monitoring operations
- ⚠️ May impact performance under high load
- ✅ Good for low-frequency updates

#### Async File Storage

Stores positions in JSON files using asynchronous I/O:

```yaml
position_storage:
  type: "async-file"
  path: "var/positions"
```

**Characteristics:**
- ✅ Non-blocking operations
- ✅ Better performance under high load
- ✅ Consistent with log file reading
- ✅ Good for production use

#### Cached Storage (Recommended)

Stores positions in memory with periodic file writes:

```yaml
position_storage:
  type: "cached"
  path: "var/positions"
  save_interval_seconds: 30
```

**Characteristics:**
- ✅ Fast in-memory access
- ✅ Reduced I/O overhead
- ✅ Configurable save intervals
- ✅ Graceful failure handling
- ✅ Recommended for high-frequency updates
- ✅ Automatic fallback to file storage

**File Structure:**
```
var/positions/
├── myapp_a1b2c3d4.json
├── myapp_e5f6g7h8.json
└── api_i9j0k1l2.json
```

**File Content:**
```json
{
  "file_path": "/var/log/myapp/logstash-2025-01-27.json",
  "position": 1024,
  "last_updated": "2025-01-27 10:30:00",
  "project_name": "myapp"
}
```

### Cached Storage Implementation

The cached storage uses a two-tier approach:

1. **Memory Cache**: All positions are stored in memory for fast access
2. **Periodic Persistence**: Positions are written to disk every X seconds
3. **Dirty Tracking**: Only modified positions are written to disk
4. **Graceful Degradation**: File write failures don't stop monitoring

**Cache Behavior:**
- Positions are immediately available in memory
- File writes happen every `save_interval_seconds`
- Failed writes are retried on next interval
- Cache persists until application shutdown
- Force save available for immediate persistence

#### Redis Storage (Future)

```yaml
position_storage:
  type: "redis"
  host: "localhost"
  port: 6379
  database: 0
```

#### Database Storage (Future)

```yaml
position_storage:
  type: "database"
  dsn: "mysql://user:pass@localhost/logmonitor"
  table: "positions"
```

## Usage

### Enable Position Tracking

1. Add position storage configuration to your project
2. Restart the monitor
3. Positions are automatically saved and restored

### Disable Position Tracking

Simply omit the `position_storage` configuration:

```yaml
projects:
  myapp:
    directories:
      - /var/log/myapp
    log_pattern: "logstash-*.json"
    # No position_storage = no position tracking
```

### Manual Position Management

You can manually manage positions using the CLI:

```bash
# Clear all positions for a project
rm -rf var/positions/myapp_*.json

# View current positions
ls -la var/positions/
```

## How It Works

### Position Loading

1. **Startup**: Load all saved positions for the project
2. **File Switch**: When switching to a new log file, load its saved position
3. **Validation**: Check if saved position is still valid (file exists, position within file size)

### Position Saving

1. **After Processing**: Save current position after processing new lines
2. **File Switch**: Save position when switching to a new file
3. **Error Handling**: Continue monitoring even if position saving fails

### Position Validation

Positions are validated to ensure they're still valid:

- **File Exists**: Check if the file still exists
- **Size Check**: Ensure position is within current file size
- **Age Check**: Positions older than 24 hours are considered invalid

## Architecture

### Domain Layer

- `FilePosition`: Value object representing a file position
- `PositionTracker`: Domain service for position management
- `PositionRepository`: Interface for position storage

### Infrastructure Layer

- `FilePositionRepository`: File-based position storage
- `PositionStorageFactory`: Factory for creating storage implementations

### Application Layer

- `LogMonitor`: Enhanced with position tracking
- `Project`: Extended with position storage configuration

## Error Handling

The system is designed to be resilient:

- **Storage Failures**: Continue monitoring without position tracking
- **Invalid Positions**: Reset to position 0 and continue
- **Missing Files**: Handle gracefully and switch to available files
- **Corrupted Data**: Skip invalid position files

## Performance Considerations

### Storage Type Comparison

**Synchronous Storage (`type: "file"`):**
- ⚠️ Can block monitoring operations
- ⚠️ May cause delays in log processing
- ✅ Simple and reliable
- ✅ Good for low-frequency updates

**Asynchronous Storage (`type: "async-file"`):**
- ✅ Non-blocking operations
- ✅ Consistent with log file reading
- ✅ Better performance under high load
- ✅ Good for production use

**Cached Storage (`type: "cached"`):**
- ✅ Fastest access (in-memory)
- ✅ Minimal I/O overhead
- ✅ Configurable persistence frequency
- ✅ Graceful failure handling
- ✅ Recommended for high-frequency updates
- ✅ Best for production environments

### General Performance Tips

- **Minimal Overhead**: Position operations are infrequent
- **Async Operations**: File operations use amphp for efficiency
- **Lazy Loading**: Positions are loaded only when needed
- **Batch Operations**: Multiple positions can be loaded at once
- **Error Resilience**: Position failures don't stop monitoring
- **Memory Caching**: Cached storage provides fastest access
- **Configurable Persistence**: Adjust save intervals based on needs
- **Dirty Tracking**: Only modified positions are written to disk

## Migration

### From Previous Versions

Existing configurations continue to work without changes. Position tracking is opt-in:

```yaml
# Old configuration (still works)
projects:
  myapp:
    directories:
      - /var/log/myapp
    log_pattern: "logstash-*.json"

# New configuration with position tracking
projects:
  myapp:
    directories:
      - /var/log/myapp
    log_pattern: "logstash-*.json"
    position_storage:
      type: "file"
      path: "var/positions"
```

### Storage Migration

To migrate between storage backends:

1. Stop the monitor
2. Export positions from current storage
3. Import positions to new storage
4. Update configuration
5. Restart monitor

## Troubleshooting

### Common Issues

**Positions not being saved:**
- Check storage directory permissions
- Verify configuration syntax
- Check debug logs for errors

**Positions not being loaded:**
- Verify position files exist
- Check file permissions
- Review validation logic

**Performance issues:**
- Monitor storage backend performance
- Consider using Redis for high-frequency updates
- Review position validation frequency

### Debug Information

Enable debug mode to see position tracking details:

```bash
php src/console.php config/projects.yaml --debug
```

Look for log entries with the 📍 emoji for position-related information.

## Future Enhancements

- **Redis Storage**: High-performance Redis backend
- **Database Storage**: SQL/NoSQL database support
- **Position Compression**: Compress position data for large files
- **Position Encryption**: Encrypt sensitive position data
- **Position Analytics**: Track position usage patterns
- **Distributed Storage**: Support for distributed position storage 