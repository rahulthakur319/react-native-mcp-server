# React Native Debugger MCP Server

An MCP (Model Context Protocol) server that connects to React Native Metro debugger and captures console logs in real-time.

## Features

- 🔍 **Auto-discovery**: Automatically finds running Metro servers
- 📱 **Multi-device support**: Handles multiple connected React Native apps
- 🔄 **Real-time logs**: Streams console logs via WebSocket
- 🛠️ **MCP integration**: Exposes logs through MCP tools for AI assistants

## How it works

1. Discovers running Metro servers on default ports (8081, 8082, etc.)
2. Queries Metro's inspector API for connected React Native apps
3. Connects to each app's WebSocket debugger endpoint
4. Captures console messages and exposes them via MCP tools

## Installation

```bash
git clone <repository-url>
cd react-native-mcp-server
npm install
npm run build
```

## Usage

### With Claude Desktop

1. Add to your Claude Desktop config (`claude-desktop-config.json`):

```json
{
  "mcpServers": {
    "react-native-debugger": {
      "command": "node",
      "args": ["/path/to/react-native-mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

2. Restart Claude Desktop

### Standalone

```bash
npm start
```

## MCP Tools Available

- **getConnectedApps(metroServerPort?)** - List all connected React Native apps
- **readConsoleLogsFromApp(appId, maxLogs?)** - Get console logs from specific app

## WebSocket Discovery

The server automatically discovers WebSocket URLs by:
1. Scanning common Metro ports (8081, 8082, 8083, 19000, 19001)
2. Querying `http://localhost:PORT/json/list` (Metro inspector API)
3. Extracting `webSocketDebuggerUrl` from connected apps
4. Connecting to Chrome DevTools Protocol WebSocket

## Example Usage with Claude Code

Once configured, you can ask Claude to:

```
"Show me the console logs from my React Native app"
"What React Native apps are currently connected?"
"Monitor my app's console output for errors"
```

The server will automatically find your running Metro server and connected apps.