import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ReactNativeApp, ConsoleLog, ChromeDevToolsMessage, RuntimeConsoleAPICalledParams } from './types.js';

export class ReactNativeDebuggerClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private logs: ConsoleLog[] = [];
  private maxLogs = 1000;
  private readonly app: ReactNativeApp;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(app: ReactNativeApp) {
    super();
    this.app = app;
  }

  /**
   * Connect to the React Native debugger WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.app.webSocketDebuggerUrl);
        
        this.ws.on('open', () => {
          console.log(`Connected to ${this.app.title} (${this.app.deviceName})`);
          this.reconnectAttempts = 0;
          
          // Enable Runtime domain to receive console messages
          this.sendCommand('Runtime.enable');
          this.sendCommand('Log.enable');
          
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message: ChromeDevToolsMessage = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error(`WebSocket error for ${this.app.title}:`, error);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`Connection closed for ${this.app.title}: ${code} ${reason}`);
          this.ws = null;
          this.attemptReconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a command to the debugger
   */
  private sendCommand(method: string, params?: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: ChromeDevToolsMessage = {
      id: this.messageId++,
      method,
      params: params || {}
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: ChromeDevToolsMessage): void {
    // Handle console API calls (console.log, console.warn, etc.)
    if (message.method === 'Runtime.consoleAPICalled') {
      this.handleConsoleMessage(message.params as RuntimeConsoleAPICalledParams);
    }
    
    // Handle runtime exceptions
    else if (message.method === 'Runtime.exceptionThrown') {
      this.handleException(message.params);
    }
    
    // Handle log entries
    else if (message.method === 'Log.entryAdded') {
      this.handleLogEntry(message.params);
    }
  }

  /**
   * Handle console API calls (console.log, console.warn, etc.)
   */
  private handleConsoleMessage(params: RuntimeConsoleAPICalledParams): void {
    const log: ConsoleLog = {
      timestamp: params.timestamp,
      level: this.mapLogLevel(params.type),
      message: this.formatConsoleArgs(params.args),
      args: params.args.map(arg => arg.value || arg.description || '[Object]'),
      source: params.stackTrace?.callFrames[0]?.url,
      line: params.stackTrace?.callFrames[0]?.lineNumber,
      column: params.stackTrace?.callFrames[0]?.columnNumber
    };

    this.addLog(log);
    this.emit('log', log);
  }

  /**
   * Handle runtime exceptions
   */
  private handleException(params: any): void {
    const log: ConsoleLog = {
      timestamp: Date.now(),
      level: 'error',
      message: params.exceptionDetails?.text || 'Runtime Exception',
      args: [params.exceptionDetails],
      source: params.exceptionDetails?.url,
      line: params.exceptionDetails?.lineNumber,
      column: params.exceptionDetails?.columnNumber
    };

    this.addLog(log);
    this.emit('log', log);
  }

  /**
   * Handle log entries
   */
  private handleLogEntry(params: any): void {
    const log: ConsoleLog = {
      timestamp: Date.now(),
      level: params.entry?.level?.toLowerCase() || 'log',
      message: params.entry?.text || '',
      args: [params.entry?.text],
      source: params.entry?.source
    };

    this.addLog(log);
    this.emit('log', log);
  }

  /**
   * Map Chrome DevTools log levels to our format
   */
  private mapLogLevel(type: string): ConsoleLog['level'] {
    switch (type.toLowerCase()) {
      case 'warning': return 'warn';
      case 'error': return 'error';
      case 'info': return 'info';
      case 'debug': return 'debug';
      default: return 'log';
    }
  }

  /**
   * Format console arguments into a readable message
   */
  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => {
      if (arg.type === 'string') {
        return arg.value;
      } else if (arg.type === 'object') {
        return arg.description || '[Object]';
      } else if (arg.value !== undefined) {
        return String(arg.value);
      } else {
        return arg.description || '[Unknown]';
      }
    }).join(' ');
  }

  /**
   * Add a log entry to the internal buffer
   */
  private addLog(log: ConsoleLog): void {
    this.logs.push(log);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Get recent console logs
   */
  getRecentLogs(count: number = 100): ConsoleLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get app information
   */
  getAppInfo(): ReactNativeApp {
    return this.app;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Attempt to reconnect to the WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`Max reconnection attempts reached for ${this.app.title}`);
      this.emit('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect to ${this.app.title} in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Connection failed, will try again
      });
    }, delay);
  }
}