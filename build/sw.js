// Service Worker for Web Push Notifications and Offline Support
const CACHE_NAME = 'connect-app-v3';
const STATIC_CACHE_NAME = 'connect-static-v3';

// Resources to cache during installation (only essential ones)
// Other resources will be cached on-demand as they're loaded
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  // Always skip waiting first to activate immediately
  // Then try to cache resources (non-blocking - failures are OK)
  event.waitUntil(
    (async () => {
      try {
        // Skip waiting first
        await self.skipWaiting();
        console.log('Service Worker: Skip waiting complete');
      } catch (skipError) {
        console.warn('Service Worker: Skip waiting failed (non-critical):', skipError);
      }
      
      // Try to cache resources (non-blocking)
      try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        console.log('Service Worker: Cache opened, attempting to cache resources...');
        
        // Cache resources individually so one failure doesn't break installation
        const cachePromises = urlsToCache.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response && response.ok) {
              await cache.put(url, response);
              console.log('Service Worker: Cached', url);
              return { url, success: true };
            } else {
              console.warn('Service Worker: Failed to cache', url, '- Status:', response?.status);
              return { url, success: false };
            }
          } catch (error) {
            // Resource doesn't exist or failed to fetch - this is OK
            console.warn('Service Worker: Could not cache', url, ':', error.message);
            return { url, success: false };
          }
        });
        
        // Wait for all cache attempts (but don't fail if some fail)
        const results = await Promise.allSettled(cachePromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        console.log(`Service Worker: Installation complete - cached ${successful}/${urlsToCache.length} resources`);
      } catch (cacheError) {
        // Caching failed, but that's OK - installation still succeeds
        console.warn('Service Worker: Cache operation failed (non-critical):', cacheError);
      }
      
      // Always resolve successfully
      console.log('Service Worker: Installation handler completed successfully');
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip caching for localhost
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]' ||
                      self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1' || self.location.hostname === '[::1]';
  if (isLocalhost) {
    return; // Let browser handle requests directly, no caching
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for same origin)
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }

  // Skip Socket.IO and WebSocket connections
  if (url.pathname.startsWith('/socket.io/') || 
      request.url.startsWith('ws://') || 
      request.url.startsWith('wss://')) {
    return;
  }

  // Skip audio files to prevent download manager interception
  if (url.pathname.match(/\.(wav|mp3|ogg|m4a|aac)$/i)) {
    return;
  }

  // Skip API calls (they need network)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache-first strategy for static assets (HTML, CSS, JS, images, fonts)
  event.respondWith(
    (async () => {
      try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', request.url);
          return cachedResponse;
        }
        
        // If not in cache, fetch from network
        try {
          const networkResponse = await fetch(request);
          
          // Cache successful responses (200 status)
          if (networkResponse && networkResponse.status === 200) {
            // Clone the response before caching
            const responseToCache = networkResponse.clone();
            
            // Determine which cache to use
            const isStaticAsset = url.pathname.match(/\.(html|css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i) ||
                                 url.pathname === '/' ||
                                 url.pathname === '/index.html';
            
            const cacheToUse = isStaticAsset ? STATIC_CACHE_NAME : CACHE_NAME;
            
            // Cache the response
            caches.open(cacheToUse).then((cache) => {
              cache.put(request, responseToCache);
              console.log('Service Worker: Cached resource:', request.url);
            }).catch((cacheError) => {
              console.warn('Service Worker: Failed to cache:', request.url, cacheError);
            });
          }
          
          return networkResponse;
        } catch (fetchError) {
          console.log('Service Worker: Network fetch failed, trying cache:', request.url);
          
          // Network failed, try cache again (might have been cached by another request)
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If it's a navigation request (HTML page), return the cached index.html
          if (request.mode === 'navigate') {
            const indexCache = await caches.match('/index.html') || await caches.match('/');
            if (indexCache) {
              return indexCache;
            }
          }
          
          // Return offline fallback
          return new Response('You are offline. Please check your internet connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html; charset=utf-8'
            })
          });
        }
      } catch (error) {
        console.error('Service Worker: Fetch handler error:', error);
        // Try to return cached index.html as last resort
        try {
          const indexCache = await caches.match('/index.html') || await caches.match('/');
          if (indexCache) {
            return indexCache;
          }
        } catch (cacheError) {
          console.error('Service Worker: Failed to get cached index:', cacheError);
        }
        
        return new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      }
    })()
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data = { title: 'New Notification', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/logo192.png',
    badge: '/logo192.png',
    image: data.image,
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    timestamp: data.timestamp || Date.now(),
    vibrate: data.vibrate || [200, 100, 200],
    dir: 'ltr',
    lang: 'en',
    renotify: true,
    sticky: false
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Connect App',
      options
    )
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const urlToOpen = data.url || data.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (data.url || data.link) {
              client.navigate(data.url || data.link);
            }
            return;
          }
        }
        
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      Promise.resolve().then(() => {
        console.log('Background sync triggered');
        // Handle background sync logic here
      })
    );
  }
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
