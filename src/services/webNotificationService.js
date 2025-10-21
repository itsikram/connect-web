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
      let storedId = localStorage.getItem('connect_browser_id');
      
      if (!storedId) {
        storedId = this.generateBrowserId();
        localStorage.setItem('connect_browser_id', storedId);
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
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', this.registration);
      
      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available, notify user
            console.log('New content is available; please refresh.');
          }
        });
      });

      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
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

      // Register service worker
      await this.registerServiceWorker();

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
      localStorage.removeItem('connect_browser_id');
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
