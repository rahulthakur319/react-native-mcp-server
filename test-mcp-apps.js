#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';

const delay = promisify(setTimeout);

async function testGetConnectedApps() {
  console.log('📱 Testing getConnectedApps MCP tool...');
  
  const mcpProcess = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log('MCP:', data.toString().trim());
  });

  await delay(2000);

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'getConnectedApps',
      arguments: { metroServerPort: 8081 }
    }
  };

  let response = '';
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, 5000);

    const dataHandler = (data) => {
      response += data.toString();
      try {
        const lines = response.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.id === 1) {
            clearTimeout(timeout);
            mcpProcess.stdout.removeListener('data', dataHandler);
            resolve(parsed);
            return;
          }
        }
      } catch (e) {
        // Wait for complete JSON
      }
    };
    mcpProcess.stdout.on('data', dataHandler);
  });

  mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  
  try {
    const result = await promise;
    
    if (result.error) {
      console.log('❌ Error:', result.error.message);
    } else {
      console.log('✅ getConnectedApps Response:');
      const appsText = result.result.content[0].text;
      const apps = JSON.parse(appsText);
      
      console.log(`📊 Found ${apps.length} connected app(s):`);
      apps.forEach((app, i) => {
        console.log(`\n${i + 1}. ${app.title}`);
        console.log(`   ID: ${app.id}`);
        console.log(`   Device: ${app.deviceName}`);
        console.log(`   Type: ${app.description}`);
        console.log(`   WebSocket: ${app.webSocketDebuggerUrl}`);
      });
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }

  mcpProcess.kill();
  await delay(1000);
}

testGetConnectedApps().catch(console.error);