export interface ReactNativeApp {
  id: string;
  title: string;
  description: string;
  appId: string;
  type: string;
  devtoolsFrontendUrl: string;
  webSocketDebuggerUrl: string;
  deviceName: string;
  reactNative?: {
    logicalDeviceId: string;
    capabilities: {
      prefersFuseboxFrontend: boolean;
      nativeSourceCodeFetching: boolean;
      nativePageReloads: boolean;
    };
  };
}

export interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  args: any[];
  source?: string;
  line?: number;
  column?: number;
}

export interface ChromeDevToolsMessage {
  id: number;
  method: string;
  params: any;
  result?: any;
  error?: any;
}

export interface RuntimeConsoleAPICalledParams {
  type: string;
  args: Array<{
    type: string;
    value?: any;
    description?: string;
  }>;
  executionContextId: number;
  timestamp: number;
  stackTrace?: {
    callFrames: Array<{
      functionName: string;
      scriptId: string;
      url: string;
      lineNumber: number;
      columnNumber: number;
    }>;
  };
}