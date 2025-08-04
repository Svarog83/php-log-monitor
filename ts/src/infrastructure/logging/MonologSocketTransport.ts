import net from 'net';

/**
 * Custom transport for sending logs to Monolog/Buggregator via TCP socket
 */
export class MonologSocketTransport {
  private socket: net.Socket | null = null;
  private host: string;
  private port: number;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private messageQueue: string[] = [];
  private maxQueueSize: number;

  constructor(options: {
    host?: string;
    port?: number;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    maxQueueSize?: number;
  } = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 9913; // Default Buggregator port
    this.reconnectInterval = options.reconnectInterval || 5000; // 5 seconds
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.maxQueueSize = options.maxQueueSize || 1000;

    this.connect();
  }

  /**
   * Send log message to Monolog/Buggregator
   */
  sendLog(level: string, message: string, meta?: Record<string, unknown>): void {
    try {
      const logMessage = this.formatLogMessage({ level, message, meta });
      
      if (this.isConnected && this.socket) {
        this.socket.write(logMessage + '\n');
      } else {
        // Queue message if not connected
        this.queueMessage(logMessage);
      }
    } catch (error) {
      console.error('Error sending log to Monolog:', error);
    }
  }

  /**
   * Connect to the Monolog/Buggregator socket
   */
  private connect(): void {
    try {
      this.socket = new net.Socket();
      
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log(`Connected to Monolog/Buggregator at ${this.host}:${this.port}`);
        
        // Send queued messages
        this.flushMessageQueue();
      });

      this.socket.on('data', (data) => {
        // Handle any response from the server if needed
        console.debug('Received data from Monolog:', data.toString());
      });

      this.socket.on('error', (error) => {
        console.error('Monolog socket error:', error);
        this.isConnected = false;
      });

      this.socket.on('close', () => {
        console.log('Monolog socket connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.socket.connect(this.port, this.host);
    } catch (error) {
      console.error('Error creating Monolog socket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Format log message for Monolog/Buggregator
   */
  private formatLogMessage(info: any): string {
    const logEntry = {
      message: info.message,
      level: info.level,
      timestamp: info.timestamp || new Date().toISOString(),
      context: info.context || {},
      extra: info.extra || {},
      channel: info.channel || 'log-monitor',
      ...info.meta
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Queue a message when not connected
   */
  private queueMessage(message: string): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message if queue is full
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  /**
   * Send all queued messages
   */
  private flushMessageQueue(): void {
    if (!this.isConnected || !this.socket || this.messageQueue.length === 0) {
      return;
    }

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        this.socket.write(message + '\n');
      } catch (error) {
        console.error('Error sending queued message:', error);
        // Re-queue failed messages
        this.queueMessage(message);
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached for Monolog socket');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Scheduling Monolog reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Close the socket connection
   */
  close(): void {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Cleanup method for tests - ensures all resources are released
   */
  async cleanup(): Promise<void> {
    this.close();
    // Clear any pending messages
    this.messageQueue = [];
    this.reconnectAttempts = 0;
  }

  /**
   * Get connection status
   */
  getStatus(): { isConnected: boolean; queueSize: number; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      queueSize: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
} 