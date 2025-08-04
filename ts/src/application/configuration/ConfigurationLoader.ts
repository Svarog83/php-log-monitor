import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import chokidar from 'chokidar';
import { Project } from '../../domain/models/Project.js';
import { PositionStorageConfig } from '../../domain/models/PositionStorageConfig.js';

/**
 * Configuration for the log monitor
 */
export interface LogMonitorConfig {
  projects: Record<string, ProjectConfig>;
  global?: GlobalConfig;
}

/**
 * Configuration for a single project
 */
export interface ProjectConfig {
  directories: string[];
  log_pattern?: string;
  position_storage?: PositionStorageConfigData;
}

/**
 * Position storage configuration data
 */
export interface PositionStorageConfigData {
  type: 'file' | 'cached' | 'async';
  path?: string;
  save_interval_seconds?: number;
  cache_timeout_seconds?: number;
  batch_size?: number;
  flush_interval_seconds?: number;
}

/**
 * Global configuration
 */
export interface GlobalConfig {
  log_level?: string;
  log_dir?: string;
  monolog_host?: string;
  monolog_port?: number;
}

/**
 * Configuration loader with hot reload support
 */
export class ConfigurationLoader {
  private configPath: string;
  private watcher: chokidar.FSWatcher | null = null;
  private config: LogMonitorConfig | null = null;
  private onChangeCallbacks: Array<(config: LogMonitorConfig) => void> = [];

  constructor(configPath: string = './config/projects.yaml') {
    this.configPath = configPath;
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<LogMonitorConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const parsed = yaml.load(configData) as LogMonitorConfig;
      
      if (!parsed || !parsed.projects) {
        throw new Error('Invalid configuration: missing projects section');
      }

      this.config = parsed;
      return parsed;
    } catch (error) {
      console.error(`Error loading configuration from ${this.configPath}:`, error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): LogMonitorConfig | null {
    return this.config;
  }

  /**
   * Convert configuration to domain models
   */
  getProjects(): Project[] {
    if (!this.config) {
      return [];
    }

    const projects: Project[] = [];

    for (const [name, config] of Object.entries(this.config.projects)) {
      try {
        const positionStorage = this.createPositionStorageConfig(config.position_storage);
        const project = new Project(
          name,
          config.directories,
          config.log_pattern || 'logstash-*.json',
          positionStorage
        );
        projects.push(project);
      } catch (error) {
        console.error(`Error creating project ${name}:`, error);
      }
    }

    return projects;
  }

  /**
   * Start watching configuration file for changes
   */
  async startWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.watcher.on('change', async (filePath) => {
      console.log(`Configuration file changed: ${filePath}`);
      try {
        await this.loadConfig();
        this.notifyChangeCallbacks();
      } catch (error) {
        console.error('Error reloading configuration:', error);
      }
    });

    this.watcher.on('error', (error) => {
      console.error('Error watching configuration file:', error);
    });
  }

  /**
   * Stop watching configuration file
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Register callback for configuration changes
   */
  onConfigChange(callback: (config: LogMonitorConfig) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Remove callback for configuration changes
   */
  removeConfigChangeCallback(callback: (config: LogMonitorConfig) => void): void {
    const index = this.onChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.onChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all change callbacks
   */
  private notifyChangeCallbacks(): void {
    if (!this.config) {
      return;
    }

    for (const callback of this.onChangeCallbacks) {
      try {
        callback(this.config);
      } catch (error) {
        console.error('Error in configuration change callback:', error);
      }
    }
  }

  /**
   * Create PositionStorageConfig from configuration data
   */
  private createPositionStorageConfig(data?: PositionStorageConfigData): PositionStorageConfig {
    if (!data) {
      return new PositionStorageConfig();
    }

    return new PositionStorageConfig(
      data.type || 'file',
      data.path || 'var/positions',
      data.save_interval_seconds || 30
    );
  }
} 