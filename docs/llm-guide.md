# LLM Interaction Guide

## Quick Context for LLM

This is a **log monitoring tool** built with PHP 8.3, following **Clean Architecture** and **DDD** principles. It monitors log files and forwards entries to Monolog.

## Key Architecture Decisions

### 1. File Monitoring Approach
- **Periodic scanning** (not file system events)
- **File size tracking** for change detection
- **Native PHP file operations** (not async file I/O)
- **danog/loop** for periodic execution

### 2. Technology Stack
- **PHP 8.3** with strict types
- **amphp** for async primitives
- **danog/loop** for periodic tasks
- **Monolog** for logging
- **Symfony Console** for CLI
- **Symfony YAML** for configuration

### 3. Design Patterns
- **Repository Pattern** for data access
- **Adapter Pattern** for Monolog integration
- **Value Objects** for domain entities
- **Dependency Injection** for loose coupling

## Common Modification Scenarios

### Adding New Features
1. **Domain Layer**: Add new models/entities
2. **Application Layer**: Add new services/use cases
3. **Infrastructure Layer**: Add new adapters/implementations
4. **Console Layer**: Add new commands if needed

### Changing File Monitoring
- Modify `LogFileFinder` for different file operations
- Update `LogMonitor` for different monitoring strategies
- Adjust `LogFile` model for different file metadata

### Adding New Log Formats
- Extend `LogEntry::fromJsonLine()` method
- Add new parsing logic in domain layer
- Update `MonologAdapter` for new log levels

### Configuration Changes
- Modify `ProjectConfiguration` for new config options
- Update YAML schema in `configuration.md`
- Add validation in domain models

## Code Quality Standards

### PHPStan Level 9
- All code must pass PHPStan level 9
- Use proper type annotations
- Handle null cases explicitly
- Use `@phpstan-ignore-next-line` sparingly

### SOLID Principles
- **Single Responsibility**: One reason to change per class
- **Open/Closed**: Extend, don't modify existing code
- **Liskov Substitution**: Interfaces are substitutable
- **Interface Segregation**: Focused interfaces
- **Dependency Inversion**: Depend on abstractions

### DDD Patterns
- **Value Objects**: Immutable domain objects
- **Aggregates**: Project as aggregate root
- **Repositories**: Abstract data access
- **Domain Services**: Business logic coordination

## Testing Strategy

### Unit Tests
- Test domain models and business logic
- Mock external dependencies
- Test error scenarios

### Integration Tests
- Test component interactions
- Test configuration loading
- Test file system operations

## Common Pitfalls to Avoid

1. **Don't break the layered architecture**
2. **Don't add business logic to infrastructure layer**
3. **Don't skip PHPStan validation**
4. **Don't use blocking operations in async context**
5. **Don't hardcode file paths or patterns**

## Quick Reference Commands

```bash
# Run PHPStan
./vendor/bin/phpstan analyse

# Run tests
./vendor/bin/phpunit tests/

# Test CLI
php src/console.php config/projects.yaml --help
```

## File Structure Reminder

```
src/
├── Domain/          # Business logic & entities
├── Application/     # Use cases & orchestration
├── Infrastructure/  # External concerns
└── Console/         # CLI interface
```

## When Making Changes

1. **Read relevant docs** in `/docs/` folder
2. **Follow existing patterns** in similar files
3. **Update tests** for new functionality
4. **Run PHPStan** to ensure quality
5. **Update documentation** if needed 