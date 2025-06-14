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

### Option 1: NPM Global Install (Recommended)

```bash
# Install globally
npm install -g react-native-mcp-server

# Or use directly with npx (no installation required)
npx react-native-mcp-server --help
```

### Option 2: From Source

```bash
git clone https://github.com/rahulthakur319/react-native-mcp-server.git
cd react-native-mcp-server
npm install
npm run build
```

## Usage

### Quick Start with NPX

```bash
# Start with default ports (8081, 8082, 8083, 19000, 19001, 19002, 3000, 3001)
npx react-native-mcp-server

# Start with custom ports
npx react-native-mcp-server --ports 8081,19000,3000

# Start with Expo ports
npx react-native-mcp-server --ports 19000,19001,19002

# Test connection
npx react-native-mcp-server --test

# Show help
npx react-native-mcp-server --help
```

### With Claude Desktop

1. Add to your Claude Desktop config (`claude-desktop-config.json`):

```json
{
  "mcpServers": {
    "react-native-debugger": {
      "command": "npx",
      "args": ["react-native-mcp-server", "--ports", "8081,8082,19000"],
      "env": {}
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "react-native-debugger": {
      "command": "react-native-mcp-server",
      "args": ["--ports", "8081,8082,19000"],
      "env": {}
    }
  }
}
```

2. Restart Claude Desktop

### CLI Options

```bash
npx react-native-mcp-server [options]

OPTIONS:
  --help, -h              Show help message
  --version, -v           Show version number
  --ports <ports>         Comma-separated Metro ports (e.g., --ports 8081,8082,19000)
  --port <port>           Single Metro port (scans port+1, port+2 too)
  --range <start>-<end>   Scan port range (e.g., --range 8080-8090)
  --test                  Run connection test
```

### Custom Port Configuration

Configure custom Metro ports using environment variables:

```bash
# Single port (will also scan port+1, port+2)
export RN_METRO_PORT=3000
npm start

# Multiple specific ports
export RN_METRO_PORTS="3000,3001,8081,19000"
npm start

# For Expo projects (ports 19000-19002)
export RN_METRO_PORTS="19000,19001,19002"
npm start
```

## MCP Tools Available

- **getConnectedApps(metroServerPort?)** - List all connected React Native apps (auto-discovers if no port specified)
- **scanPortRange(startPort, endPort)** - Scan a range of ports for Metro servers
- **getConfiguredPorts()** - Show currently configured ports and environment variables
- **readConsoleLogsFromApp(app, maxLogs?)** - Get console logs from specific app

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
"Scan ports 3000-3010 for React Native apps"
"What ports are you currently scanning?"
```

### Port Configuration Examples

**For standard React Native projects:**
```bash
export RN_METRO_PORT=8081  # Default Metro port
```

**For Expo projects:**
```bash
export RN_METRO_PORTS="19000,19001,19002"  # Expo dev server ports
```

**For custom Metro setups:**
```bash
export RN_METRO_PORTS="3000,3001,8080,8081"  # Custom ports
```

**For development with multiple projects:**
```bash
export RN_METRO_PORTS="8081,8082,8083,19000,19001,3000,3001"
```

The server will automatically find your running Metro server and connected apps across all configured ports.