/**
 * Value object representing a file position for tracking
 */
export class FilePosition {
  constructor(
    public readonly filePath: string,
    public readonly position: number,
    public readonly lastModified: Date,
    public readonly projectName: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.filePath.trim()) {
      throw new Error('File path cannot be empty');
    }

    if (this.position < 0) {
      throw new Error('Position cannot be negative');
    }

    if (!this.projectName.trim()) {
      throw new Error('Project name cannot be empty');
    }
  }

  public getKey(): string {
    return `${this.projectName}:${this.filePath}`;
  }

  public isStale(currentModified: Date): boolean {
    return this.lastModified.getTime() < currentModified.getTime();
  }

  public updatePosition(newPosition: number, newModified: Date): FilePosition {
    return new FilePosition(
      this.filePath,
      newPosition,
      newModified,
      this.projectName
    );
  }

  public toJSON(): Record<string, unknown> {
    return {
      filePath: this.filePath,
      position: this.position,
      lastModified: this.lastModified.toISOString(),
      projectName: this.projectName,
    };
  }

  public static fromJSON(data: Record<string, unknown>): FilePosition {
    return new FilePosition(
      data.filePath as string,
      data.position as number,
      new Date(data.lastModified as string),
      data.projectName as string
    );
  }
} 