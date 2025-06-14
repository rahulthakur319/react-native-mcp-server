#!/usr/bin/env node

import WebSocket from 'ws';
import fetch from 'node-fetch';

async function getConnectedApps() {
  try {
    const response = await fetch('http://localhost:8081/json/list');
    const apps = await response.json();
    return apps;
  } catch (error) {
    console.log('❌ Failed to get connected apps:', error.message);
    return [];
  }
}

async function connectToReactNativeDebugger() {
  console.log('🔍 Getting connected React Native apps...');
  
  const apps = await getConnectedApps();
  if (apps.length === 0) {
    console.log('❌ No React Native apps connected');
    return;
  }

  const app = apps[0];
  console.log(`📱 Found app: ${app.title}`);
  console.log(`🔗 WebSocket: ${app.webSocketDebuggerUrl}`);

  console.log('\n🚀 Connecting to React Native debugger...');
  
  const ws = new WebSocket(app.webSocketDebuggerUrl);
  let messageId = 1;
  
  ws.on('open', () => {
    console.log('✅ Connected to React Native debugger!');
    
    // Enable Runtime domain to receive console messages
    ws.send(JSON.stringify({
      id: messageId++,
      method: 'Runtime.enable'
    }));
    
    // Enable Console domain
    ws.send(JSON.stringify({
      id: messageId++,
      method: 'Console.enable'
    }));
    
    // Enable Log domain
    ws.send(JSON.stringify({
      id: messageId++,
      method: 'Log.enable'
    }));
    
    console.log('📞 Enabled Runtime, Console, and Log domains');
    console.log('👂 Listening for console logs...');
    console.log('💡 Go to your React Native app and trigger some console.log() messages!');
    console.log('   Example: console.log("Hello from React Native!");');
    console.log('');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle console API calls (console.log, console.warn, etc.)
      if (message.method === 'Runtime.consoleAPICalled') {
        const params = message.params;
        const level = params.type || 'log';
        const timestamp = new Date(params.timestamp).toISOString();
        
        console.log(`📝 [${timestamp}] [${level.toUpperCase()}]`);
        
        // Extract message from args
        const messages = params.args.map(arg => {
          if (arg.type === 'string') {
            return arg.value;
          } else if (arg.type === 'object' && arg.preview) {
            return arg.preview.description || '[Object]';
          } else {
            return arg.description || arg.value || '[Unknown]';
          }
        });
        
        console.log(`   Message: ${messages.join(' ')}`);
        
        if (params.stackTrace && params.stackTrace.callFrames.length > 0) {
          const frame = params.stackTrace.callFrames[0];
          console.log(`   Source: ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`);
        }
        console.log('');
      }
      
      // Handle runtime exceptions
      else if (message.method === 'Runtime.exceptionThrown') {
        const exception = message.params.exceptionDetails;
        const timestamp = new Date(exception.timestamp).toISOString();
        
        console.log(`🚨 [${timestamp}] [ERROR]`);
        console.log(`   Exception: ${exception.exception?.description || exception.text}`);
        
        if (exception.stackTrace && exception.stackTrace.callFrames.length > 0) {
          const frame = exception.stackTrace.callFrames[0];
          console.log(`   Source: ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`);
        }
        console.log('');
      }
      
      // Handle log entries
      else if (message.method === 'Log.entryAdded') {
        const entry = message.params.entry;
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = entry.level || 'info';
        
        console.log(`📋 [${timestamp}] [${level.toUpperCase()}]`);
        console.log(`   Text: ${entry.text}`);
        
        if (entry.source) {
          console.log(`   Source: ${entry.source}:${entry.line || 0}`);
        }
        console.log('');
      }
    } catch (error) {
      // Ignore parsing errors for non-JSON messages
    }
  });

  ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });

  // Keep the connection alive for 30 seconds
  setTimeout(() => {
    console.log('⏰ Test complete - closing connection');
    ws.close();
  }, 30000);
}

// Run the test
connectToReactNativeDebugger().catch(console.error);