#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';

const delay = promisify(setTimeout);

class RealLogTester {
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
      console.log('MCP:', data.toString().trim());
    });

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

      console.log(`📤 ${method}`);

      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 15000); // Longer timeout for log capture

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

  async testRealLogs() {
    try {
      await this.startMCPServer();
      
      // Get connected apps first
      console.log('\n📱 Getting connected apps...');
      const appsResponse = await this.sendMCPRequest('tools/call', {
        name: 'getConnectedApps',
        arguments: { metroServerPort: 8081 }
      });
      
      if (appsResponse.error) {
        console.log('❌ Failed to get apps:', appsResponse.error.message);
        return;
      }
      
      const appsText = appsResponse.result.content[0].text;
      const apps = JSON.parse(appsText);
      
      if (apps.length === 0) {
        console.log('❌ No apps connected');
        return;
      }
      
      const app = apps[0];
      console.log(`✅ Found app: ${app.title}`);
      
      // Now get console logs
      console.log('\n📝 Getting console logs...');
      console.log('⏳ This will connect to WebSocket and capture logs (may take a moment)...');
      
      const logsResponse = await this.sendMCPRequest('tools/call', {
        name: 'readConsoleLogsFromApp',
        arguments: { 
          app: app,
          maxLogs: 20 
        }
      });
      
      if (logsResponse.error) {
        console.log('❌ Failed to get logs:', logsResponse.error.message);
        return;
      }
      
      console.log('\n🎉 SUCCESS! Got console logs from MCP server:');
      console.log('================================================');
      
      const logsText = logsResponse.result.content[0].text;
      const logsData = JSON.parse(logsText);
      
      console.log(`📱 App: ${logsData.appInfo.title} (${logsData.appInfo.deviceName})`);
      console.log(`📊 Total logs captured: ${logsData.logs.length}`);
      console.log('\n📋 Recent logs:');
      
      logsData.logs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp}] [${log.level.toUpperCase()}]`);
        console.log(`   ${log.message}`);
        if (log.source) {
          console.log(`   📍 ${log.source}:${log.line || 0}`);
        }
        console.log('');
      });
      
      console.log('✅ MCP Server is working perfectly!');
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.mcpProcess) {
      console.log('\n🧹 Cleaning up...');
      this.mcpProcess.kill();
      await delay(1000);
    }
  }
}

// Run the test
const tester = new RealLogTester();
tester.testRealLogs().catch(console.error);