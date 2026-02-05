/**
 * Load Balancer Utility for Multiple Render Servers
 * 
 * This utility distributes requests across multiple free Render server instances
 * with automatic failover and round-robin selection.
 */

export class LoadBalancer {
  constructor(serverUrls) {
    if (!serverUrls || serverUrls.length === 0) {
      throw new Error('At least one server URL is required');
    }

    this.servers = serverUrls.map(url => ({
      url: url.endsWith('/') ? url.slice(0, -1) : url,
      healthy: true,
      errorCount: 0,
    }));
    this.currentIndex = 0;
    this.maxErrors = 3;
    this.errorResetTime = 60000; // 1 minute
  }

  /**
   * Get the next server URL using round-robin algorithm
   */
  getNextServer() {
    const healthyServers = this.getHealthyServers();
    
    if (healthyServers.length === 0) {
      // All servers are unhealthy, reset all and try again
      console.warn('⚠️ All servers marked unhealthy, resetting...');
      this.resetAllServers();
      return this.servers[this.currentIndex].url;
    }

    // Round-robin selection from healthy servers
    const server = healthyServers[this.currentIndex % healthyServers.length];
    this.currentIndex = (this.currentIndex + 1) % healthyServers.length;
    
    return server.url;
  }

  /**
   * Get a random server from healthy servers
   */
  getRandomServer() {
    const healthyServers = this.getHealthyServers();
    
    if (healthyServers.length === 0) {
      console.warn('⚠️ All servers marked unhealthy, resetting...');
      this.resetAllServers();
      return this.servers[Math.floor(Math.random() * this.servers.length)].url;
    }

    const randomIndex = Math.floor(Math.random() * healthyServers.length);
    return healthyServers[randomIndex].url;
  }

  /**
   * Get all healthy servers
   */
  getHealthyServers() {
    const now = Date.now();
    return this.servers.filter(server => {
      // Reset server health if enough time has passed since last error
      if (!server.healthy && server.lastError) {
        if (now - server.lastError > this.errorResetTime) {
          server.healthy = true;
          server.errorCount = 0;
          server.lastError = undefined;
          console.log(`✅ Server ${server.url} reset to healthy`);
        }
      }
      return server.healthy;
    });
  }

  /**
   * Mark a server as unhealthy due to an error
   */
  markServerUnhealthy(serverUrl, error) {
    const server = this.servers.find(s => s.url === serverUrl);
    if (!server) return;

    server.errorCount++;
    server.lastError = Date.now();

    if (server.errorCount >= this.maxErrors) {
      server.healthy = false;
      console.warn(`❌ Server ${serverUrl} marked as unhealthy (${server.errorCount} errors)`);
    } else {
      console.warn(`⚠️ Server ${serverUrl} error count: ${server.errorCount}/${this.maxErrors}`);
    }
  }

  /**
   * Mark a server as healthy (after successful request)
   */
  markServerHealthy(serverUrl) {
    const server = this.servers.find(s => s.url === serverUrl);
    if (server && !server.healthy) {
      server.healthy = true;
      server.errorCount = 0;
      server.lastError = undefined;
      console.log(`✅ Server ${serverUrl} marked as healthy`);
    } else if (server) {
      // Reset error count on successful request
      server.errorCount = 0;
    }
  }

  /**
   * Reset all servers to healthy state
   */
  resetAllServers() {
    this.servers.forEach(server => {
      server.healthy = true;
      server.errorCount = 0;
      server.lastError = undefined;
    });
  }

  /**
   * Get all server URLs
   */
  getAllServers() {
    return this.servers.map(s => s.url);
  }

  /**
   * Get server health status
   */
  getServerStatus() {
    return this.servers.map(s => ({
      url: s.url,
      healthy: s.healthy,
      errorCount: s.errorCount,
    }));
  }
}

/**
 * Create a load balancer instance with retry logic
 * This function will try each server in sequence until one succeeds
 */
export async function requestWithLoadBalancer(
  loadBalancer,
  requestFn,
  strategy = 'failover'
) {
  const allServers = loadBalancer.getAllServers();
  const healthyServers = loadBalancer.getServerStatus()
    .filter(s => s.healthy)
    .map(s => s.url);
  
  // Use healthy servers if available, otherwise use all servers
  const serversToTry = healthyServers.length > 0 ? healthyServers : allServers;
  
  let lastError = null;

  for (let i = 0; i < serversToTry.length; i++) {
    let serverUrl;
    
    if (strategy === 'random') {
      serverUrl = loadBalancer.getRandomServer();
    } else if (strategy === 'round-robin') {
      serverUrl = loadBalancer.getNextServer();
    } else {
      // failover: try servers in order
      serverUrl = serversToTry[i];
    }

    try {
      const result = await requestFn(serverUrl);
      // Mark server as healthy on success
      loadBalancer.markServerHealthy(serverUrl);
      return result;
    } catch (error) {
      lastError = error;
      // Mark server as unhealthy
      loadBalancer.markServerUnhealthy(serverUrl, error);
      
      // If this is a network error or timeout, try next server
      if (error.code === 'ECONNABORTED' || 
          error.code === 'ENOTFOUND' || 
          error.code === 'ECONNREFUSED' ||
          error.message?.includes('timeout') ||
          error.message?.includes('Network Error') ||
          !error.response) {
        console.warn(`⚠️ Server ${serverUrl} failed, trying next server...`);
        continue;
      }
      
      // For HTTP errors (4xx, 5xx), only retry on 5xx or specific network issues
      if (error.response?.status >= 500) {
        console.warn(`⚠️ Server ${serverUrl} returned ${error.response.status}, trying next server...`);
        continue;
      }
      
      // For 4xx errors (client errors), don't retry - return the error
      throw error;
    }
  }

  // All servers failed
  throw lastError || new Error('All servers failed');
}
