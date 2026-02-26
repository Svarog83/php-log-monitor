# Project: PHP Log Monitor

## Overview
A modern, async log monitoring tool built with PHP 8.4, amphp, and danog/loop. It watches log directories for new and changed log files, reads new entries from tracked positions, and forwards them to Monolog handlers (including Buggregator). Designed for production use with multiple simultaneous project monitoring.

## Core Features
- **Async file monitoring** — Non-blocking directory scanning and file reading via amphp
- **Position tracking** — Maintains read positions between runs (file, async-file, cached backends)
- **Multi-project support** — Monitor multiple projects with independent configurations
- **Monolog integration** — Forwards parsed log entries with proper level mapping
- **Buggregator integration** — Real-time log forwarding to Buggregator debug server
- **Graceful shutdown** — POSIX signal handling (SIGINT/SIGTERM) with position persistence
- **YAML configuration** — Declarative project configuration with pattern-based file discovery

## Tech Stack
- **Language:** PHP 8.4 (strict types throughout)
- **Async Runtime:** amphp v3 + danog/loop (PeriodicLoop)
- **CLI Framework:** Symfony Console 7.x
- **Configuration:** Symfony YAML 7.x
- **Logging:** Monolog 3.x
- **Debug Tools:** Symfony VarDumper, Buggregator
- **Environment:** Symfony DotEnv 7.x
- **Static Analysis:** PHPStan (level 9), Mago linter/formatter
- **Testing:** PHPUnit 10
- **CI:** GitHub Actions
- **Extensions:** ext-pcntl (signal handling)

## Secondary: TypeScript Port
A TypeScript port lives in `ts/` with its own `package.json`, using chokidar for file watching and winston for logging. It mirrors the PHP version's architecture.

## Architecture Notes
- **Clean Architecture** with 4 layers: Domain, Application, Infrastructure, Console
- **DDD patterns**: Value Objects (LogFile, LogEntry, FilePosition), Aggregate Root (Project), Repository interfaces in Domain with implementations in Infrastructure
- **PSR-4 autoloading** under `App\` namespace mapped to `src/`
- **No framework container** — manual wiring in console entry point
- **Factory pattern** for position storage backends and logger creation

## Architecture
See `.ai-factory/ARCHITECTURE.md` for detailed architecture guidelines.
Pattern: Clean Architecture with DDD tactical patterns

## Non-Functional Requirements
- **Logging:** Configurable via environment variables (LOG_PATH, BUGGREGATOR_HOST/PORT)
- **Error handling:** Graceful degradation — file read errors don't crash the monitor
- **Performance:** Async I/O prevents blocking; configurable scan intervals
- **Reliability:** Position tracking survives restarts; cached storage with periodic flush
- **Security:** No network-facing surface; file-system access only
