import { PositionStorageConfig } from './PositionStorageConfig.js';

/**
 * Aggregate root representing a project configuration
 */
export class Project {
  constructor(
    public readonly name: string,
    public readonly monitoredDirectories: string[],
    public readonly logPattern: string = 'logstash-*.json',
    public readonly positionStorage: PositionStorageConfig = new PositionStorageConfig()
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name.trim()) {
      throw new Error('Project name cannot be empty');
    }

    if (this.monitoredDirectories.length === 0) {
      throw new Error('At least one monitored directory is required');
    }

    for (const directory of this.monitoredDirectories) {
      if (!directory.trim()) {
        throw new Error('Monitored directory cannot be empty');
      }
    }
  }

  public getMonitoredDirectories(): string[] {
    return [...this.monitoredDirectories];
  }

  public getLogPattern(): string {
    return this.logPattern;
  }

  public getPositionStorageConfig(): PositionStorageConfig {
    return this.positionStorage;
  }

  public isPositionTrackingEnabled(): boolean {
    return this.positionStorage.isEnabled();
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      monitoredDirectories: this.monitoredDirectories,
      logPattern: this.logPattern,
      positionStorage: this.positionStorage.toJSON(),
    };
  }
} 