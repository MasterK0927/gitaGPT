// GITA AI Service Worker - Advanced Caching and Offline Support
const CACHE_NAME = 'gita-ai-v2.0.0';
const STATIC_CACHE = 'gita-ai-static-v2.0.0';
const DYNAMIC_CACHE = 'gita-ai-dynamic-v2.0.0';
const API_CACHE = 'gita-ai-api-v2.0.0';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/models/krishna.glb',
  // Add other critical assets
];

// API endpoints to cache
const CACHEABLE_APIS = [
  '/api/health',
  '/api/user/profile',
  '/api/chat/conversations',
];

// Network-first strategies for these patterns
const NETWORK_FIRST_PATTERNS = [
  /\/api\/chat\/send/,
  /\/api\/logs/,
  /\/api\/auth/,
];

// Cache-first strategies for these patterns
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /\.(?:js|css|woff2|woff|ttf)$/,
  /\/models\//,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(handleCacheFirst(request));
  } else if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(handleNetworkFirst(request));
  } else {
    event.respondWith(handleStaleWhileRevalidate(request));
  }
});

// Cache-first strategy (for static assets)
async function handleCacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for dynamic content)
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy (for general content)
async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Return cached response if network fails
    return cachedResponse;
  });

  // Return cached response immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// API request handling with intelligent caching
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Check if this API should be cached
  const shouldCache = CACHEABLE_APIS.some(api => url.pathname.startsWith(api));
  
  if (!shouldCache) {
    // For non-cacheable APIs, just try network
    try {
      return await fetch(request);
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Network unavailable', 
        offline: true 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // For cacheable APIs, use network-first with longer cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      // Add timestamp to cached response
      const responseClone = networkResponse.clone();
      const responseData = await responseClone.json();
      const timestampedData = {
        ...responseData,
        _cached: true,
        _timestamp: Date.now()
      };
      
      const timestampedResponse = new Response(JSON.stringify(timestampedData), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: networkResponse.headers
      });
      
      cache.put(request, timestampedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('API network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify({ 
      error: 'Service unavailable', 
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'chat-message-sync') {
    event.waitUntil(syncChatMessages());
  } else if (event.tag === 'user-data-sync') {
    event.waitUntil(syncUserData());
  }
});

// Sync chat messages when back online
async function syncChatMessages() {
  try {
    // Get pending messages from IndexedDB
    const pendingMessages = await getPendingMessages();
    
    for (const message of pendingMessages) {
      try {
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          await removePendingMessage(message.id);
          console.log('Synced message:', message.id);
        }
      } catch (error) {
        console.error('Failed to sync message:', message.id, error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Sync user data when back online
async function syncUserData() {
  try {
    // Implementation for syncing user data
    console.log('Syncing user data...');
  } catch (error) {
    console.error('User data sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const options = {
    body: 'You have a new message from Krishna AI',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Chat',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('GITA AI', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/chat')
    );
  }
});

// Helper functions for IndexedDB operations
async function getPendingMessages() {
  // Implementation would use IndexedDB to get pending messages
  return [];
}

async function removePendingMessage(messageId) {
  // Implementation would remove message from IndexedDB
  console.log('Removing pending message:', messageId);
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function syncContent() {
  console.log('Periodic sync triggered');
  // Sync critical content in the background
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('GITA AI Service Worker loaded successfully');
