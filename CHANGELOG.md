# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-06-14

### Added
- Initial release of React Native MCP Server
- Auto-discovery of Metro servers on common ports
- WebSocket connection to React Native debugger
- Real-time console log capture
- MCP tools for listing connected apps and reading logs
- Support for multiple connected React Native applications
- Chrome DevTools Protocol integration
- TypeScript support with full type definitions

### Features
- `getConnectedApps()` - Lists all connected React Native applications
- `readConsoleLogsFromApp()` - Captures console logs from specific apps
- Automatic WebSocket URL discovery from Metro inspector API
- Support for console.log, console.warn, console.error, and runtime exceptions