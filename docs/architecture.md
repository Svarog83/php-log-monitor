# Architecture

## Architectural Approach

The system follows **Clean Architecture** principles with **Domain-Driven Design (DDD)** patterns, ensuring clear separation of concerns and maintainability.

## Architecture Layers

```
┌─────────────────────────────────────┐
│           Console Layer             │ ← CLI Interface
├─────────────────────────────────────┤
│         Application Layer           │ ← Use Cases & Orchestration
├─────────────────────────────────────┤
│          Domain Layer               │ ← Business Logic & Entities
├─────────────────────────────────────┤
│       Infrastructure Layer          │ ← External Concerns
└─────────────────────────────────────┘
```

## Layer Responsibilities

### Domain Layer
- **Models**: Core business entities (`LogFile`, `Project`, `LogEntry`, `FilePosition`)
- **Repository Interface**: Abstract data access (`LogFileRepository`, `PositionRepository`)
- **Value Objects**: Immutable data structures
- **Domain Services**: Business logic coordination (`PositionTracker`)

### Application Layer
- **Configuration**: Project configuration management
- **Monitoring**: Main application service orchestrating monitoring
- **Use Cases**: High-level application workflows

### Infrastructure Layer
- **File System**: File operations and monitoring
- **Logging**: Monolog integration and adapters
- **Repository Implementation**: Concrete data access
- **Storage**: Position tracking storage implementations

### Console Layer
- **CLI Commands**: User interface and command handling
- **Input/Output**: User interaction and feedback

## Key Design Patterns

### 1. Repository Pattern
- Abstract data access through interfaces
- Domain layer independent of infrastructure
- Easy to swap implementations

### 2. Adapter Pattern
- MonologAdapter bridges domain and infrastructure
- Consistent interface for different logging backends
- PositionStorageFactory creates appropriate storage implementations

### 3. Value Object Pattern
- Immutable domain objects
- Self-validating and business-rule enforcing

### 4. Dependency Injection
- Loose coupling between components
- Testable and maintainable code

## Technology Stack

- **PHP 8.3**: Modern PHP features and type safety
- **amphp**: Async programming primitives
- **danog/loop**: Periodic task execution
- **Monolog**: Logging framework
- **Symfony Console**: CLI framework
- **Symfony YAML**: Configuration parsing

## Monitoring Strategy

The system uses an **efficient single-file monitoring approach** with **position tracking**:

1. **Startup Initialization**: Find the latest log file across all monitored directories
2. **Position Loading**: Load saved positions for persistent tracking between runs
3. **Single File Tracking**: Monitor only the current latest file for changes
4. **Smart Switching**: Switch to new file only when current becomes inaccessible
5. **Position Saving**: Save current position after processing new content
6. **Performance Focus**: Minimize I/O operations by avoiding continuous directory scanning

## SOLID Principles

- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Interfaces can be substituted
- **Interface Segregation**: Focused, specific interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions 