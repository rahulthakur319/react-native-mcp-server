#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { MetroDiscovery } from './metro-discovery.js';
import { ReactNativeDebuggerClient } from './debugger-client.js';
import { ReactNativeApp } from './types.js';

class ReactNativeDebuggerMCP {
  private server: Server;
  private metroDiscovery: MetroDiscovery;
  private debuggerClients: Map<string, ReactNativeDebuggerClient> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'react-native-debugger-mcp',
        version: '1.0.0',
      }
    );

    this.metroDiscovery = new MetroDiscovery();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'getConnectedApps',
            description: 'Get all connected React Native apps from Metro server',
            inputSchema: {
              type: 'object',
              properties: {
                metroServerPort: {
                  type: 'number',
                  description: 'The port number of the Metro server',
                },
              },
              required: ['metroServerPort'],
            },
          },
          {
            name: 'readConsoleLogsFromApp',
            description: 'Reads console logs from a connected React Native app through the debugger WebSocket',
            inputSchema: {
              type: 'object',
              properties: {
                app: {
                  type: 'object',
                  description: 'The app object as returned by getConnectedApps',
                  properties: {
                    id: {
                      type: 'string',
                      description: 'The Metro application ID',
                    },
                    description: {
                      type: 'string',
                      description: 'The Metro application\'s bundle ID',
                    },
                    webSocketDebuggerUrl: {
                      type: 'string',
                      description: 'The websocket debugger URL for the application',
                    },
                  },
                  required: ['id', 'description', 'webSocketDebuggerUrl'],
                },
                maxLogs: {
                  type: 'number',
                  description: 'Maximum number of logs to return (default: 100)',
                },
              },
              required: ['app'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'getConnectedApps':
          return this.handleGetConnectedApps(request.params.arguments);

        case 'readConsoleLogsFromApp':
          return this.handleReadConsoleLogsFromApp(request.params.arguments);

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleGetConnectedApps(args: any) {
    try {
      const { metroServerPort } = args;
      
      if (!metroServerPort || typeof metroServerPort !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'metroServerPort must be a number'
        );
      }

      // Check if Metro is running
      const isRunning = await this.metroDiscovery.isMetroRunning(metroServerPort);
      if (!isRunning) {
        return {
          content: [
            {
              type: 'text',
              text: `Metro server is not running on port ${metroServerPort}`,
            },
          ],
        };
      }

      // Get connected apps
      const apps = await this.metroDiscovery.getConnectedApps(metroServerPort);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(apps, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get connected apps: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleReadConsoleLogsFromApp(args: any) {
    try {
      const { app, maxLogs = 100 } = args;
      
      if (!app || !app.id || !app.webSocketDebuggerUrl) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'app object must contain id and webSocketDebuggerUrl'
        );
      }

      const appKey = app.id;
      let client = this.debuggerClients.get(appKey);

      // Create new client if doesn't exist
      if (!client) {
        client = new ReactNativeDebuggerClient(app as ReactNativeApp);
        this.debuggerClients.set(appKey, client);
        
        // Set up cleanup on disconnect
        client.on('disconnected', () => {
          this.debuggerClients.delete(appKey);
        });
      }

      // Connect if not already connected
      if (!client.isConnected()) {
        await client.connect();
        
        // Wait a bit for initial logs to come in
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get recent logs
      const logs = client.getRecentLogs(maxLogs);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              appInfo: {
                id: app.id,
                title: app.title || app.description,
                deviceName: app.deviceName,
              },
              logs: logs.map(log => ({
                timestamp: new Date(log.timestamp).toISOString(),
                level: log.level,
                message: log.message,
                source: log.source,
                line: log.line,
                column: log.column,
              })),
              totalLogs: logs.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read console logs: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('React Native Debugger MCP server running on stdio');
  }

  async cleanup() {
    // Disconnect all debugger clients
    for (const client of this.debuggerClients.values()) {
      client.disconnect();
    }
    this.debuggerClients.clear();
  }
}

// Handle shutdown gracefully
const server = new ReactNativeDebuggerMCP();

process.on('SIGINT', async () => {
  await server.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.cleanup();
  process.exit(0);
});

// Start the server
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});