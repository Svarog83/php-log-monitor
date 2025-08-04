# Log Monitor (TypeScript Rewrite)

A modern, asynchronous log monitoring tool rewritten in TypeScript, designed for Node.js, with full compatibility for Monolog/Buggregator log forwarding. This project is a feature-parity rewrite of the original PHP version, with a focus on maintainability, type safety, extensibility, and robust real-time file monitoring.

---

## Why TypeScript & Node.js?
- **Type Safety:** TypeScript provides compile-time type checking, reducing runtime errors and improving code quality.
- **Modern Async I/O:** Node.js offers efficient, non-blocking file system APIs, ideal for real-time log monitoring.
- **Ecosystem:** Node.js and npm provide a rich ecosystem for async, file watching, and logging libraries.
- **Maintainability:** TypeScript's strictness and modularity make the codebase easier to maintain and extend.
- **Performance:** Node.js is highly optimized for I/O-bound workloads.

---

## Key Technologies & Tools

- **TypeScript**: Main language, strict mode enabled
- **Node.js (18+)**: Runtime environment
- **Chokidar**: Efficient, cross-platform file and directory watcher (uses OS notifications)
- **js-yaml**: YAML configuration parsing
- **Winston**: Flexible, extensible logging library
- **Custom Winston Transport**: Forwards logs to Monolog/Buggregator via TCP socket in JSON format
- **Jest**: Unit and integration testing
- **ESLint**: Linting for code quality
- **Prettier**: Code formatting
- **node-cron**: (If needed) for scheduled tasks

---

## Development Workflow

### 1. Install Dependencies
```bash
cd ts
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Run Tests
```bash
npm test
```
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

### 4. Lint and Format Code
```bash
npm run lint      # Check lint errors
npm run lint:fix  # Auto-fix lint errors
npm run format    # Format code with Prettier
```

### 5. Type Checking
```bash
npm run type-check
```

---

## Project Structure
- `src/` — Main source code (domain, application, infrastructure, console)
- `tests/` — Unit and integration tests
- `config/` — Example and real configuration files
- `docs/` — Project documentation, plan, and progress
- `dist/` — Compiled output

---

## Monolog/Buggregator Integration
- Logs are forwarded to Monolog/Buggregator using a custom Winston transport over TCP, in JSON format compatible with Buggregator's requirements.
- Configuration for host/port is environment-driven.

---

## How to Continue
- See `docs/plan.md` for the full implementation plan
- See `docs/progress.md` for current status and next steps
- All new code should be covered by tests and pass linting before commit

---

## License
MIT
