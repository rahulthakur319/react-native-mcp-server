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

    // Initialize MetroDiscovery with environment variable support
    const customPorts = process.env.RN_MCP_PORTS ? 
      process.env.RN_MCP_PORTS.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p)) : 
      undefined;
    
    this.metroDiscovery = new MetroDiscovery(customPorts);
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'getConnectedApps',
            description: 'Get all connected React Native apps from Metro server or auto-discover',
            inputSchema: {
              type: 'object',
              properties: {
                metroServerPort: {
                  type: 'number',
                  description: 'The port number of the Metro server (optional - will auto-discover if not provided)',
                },
              },
            },
          },
          {
            name: 'scanPortRange',
            description: 'Scan a range of ports for Metro servers and connected React Native apps',
            inputSchema: {
              type: 'object',
              properties: {
                startPort: {
                  type: 'number',
                  description: 'Start of port range to scan',
                },
                endPort: {
                  type: 'number',
                  description: 'End of port range to scan',
                },
              },
              required: ['startPort', 'endPort'],
            },
          },
          {
            name: 'getConfiguredPorts',
            description: 'Get the list of ports currently configured for Metro discovery',
            inputSchema: {
              type: 'object',
              properties: {},
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

        case 'scanPortRange':
          return this.handleScanPortRange(request.params.arguments);

        case 'getConfiguredPorts':
          return this.handleGetConfiguredPorts(request.params.arguments);

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
      
      if (metroServerPort && typeof metroServerPort !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'metroServerPort must be a number if provided'
        );
      }

      if (metroServerPort) {
        // Check specific port
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
        
        const apps = await this.metroDiscovery.getConnectedApps(metroServerPort);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(apps, null, 2),
            },
          ],
        };
      } else {
        // Auto-discover from all configured ports
        const apps = await this.metroDiscovery.getAppsFromPort();
        const configuredPorts = this.metroDiscovery.getConfiguredPorts();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                apps,
                scannedPorts: configuredPorts,
                foundAppsCount: apps.length
              }, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get connected apps: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleScanPortRange(args: any) {
    try {
      const { startPort, endPort } = args;
      
      if (!startPort || !endPort || typeof startPort !== 'number' || typeof endPort !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'startPort and endPort must be numbers'
        );
      }

      if (startPort > endPort) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'startPort must be less than or equal to endPort'
        );
      }

      if (endPort - startPort > 100) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Port range cannot exceed 100 ports for performance reasons'
        );
      }

      const results = await this.metroDiscovery.scanPortRange(startPort, endPort);
      const allApps: ReactNativeApp[] = [];
      const portResults: Array<{port: number, apps: ReactNativeApp[]}> = [];

      for (const [port, apps] of results.entries()) {
        allApps.push(...apps);
        portResults.push({ port, apps });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scannedRange: `${startPort}-${endPort}`,
              portsWithApps: portResults,
              totalAppsFound: allApps.length,
              apps: allApps
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to scan port range: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetConfiguredPorts(args: any) {
    try {
      const configuredPorts = this.metroDiscovery.getConfiguredPorts();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              configuredPorts,
              portCount: configuredPorts.length,
              environmentVariables: {
                RN_METRO_PORTS: process.env.RN_METRO_PORTS || 'not set',
                RN_METRO_PORT: process.env.RN_METRO_PORT || 'not set',
                METRO_PORT: process.env.METRO_PORT || 'not set',
                RN_MCP_PORTS: process.env.RN_MCP_PORTS || 'not set'
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get configured ports: ${error instanceof Error ? error.message : String(error)}`
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