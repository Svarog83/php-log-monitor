# Requirements

## Project Goal

Create a simple tool in PHP to monitor log files in specified directories, detect changes, and forward new log entries to Monolog.

## Core Requirements

### 1. Log File Monitoring
- Monitor list of passed directories
- Search for log files in monitored directories
- Monitor changes in the latest log file
- Switch to new latest file when it appears
- Stop monitoring previous file when new one is detected

### 2. Log Entry Processing
- Detect new lines in log files
- Parse log entries (JSON format expected)
- Send new log entries to Monolog logger
- Support logstash format: `logstash-2025-07-24.json`

### 3. Configuration
- Configurable project names
- Configurable monitored folders per project
- Support multiple projects simultaneously

### 4. Performance Requirements
- Light, fast, and non-blocking
- Use amphp with async file access
- React to changes as soon as possible
- Minimal CPU consumption
- Consider using danog/loop package

### 5. Technical Requirements
- PHP 8.3+
- SOLID principles
- DDD (Domain-Driven Design) approach
- Clean, readable, and modern code
- PHPStan level 9 compliance

## Non-Functional Requirements

- **Maintainability**: Clean architecture with clear separation of concerns
- **Extensibility**: Easy to add new features and integrations
- **Reliability**: Proper error handling and logging
- **Performance**: Efficient file monitoring with minimal resource usage 