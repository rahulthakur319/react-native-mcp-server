#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';

const delay = promisify(setTimeout);

async function testPortConfiguration() {
  console.log('🔧 Testing Port Configuration Features...');
  console.log('=======================================');
  
  const mcpProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      RN_METRO_PORTS: '8081,8082,19000,3000'
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log('MCP:', data.toString().trim());
  });

  await delay(2000);

  // Test getConfiguredPorts
  console.log('\n📋 Test 1: Get Configured Ports');
  await testMCPTool(mcpProcess, 'getConfiguredPorts', {});

  await delay(1000);

  // Test getConnectedApps without port (auto-discovery)
  console.log('\n📱 Test 2: Auto-discover Apps');
  await testMCPTool(mcpProcess, 'getConnectedApps', {});

  await delay(1000);

  // Test scanPortRange
  console.log('\n🔍 Test 3: Scan Port Range');
  await testMCPTool(mcpProcess, 'scanPortRange', { startPort: 8080, endPort: 8085 });

  mcpProcess.kill();
  await delay(1000);
  
  console.log('\n✅ Port configuration testing complete!');
}

async function testMCPTool(mcpProcess, toolName, args) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    let response = '';
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, 8000);

    const dataHandler = (data) => {
      response += data.toString();
      try {
        const lines = response.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.id === request.id) {
            clearTimeout(timeout);
            mcpProcess.stdout.removeListener('data', dataHandler);
            
            if (parsed.error) {
              console.log(`❌ ${toolName} failed:`, parsed.error.message);
            } else {
              console.log(`✅ ${toolName} success:`);
              const result = JSON.parse(parsed.result.content[0].text);
              console.log(JSON.stringify(result, null, 2));
            }
            
            resolve(parsed);
            return;
          }
        }
      } catch (e) {
        // Wait for complete JSON
      }
    };

    mcpProcess.stdout.on('data', dataHandler);
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

testPortConfiguration().catch(console.error);