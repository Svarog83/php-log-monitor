export type PositionStorageType = 'file' | 'cached' | 'async';

/**
 * Value object for position storage configuration
 */
export class PositionStorageConfig {
  constructor(
    public readonly type: PositionStorageType = 'file',
    public readonly path: string = 'var/positions',
    public readonly saveIntervalSeconds: number = 30
  ) {
    this.validate();
  }

  private validate(): void {
    if (!['file', 'cached', 'async'].includes(this.type)) {
      throw new Error(`Invalid position storage type: ${this.type}`);
    }

    if (!this.path.trim()) {
      throw new Error('Position storage path cannot be empty');
    }

    if (this.saveIntervalSeconds < 1) {
      throw new Error('Save interval must be at least 1 second');
    }
  }

  public isEnabled(): boolean {
    return this.type !== 'file' || this.path !== '';
  }

  public isCached(): boolean {
    return this.type === 'cached';
  }

  public isAsync(): boolean {
    return this.type === 'async';
  }

  public toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      path: this.path,
      saveIntervalSeconds: this.saveIntervalSeconds,
    };
  }

  public static fromObject(obj: Record<string, unknown>): PositionStorageConfig {
    return new PositionStorageConfig(
      (obj.type as PositionStorageType) || 'file',
      (obj.path as string) || 'var/positions',
      (obj.saveIntervalSeconds as number) || 30
    );
  }
} 