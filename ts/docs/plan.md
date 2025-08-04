# TypeScript Rewrite Plan for Log Monitor

## Project Goal
Rewrite the PHP log monitoring tool in modern TypeScript, maintaining all current functionality, with:
- Node.js runtime
- Modern async, type-safe, and testable code
- Hot-reloadable config
- OS file watch notifications
- Monolog/Buggregator compatibility
- Clean, robust, and well-tested architecture

## High-Level Steps
1. **Project Setup**
   - New folder: `ts/`
   - Node.js + TypeScript + ESLint + Prettier + Jest
   - Strict config, scripts, and dependencies
2. **Core Structure**
   - Domain, Application, Infrastructure, Console layers
   - Tests, config, and docs folders
3. **Domain Layer**
   - Models: Project, LogFile, LogEntry, FilePosition
   - Repository interfaces
   - Value objects/utilities
4. **Infrastructure Layer**
   - File system: Chokidar for watching
   - Storage: file/cached/async position repos
   - Logging: Winston + custom Monolog socket transport (Buggregator compatible)
5. **Application Layer**
   - Config loader/watcher (hot reload)
   - Monitoring service (orchestration)
6. **Console Layer**
   - CLI entrypoint (MonitorCommand)
7. **Testing**
   - Unit and integration tests for all logic
8. **Linting & Formatting**
   - ESLint/Prettier on all code
9. **Commit Workflow**
   - Test/lint before each commit
10. **Documentation**
   - Architecture, config, usage, Monolog/Buggregator integration

---

## Monolog/Buggregator Integration
- Use Winston for local logging
- Implement a custom Winston transport to send logs to Monolog/Buggregator via TCP socket
- Ensure JSON format and batch mode as required by Buggregator
- Environment/configurable host/port

---

## Migration Strategy
- Keep PHP version running
- Implement TS version in parallel
- Feature parity, test coverage, and performance comparison
- Document all changes and architecture
