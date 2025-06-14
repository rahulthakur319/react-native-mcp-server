#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function showHelp() {
  console.log(`
🚀 React Native MCP Server

USAGE:
  npx react-native-mcp-server [options]
  npx rn-mcp [options]

OPTIONS:
  --help, -h              Show this help message
  --version, -v           Show version number
  --ports <ports>         Comma-separated list of Metro ports to scan
                         Example: --ports 8081,8082,19000,3000
  --port <port>           Single Metro port (will also scan port+1, port+2)
  --range <start>-<end>   Scan a specific port range
                         Example: --range 8080-8090
  --test                  Run a quick connection test

ENVIRONMENT VARIABLES:
  RN_METRO_PORT          Single Metro port to scan
  RN_METRO_PORTS         Comma-separated list of Metro ports
  METRO_PORT             Alternative for RN_METRO_PORT
  RN_MCP_PORTS           Alternative for RN_METRO_PORTS

EXAMPLES:
  # Start with default ports (8081, 8082, 8083, 19000, 19001, 19002, 3000, 3001)
  npx react-native-mcp-server

  # Start with custom ports
  npx react-native-mcp-server --ports 3000,3001,8081

  # Start with Expo ports
  npx react-native-mcp-server --ports 19000,19001,19002

  # Start with single port
  npx react-native-mcp-server --port 3000

  # Test connection
  npx react-native-mcp-server --test

CLAUDE DESKTOP CONFIG:
  Add this to your claude-desktop-config.json:
  {
    "mcpServers": {
      "react-native-debugger": {
        "command": "npx",
        "args": ["react-native-mcp-server", "--ports", "8081,19000"],
        "env": {}
      }
    }
  }

GitHub: https://github.com/rahulthakur319/react-native-mcp-server
`);
}

function showVersion() {
  console.log('v1.1.0');
}

async function runTest() {
  console.log('🧪 Testing React Native MCP Server connection...\n');
  
  // Import the test modules
  const testPath = join(__dirname, '../test-port-config.js');
  const testProcess = spawn('node', [testPath], {
    stdio: 'inherit'
  });

  testProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Connection test completed successfully!');
    } else {
      console.log('\n❌ Connection test failed.');
    }
    process.exit(code || 0);
  });
}

function parseArgs(args: string[]) {
  const result: {
    help?: boolean;
    version?: boolean;
    test?: boolean;
    ports?: string;
    port?: string;
    range?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;
      
      case '--version':
      case '-v':
        result.version = true;
        break;
      
      case '--test':
        result.test = true;
        break;
      
      case '--ports':
        result.ports = args[++i];
        break;
      
      case '--port':
        result.port = args[++i];
        break;
      
      case '--range':
        result.range = args[++i];
        break;
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  if (options.test) {
    await runTest();
    return;
  }

  // Set environment variables based on CLI options
  const env = { ...process.env };
  
  if (options.ports) {
    env.RN_METRO_PORTS = options.ports;
    console.log(`📋 Using custom ports: ${options.ports}`);
  } else if (options.port) {
    env.RN_METRO_PORT = options.port;
    console.log(`📋 Using port: ${options.port} (+ ${options.port}+1, ${options.port}+2)`);
  } else if (options.range) {
    const [start, end] = options.range.split('-').map(p => parseInt(p.trim()));
    if (start && end && start <= end) {
      const ports = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      env.RN_METRO_PORTS = ports.join(',');
      console.log(`📋 Using port range: ${start}-${end} (${ports.length} ports)`);
    } else {
      console.error('❌ Invalid port range format. Use: --range 8080-8090');
      process.exit(1);
    }
  }

  console.log('🚀 Starting React Native MCP Server...');
  console.log('💡 Use Ctrl+C to stop the server\n');

  // Start the actual MCP server
  const serverPath = join(__dirname, 'index.js');
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping React Native MCP Server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });

  serverProcess.on('close', (code) => {
    process.exit(code || 0);
  });
}

main().catch(console.error);