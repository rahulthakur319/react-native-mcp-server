import fetch from 'node-fetch';
import { ReactNativeApp } from './types.js';

export class MetroDiscovery {
  private readonly defaultPorts: number[];

  constructor(customPorts?: number[]) {
    // Use custom ports if provided, otherwise use defaults with environment variable support
    this.defaultPorts = customPorts || this.getDefaultPorts();
  }

  /**
   * Get default ports from environment or fallback to standard React Native ports
   */
  private getDefaultPorts(): number[] {
    const envPorts = process.env.RN_METRO_PORTS;
    const envDefaultPort = process.env.RN_METRO_PORT || process.env.METRO_PORT;
    
    if (envPorts) {
      // Parse comma-separated port list: "8081,8082,8083"
      return envPorts.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
    }
    
    if (envDefaultPort) {
      const port = parseInt(envDefaultPort, 10);
      if (!isNaN(port)) {
        // If a specific port is set, check that port plus common alternatives
        return [port, port + 1, port + 2];
      }
    }
    
    // Standard React Native / Expo ports
    return [8081, 8082, 8083, 19000, 19001, 19002, 3000, 3001];
  }
  
  /**
   * Check if Metro server is running on a specific port
   */
  async isMetroRunning(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`http://localhost:${port}/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const status = await response.text();
      return status.includes('packager-status:running');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connected React Native apps from Metro server
   */
  async getConnectedApps(port: number): Promise<ReactNativeApp[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`http://localhost:${port}/json/list`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const apps = await response.json() as ReactNativeApp[];
      return Array.isArray(apps) ? apps : [];
    } catch (error) {
      console.error(`Failed to get apps from Metro on port ${port}:`, error);
      return [];
    }
  }

  /**
   * Discover all running Metro servers and their connected apps
   */
  async discoverAllApps(): Promise<Map<number, ReactNativeApp[]>> {
    const results = new Map<number, ReactNativeApp[]>();
    
    await Promise.all(
      this.defaultPorts.map(async (port) => {
        const isRunning = await this.isMetroRunning(port);
        if (isRunning) {
          const apps = await this.getConnectedApps(port);
          if (apps.length > 0) {
            results.set(port, apps);
          }
        }
      })
    );
    
    return results;
  }

  /**
   * Find the first available React Native app
   */
  async findFirstAvailableApp(): Promise<{ port: number; app: ReactNativeApp } | null> {
    const allApps = await this.discoverAllApps();
    
    for (const [port, apps] of allApps.entries()) {
      if (apps.length > 0) {
        return { port, app: apps[0] };
      }
    }
    
    return null;
  }

  /**
   * Get apps from a specific Metro port or discover automatically
   */
  async getAppsFromPort(port?: number): Promise<ReactNativeApp[]> {
    if (port) {
      return this.getConnectedApps(port);
    }
    
    // Auto-discover from all ports
    const allApps = await this.discoverAllApps();
    const apps: ReactNativeApp[] = [];
    
    for (const appList of allApps.values()) {
      apps.push(...appList);
    }
    
    return apps;
  }

  /**
   * Scan a range of ports for Metro servers
   */
  async scanPortRange(startPort: number, endPort: number): Promise<Map<number, ReactNativeApp[]>> {
    const results = new Map<number, ReactNativeApp[]>();
    const ports = Array.from({ length: endPort - startPort + 1 }, (_, i) => startPort + i);
    
    await Promise.all(
      ports.map(async (port) => {
        const isRunning = await this.isMetroRunning(port);
        if (isRunning) {
          const apps = await this.getConnectedApps(port);
          if (apps.length > 0) {
            results.set(port, apps);
          }
        }
      })
    );
    
    return results;
  }

  /**
   * Get all configured ports being scanned
   */
  getConfiguredPorts(): number[] {
    return [...this.defaultPorts];
  }
}