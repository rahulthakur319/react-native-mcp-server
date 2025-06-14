#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';

const delay = promisify(setTimeout);

class MCPTester {
  constructor() {
    this.mcpProcess = null;
    this.messageId = 1;
  }

  async startMCPServer() {
    console.log('🚀 Starting MCP server...');
    this.mcpProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.mcpProcess.stderr.on('data', (data) => {
      console.log('MCP Error:', data.toString());
    });

    // Wait for server to start
    await delay(2000);
    console.log('✅ MCP server started');
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method,
        params
      };

      console.log(`📤 Sending: ${method}`);
      console.log(`   Params:`, JSON.stringify(params, null, 2));

      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const dataHandler = (data) => {
        response += data.toString();
        try {
          const lines = response.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const parsed = JSON.parse(line);
            if (parsed.id === request.id) {
              clearTimeout(timeout);
              this.mcpProcess.stdout.removeListener('data', dataHandler);
              resolve(parsed);
              return;
            }
          }
        } catch (e) {
          // Incomplete JSON, wait for more data
        }
      };

      this.mcpProcess.stdout.on('data', dataHandler);
      this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async testGetConnectedApps() {
    try {
      const response = await this.sendMCPRequest('tools/call', {
        name: 'getConnectedApps',
        arguments: { metroServerPort: 8081 }
      });
      
      console.log('📥 getConnectedApps Response:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.log('❌ getConnectedApps failed:', response.error.message);
        return false;
      }
      
      console.log('✅ getConnectedApps works!');
      return response.result?.content?.[0]?.text || response.result;
    } catch (error) {
      console.log('❌ getConnectedApps error:', error.message);
      return false;
    }
  }

  async testReadConsoleLogsFromApp(appData) {
    try {
      // Parse the app data to get the first app
      let appInfo;
      if (typeof appData === 'string') {
        const parsed = JSON.parse(appData);
        appInfo = parsed[0];
      } else {
        appInfo = appData[0];
      }

      if (!appInfo) {
        console.log('❌ No app found to test readConsoleLogsFromApp');
        return false;
      }

      console.log('📋 Using app:', appInfo.id, appInfo.title);

      const response = await this.sendMCPRequest('tools/call', {
        name: 'readConsoleLogsFromApp',
        arguments: { 
          app: appInfo,  // Pass the full app object
          maxLogs: 10 
        }
      });
      
      console.log('📥 readConsoleLogsFromApp Response:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.log('❌ readConsoleLogsFromApp failed:', response.error.message);
        return false;
      }
      
      console.log('✅ readConsoleLogsFromApp works!');
      return true;
    } catch (error) {
      console.log('❌ readConsoleLogsFromApp error:', error.message);
      return false;
    }
  }

  async testListTools() {
    try {
      const response = await this.sendMCPRequest('tools/list');
      
      console.log('📥 tools/list Response:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.log('❌ tools/list failed:', response.error.message);
        return false;
      }
      
      console.log('✅ tools/list works!');
      return true;
    } catch (error) {
      console.log('❌ tools/list error:', error.message);
      return false;
    }
  }

  async cleanup() {
    if (this.mcpProcess) {
      console.log('🧹 Cleaning up MCP server...');
      this.mcpProcess.kill();
      await delay(1000);
    }
  }

  async runTests() {
    try {
      await this.startMCPServer();
      
      console.log('\n🧪 Testing MCP Tools...\n');
      
      // Test 1: List available tools
      console.log('=== Test 1: List Tools ===');
      await this.testListTools();
      
      await delay(1000);
      
      // Test 2: Get connected apps
      console.log('\n=== Test 2: Get Connected Apps ===');
      const appsResult = await this.testGetConnectedApps();
      
      await delay(1000);
      
      // Test 3: Read console logs (if apps are available)
      if (appsResult) {
        console.log('\n=== Test 3: Read Console Logs ===');
        await this.testReadConsoleLogsFromApp(appsResult);
      }
      
      console.log('\n🎉 All tests completed!');
      
    } catch (error) {
      console.log('💥 Test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
const tester = new MCPTester();
tester.runTests().catch(console.error);