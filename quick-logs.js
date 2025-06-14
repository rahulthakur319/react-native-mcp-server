#!/usr/bin/env node

import WebSocket from 'ws';
import fetch from 'node-fetch';

console.log('🔍 Getting current React Native logs...');

// Get app info
const response = await fetch('http://localhost:8081/json/list');
const apps = await response.json();

if (apps.length === 0) {
  console.log('❌ No React Native apps connected');
  process.exit(1);
}

const app = apps[0];
console.log(`📱 Connecting to: ${app.title}`);

// Connect to WebSocket
const ws = new WebSocket(app.webSocketDebuggerUrl);
const logs = [];
let messageId = 1;

ws.on('open', () => {
  console.log('✅ Connected! Enabling log capture...');
  
  // Enable domains
  ws.send(JSON.stringify({ id: messageId++, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: messageId++, method: 'Console.enable' }));
  ws.send(JSON.stringify({ id: messageId++, method: 'Log.enable' }));
  
  console.log('👂 Listening for logs (5 seconds)...');
  
  // Close after 5 seconds
  setTimeout(() => {
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    if (message.method === 'Runtime.consoleAPICalled') {
      const params = message.params;
      const timestamp = new Date(params.timestamp).toISOString();
      const level = params.type || 'log';
      const messages = params.args.map(arg => arg.value || arg.description || '[Object]');
      
      logs.push({
        timestamp,
        level,
        message: messages.join(' ')
      });
      
      console.log(`📝 [${level.toUpperCase()}] ${messages.join(' ')}`);
    }
  } catch (e) {
    // Ignore parsing errors
  }
});

ws.on('close', () => {
  console.log(`\n📊 Captured ${logs.length} new logs`);
  if (logs.length === 0) {
    console.log('💡 No new logs - try interacting with your React Native app');
  }
  process.exit(0);
});

ws.on('error', (error) => {
  console.log('❌ Connection error:', error.message);
  process.exit(1);
});