// Web Notification Service
class WebNotificationService {
  constructor() {
    this.browserId = null;
    this.registration = null;
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.isPermissionGranted = false;
  }

  // Generate unique browser ID
  generateBrowserId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const userAgent = navigator.userAgent;
    const combined = `${timestamp}-${random}-${btoa(userAgent).substring(0, 10)}`;
    return combined;
  }

  // Get or create browser ID
  getBrowserId() {
    if (!this.browserId) {
      // Try to get from localStorage first
      let storedId = null;
      
      try {
        storedId = localStorage.getItem('connect_browser_id');
      } catch (error) {
        // If localStorage fails (quota exceeded, etc.), try sessionStorage
        console.warn('localStorage access failed, trying sessionStorage:', error);
        try {
          storedId = sessionStorage.getItem('connect_browser_id');
        } catch (sessionError) {
          console.error('Both localStorage and sessionStorage failed:', sessionError);
        }
      }
      
      if (!storedId) {
        storedId = this.generateBrowserId();
        
        // Try to store in localStorage, fallback to sessionStorage if quota exceeded
        try {
          localStorage.setItem('connect_browser_id', storedId);
        } catch (error) {
          if (error.name === 'QuotaExceededError' || error.name === 'DOMException') {
            console.warn('localStorage quota exceeded, using sessionStorage for browser ID');
            try {
              sessionStorage.setItem('connect_browser_id', storedId);
            } catch (sessionError) {
              console.error('Failed to store browser ID in sessionStorage:', sessionError);
              // Continue without storing - browser ID will be regenerated on next load
            }
          } else {
            throw error;
          }
        }
      }
      
      this.browserId = storedId;
    }
    return this.browserId;
  }

  // Check if notifications are supported
  isNotificationSupported() {
    return this.isSupported;
  }

  // Request notification permission
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Notifications are not supported in this browser');
    }

    try {
      const permission = await Notification.requestPermission();
      this.isPermissionGranted = permission === 'granted';
      return this.isPermissionGranted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Register service worker
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker is not supported');
    }

    try {
      // Check for existing service worker registrations
      const allRegistrations = await navigator.serviceWorker.getRegistrations();
      const currentScope = window.location.origin + '/';
      
      for (const registration of allRegistrations) {
        try {
          // Unregister service workers with different scopes
          if (registration.scope !== currentScope) {
            await registration.unregister();
            console.log('Unregistered service worker with different scope:', registration.scope);
            continue;
          }
          
          // Check if the service worker is in a broken/redundant state
          const installing = registration.installing;
          const waiting = registration.waiting;
          const active = registration.active;
          
          const isBroken = (installing && installing.state === 'redundant') || 
                          (waiting && waiting.state === 'redundant') ||
                          (!active && !installing && !waiting);
          
          if (isBroken) {
            await registration.unregister();
            console.log('Unregistered broken service worker:', registration.scope);
            continue;
          }
          
          // If we have an active service worker, use it
          if (active && registration.scope === currentScope) {
            console.log('Service Worker already registered and active');
            this.registration = registration;
            return this.registration;
          }
        } catch (unregisterError) {
          console.warn('Error checking/unregistering service worker:', unregisterError);
        }
      }

      // Register the service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always fetch fresh service worker
      });

      // Wait for the service worker to be ready (handle all states)
      const waitForReady = () => {
        return new Promise((resolve, reject) => {
          // If already active, resolve immediately
          if (this.registration.active) {
            resolve();
            return;
          }

          // If installing, wait for it
          if (this.registration.installing) {
            const worker = this.registration.installing;
            const handleStateChange = () => {
              if (worker.state === 'activated' || worker.state === 'installed') {
                worker.removeEventListener('statechange', handleStateChange);
                resolve();
              } else if (worker.state === 'redundant') {
                worker.removeEventListener('statechange', handleStateChange);
                reject(new Error('Service Worker installation failed - state: redundant'));
              }
            };
            worker.addEventListener('statechange', handleStateChange);
            
            // Timeout after 10 seconds
            setTimeout(() => {
              worker.removeEventListener('statechange', handleStateChange);
              reject(new Error('Service Worker registration timeout'));
            }, 10000);
            return;
          }

          // If waiting, wait for it to activate
          if (this.registration.waiting) {
            const worker = this.registration.waiting;
            // Try to activate it
            worker.postMessage({ type: 'SKIP_WAITING' });
            const handleStateChange = () => {
              if (worker.state === 'activated') {
                worker.removeEventListener('statechange', handleStateChange);
                resolve();
              }
            };
            worker.addEventListener('statechange', handleStateChange);
            
            setTimeout(() => {
              worker.removeEventListener('statechange', handleStateChange);
              // If still waiting after timeout, resolve anyway (it will activate on next page load)
              resolve();
            }, 5000);
            return;
          }

          // If we get here, the service worker might already be ready
          resolve();
        });
      };

      await waitForReady();
      console.log('Service Worker registered successfully:', this.registration);
      
      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify user
              console.log('New content is available; please refresh.');
            }
          });
        }
      });

      return this.registration;
    } catch (error) {
      // Only log errors in development mode to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.error('Service Worker registration failed:', error);
        console.debug('Continuing without service worker - notifications may be limited');
      }
      // Don't throw - allow the app to continue without service worker
      // This is a non-critical feature
      return null;
    }
  }

  // Register browser ID with server
  async registerBrowserId(profileId, api) {
    const browserId = this.getBrowserId();
    
    try {
      const response = await api.post('/web-notification/register-browser', {
        profileId,
        browserId,
        userAgent: navigator.userAgent
      });
      
      console.log('Browser ID registered successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error registering browser ID:', error);
      throw error;
    }
  }

  // Unregister browser ID from server
  async unregisterBrowserId(profileId, api) {
    const browserId = this.getBrowserId();
    
    try {
      const response = await api.post('/web-notification/unregister-browser', {
        profileId,
        browserId
      });
      
      console.log('Browser ID unregistered successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error unregistering browser ID:', error);
      throw error;
    }
  }

  // Send test notification
  async sendTestNotification(title = 'Test Notification', body = 'This is a test notification') {
    if (!this.isPermissionGranted) {
      throw new Error('Notification permission not granted');
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'test-notification',
        requireInteraction: false,
        silent: false
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      throw error;
    }
  }

  // Initialize the notification service
  async initialize(profileId, api, socket) {
    if (!this.isSupported) {
      console.warn('Web notifications are not supported in this browser');
      return false;
    }

    try {
      // Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Notification permission denied');
        return false;
      }

      // Register service worker (non-blocking - continue even if it fails)
      try {
        await this.registerServiceWorker();
      } catch (swError) {
        console.warn('Service worker registration failed, continuing without it:', swError);
        // Continue without service worker - notifications will still work but may be limited
      }

      // Register browser ID with server
      await this.registerBrowserId(profileId, api);

      // If socket is provided, reconnect with browser ID
      if (socket && socket.disconnect) {
        const browserId = this.getBrowserId();
        socket.disconnect();
        socket.io.opts.query = { 
          ...socket.io.opts.query, 
          profile: profileId,
          browserId: browserId
        };
        socket.connect();
      }

      console.log('Web notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing web notification service:', error);
      return false;
    }
  }

  // Cleanup when user logs out
  async cleanup(profileId, api) {
    try {
      await this.unregisterBrowserId(profileId, api);
      try {
        localStorage.removeItem('connect_browser_id');
      } catch (error) {
        // If localStorage fails, try sessionStorage
        try {
          sessionStorage.removeItem('connect_browser_id');
        } catch (sessionError) {
          console.warn('Could not remove browser ID from storage:', sessionError);
        }
      }
      this.browserId = null;
      console.log('Web notification service cleaned up');
    } catch (error) {
      console.error('Error cleaning up web notification service:', error);
    }
  }

  // Get notification status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isPermissionGranted: this.isPermissionGranted,
      browserId: this.browserId,
      registration: !!this.registration
    };
  }
}

// Create singleton instance
const webNotificationService = new WebNotificationService();

export default webNotificationService;
