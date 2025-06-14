#!/usr/bin/env node

import { ReactNativeDebuggerClient } from './dist/debugger-client.js';
import { MetroDiscovery } from './dist/metro-discovery.js';

async function testConnection() {
  console.log('🔍 Finding React Native apps...');
  
  const discovery = new MetroDiscovery();
  const apps = await discovery.getAppsFromPort(8081);
  
  if (apps.length === 0) {
    console.log('❌ No apps found');
    return;
  }
  
  const app = apps[0];
  console.log(`📱 Found: ${app.title}`);
  console.log(`🔗 WebSocket: ${app.webSocketDebuggerUrl}`);
  
  console.log('\n🚀 Creating debugger client...');
  const client = new ReactNativeDebuggerClient(app);
  
  // Add error handling
  client.on('error', (error) => {
    console.log('❌ Client error:', error.message);
  });
  
  client.on('disconnected', () => {
    console.log('🔌 Client disconnected');
  });
  
  try {
    console.log('🔄 Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Wait for logs to accumulate
    console.log('⏳ Waiting for logs (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Get logs
    const logs = client.getRecentLogs(10);
    console.log(`📊 Found ${logs.length} logs:`);
    
    logs.forEach((log, i) => {
      console.log(`${i + 1}. [${log.level}] ${log.message}`);
      console.log(`   ${new Date(log.timestamp).toISOString()}`);
      if (log.source) console.log(`   📍 ${log.source}:${log.line}`);
      console.log('');
    });
    
    if (logs.length === 0) {
      console.log('💡 No logs captured. Try triggering console.log() in your React Native app.');
    }
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  } finally {
    client.disconnect();
    console.log('🧹 Cleanup complete');
  }
}

testConnection().catch(console.error);