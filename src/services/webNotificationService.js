// Web Notification Service — Socket + Web Push (iOS Home Screen / PWA background)

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

class WebNotificationService {
  constructor() {
    this.browserId = null;
    this.registration = null;
    this.subscription = null;
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.isPushSupported =
      this.isSupported && 'PushManager' in window && 'PushSubscription' in window;
    this.isPermissionGranted =
      typeof Notification !== 'undefined' && Notification.permission === 'granted';
    this._api = null;
    this._profileId = null;
    this._initPromise = null;
    this._initializedProfileId = null;
  }

  isStandaloneApp() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      document.documentElement.classList.contains('standalone-ios') ||
      document.documentElement.classList.contains('standalone-pwa')
    );
  }

  isIosDevice() {
    const ua = navigator.userAgent || '';
    return (
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  /** iOS only allows Web Push for installed Home Screen apps */
  canUseBackgroundPush() {
    if (!this.isPushSupported) return false;
    if (this.isIosDevice()) return this.isStandaloneApp();
    return true;
  }

  needsUserGestureForPermission() {
    return this.isIosDevice() || Notification.permission === 'default';
  }

  generateBrowserId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const userAgent = navigator.userAgent;
    const combined = `${timestamp}-${random}-${btoa(userAgent).substring(0, 10)}`;
    return combined;
  }

  getBrowserId() {
    if (!this.browserId) {
      let storedId = null;
      try {
        storedId = localStorage.getItem('connect_browser_id');
      } catch (error) {
        try {
          storedId = sessionStorage.getItem('connect_browser_id');
        } catch (_) {}
      }

      if (!storedId) {
        storedId = this.generateBrowserId();
        try {
          localStorage.setItem('connect_browser_id', storedId);
        } catch (error) {
          try {
            sessionStorage.setItem('connect_browser_id', storedId);
          } catch (_) {}
        }
      }
      this.browserId = storedId;
    }
    return this.browserId;
  }

  isNotificationSupported() {
    return this.isSupported;
  }

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

  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker is not supported');
    }

    try {
      const allRegistrations = await navigator.serviceWorker.getRegistrations();
      const currentScope = `${window.location.origin}/`;

      for (const registration of allRegistrations) {
        try {
          if (registration.scope !== currentScope) {
            await registration.unregister();
            continue;
          }
          const active = registration.active;
          const installing = registration.installing;
          const waiting = registration.waiting;
          const isBroken =
            (installing && installing.state === 'redundant') ||
            (waiting && waiting.state === 'redundant') ||
            (!active && !installing && !waiting);
          if (isBroken) {
            await registration.unregister();
            continue;
          }
          if (active && registration.scope === currentScope) {
            this.registration = registration;
            return this.registration;
          }
        } catch (_) {}
      }

      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      await navigator.serviceWorker.ready;
      return this.registration;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Service Worker registration failed:', error);
      }
      return null;
    }
  }

  async fetchVapidPublicKey(api) {
    const res = await api.get('/web-notification/vapid-public-key');
    if (res?.data?.publicKey) return res.data.publicKey;
    throw new Error('VAPID public key unavailable');
  }

  async subscribeToPush(api, profileId) {
    if (!this.canUseBackgroundPush()) {
      console.warn(
        'Background Web Push not available (on iOS, open the Home Screen app)'
      );
      return null;
    }
    if (!this.isPermissionGranted) {
      throw new Error('Notification permission not granted');
    }

    const registration =
      this.registration || (await this.registerServiceWorker());
    if (!registration) {
      throw new Error('Service worker required for Web Push');
    }

    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await this.fetchVapidPublicKey(api);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    this.subscription = subscription;
    const json = subscription.toJSON();

    await api.post('/web-notification/subscribe', {
      profileId,
      browserId: this.getBrowserId(),
      userAgent: navigator.userAgent,
      subscription: {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
      },
    });

    console.log('Web Push subscription saved');
    return subscription;
  }

  async unsubscribeFromPush(api, profileId) {
    try {
      const registration =
        this.registration ||
        (await navigator.serviceWorker.getRegistration('/'));
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        if (api && profileId) {
          await api.post('/web-notification/unsubscribe', {
            profileId,
            endpoint,
          });
        }
      }
      this.subscription = null;
    } catch (error) {
      console.warn('unsubscribeFromPush failed:', error);
    }
  }

  async registerBrowserId(profileId, api) {
    const browserId = this.getBrowserId();
    const response = await api.post('/web-notification/register-browser', {
      profileId,
      browserId,
      userAgent: navigator.userAgent,
    });
    return response.data;
  }

  async unregisterBrowserId(profileId, api) {
    const browserId = this.getBrowserId();
    const response = await api.post('/web-notification/unregister-browser', {
      profileId,
      browserId,
    });
    return response.data;
  }

  async sendTestNotification(
    title = 'Test Notification',
    body = 'This is a test notification'
  ) {
    if (!this.isPermissionGranted) {
      throw new Error('Notification permission not granted');
    }
    if (this.registration) {
      return this.registration.showNotification(title, {
        body,
        icon: '/apple-touch-icon.png',
        badge: '/apple-touch-icon.png',
        tag: 'test-notification',
      });
    }
    return new Notification(title, {
      body,
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      tag: 'test-notification',
    });
  }

  /**
   * Soft init — does NOT force permission on iOS (needs a tap).
   * Registers SW + browserId; subscribes to push if already granted.
   */
  async initialize(profileId, api, socket) {
    this._api = api;
    this._profileId = profileId;

    if (!this.isSupported) {
      console.warn('Web notifications are not supported in this browser');
      return false;
    }

    if (this._initializedProfileId === profileId && this._initPromise) {
      return this._initPromise;
    }

    this._initializedProfileId = profileId;
    this._initPromise = this._initializeInternal(profileId, api, socket);
    return this._initPromise;
  }

  async _initializeInternal(profileId, api, socket) {
    try {
      try {
        await this.registerServiceWorker();
      } catch (swError) {
        console.warn('Service worker registration failed:', swError);
      }

      await this.registerBrowserId(profileId, api);

      if (socket && socket.disconnect) {
        const browserId = this.getBrowserId();
        socket.disconnect();
        socket.io.opts.query = {
          ...socket.io.opts.query,
          profile: profileId,
          browserId,
        };
        socket.connect();
      }

      this.isPermissionGranted = Notification.permission === 'granted';

      // Auto-subscribe only when permission already granted (or non-iOS)
      if (this.isPermissionGranted && this.canUseBackgroundPush()) {
        try {
          await this.subscribeToPush(api, profileId);
        } catch (pushErr) {
          console.warn('Push subscribe failed:', pushErr);
        }
      } else if (
        !this.isIosDevice() &&
        Notification.permission === 'default' &&
        !this.needsUserGestureForPermission()
      ) {
        const granted = await this.requestPermission();
        if (granted && this.canUseBackgroundPush()) {
          await this.subscribeToPush(api, profileId);
        }
      }

      return true;
    } catch (error) {
      console.error('Error initializing web notification service:', error);
      this._initializedProfileId = null;
      this._initPromise = null;
      return false;
    }
  }

  /**
   * Call from a button tap — required on iOS for permission + Push subscribe.
   */
  async enableBackgroundNotifications(profileId, api) {
    const pid = profileId || this._profileId;
    const client = api || this._api;
    if (!pid || !client) {
      throw new Error('Not ready — sign in first');
    }
    if (this.isIosDevice() && !this.isStandaloneApp()) {
      throw new Error(
        'On iPhone, open Connect from the Home Screen icon, then enable notifications'
      );
    }

    await this.registerServiceWorker();
    const granted = await this.requestPermission();
    if (!granted) {
      throw new Error('Notification permission denied');
    }

    await this.registerBrowserId(pid, client);
    await this.subscribeToPush(client, pid);
    return true;
  }

  async cleanup(profileId, api, { removePush = true } = {}) {
    try {
      if (removePush) {
        await this.unsubscribeFromPush(api, profileId);
      }
      await this.unregisterBrowserId(profileId, api);
      try {
        localStorage.removeItem('connect_browser_id');
      } catch (_) {
        try {
          sessionStorage.removeItem('connect_browser_id');
        } catch (_) {}
      }
      this.browserId = null;
    } catch (error) {
      console.error('Error cleaning up web notification service:', error);
    }
  }

  hasActivePushSubscription() {
    return !!this.subscription;
  }

  getStatus() {
    return {
      isSupported: this.isSupported,
      isPushSupported: this.isPushSupported,
      canUseBackgroundPush: this.canUseBackgroundPush(),
      isStandalone: this.isStandaloneApp(),
      isIos: this.isIosDevice(),
      isPermissionGranted: this.isPermissionGranted,
      permission:
        typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      browserId: this.browserId,
      registration: !!this.registration,
      subscription: !!this.subscription,
    };
  }
}

const webNotificationService = new WebNotificationService();

export default webNotificationService;
