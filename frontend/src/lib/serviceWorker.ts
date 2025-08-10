// Service Worker Registration and Management
import React from 'react';
import { toast } from 'sonner';

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = config;
  }

  // Register service worker
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for updates
      });

      this.registration = registration;

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available
              this.config.onUpdate?.(registration);
              this.showUpdateNotification();
            }
          });
        }
      });

      // Handle successful registration
      if (registration.active) {
        this.config.onSuccess?.(registration);
      }

      // Check for updates periodically
      this.startUpdateCheck();

      return registration;
    } catch (error) {
      this.config.onError?.(error as Error);
      return null;
    }
  }

  // Unregister service worker
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      return result;
    } catch (error) {
      return false;
    }
  }

  // Update service worker
  async update(): Promise<void> {
    if (!this.registration) {
      console.warn('No service worker registration found');
      return;
    }

    try {
      await this.registration.update();
    } catch (error) {
    }
  }

  // Skip waiting and activate new service worker
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) {
      return;
    }

    // Send message to service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload page after activation
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  // Show update notification to user
  private showUpdateNotification(): void {
    toast.info('New version available!', {
      description: 'Click to update and get the latest features.',
      action: {
        label: 'Update',
        onClick: () => this.skipWaiting(),
      },
      duration: 10000, // Show for 10 seconds
    });
  }

  // Start periodic update checks
  private startUpdateCheck(): void {
    // Check for updates every 30 minutes
    setInterval(() => {
      this.update();
    }, 30 * 60 * 1000);

    // Check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.update();
      }
    });
  }

  // Get service worker status
  getStatus(): {
    supported: boolean;
    registered: boolean;
    active: boolean;
    waiting: boolean;
    installing: boolean;
  } {
    return {
      supported: 'serviceWorker' in navigator,
      registered: !!this.registration,
      active: !!this.registration?.active,
      waiting: !!this.registration?.waiting,
      installing: !!this.registration?.installing,
    };
  }

  // Send message to service worker
  async sendMessage(message: any): Promise<any> {
    if (!this.registration?.active) {
      throw new Error('No active service worker');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      this.registration!.active!.postMessage(message, [messageChannel.port2]);
    });
  }

  // Background sync registration
  async registerBackgroundSync(tag: string): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    if ('sync' in this.registration) {
      try {
        await (this.registration as any).sync.register(tag);
      } catch (error) {
      }
    }
  }

  // Push notification subscription
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.VITE_VAPID_PUBLIC_KEY || ''
        ),
      });

      return subscription;
    } catch (error) {
      return null;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        const result = await subscription.unsubscribe();
        return result;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Utility function to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Cache management
  async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  }

  // Get cache information
  async getCacheInfo(): Promise<{
    caches: string[];
    totalSize: number;
  }> {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return {
      caches: cacheNames,
      totalSize,
    };
  }
}

// Global service worker manager instance
export const serviceWorkerManager = new ServiceWorkerManager({
  onUpdate: (registration) => {
  },
  onSuccess: (registration) => {
  },
  onError: (error) => {
  },
});

// React hook for service worker
export const useServiceWorker = () => {
  const [status, setStatus] = React.useState(serviceWorkerManager.getStatus());
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    // Register service worker
    serviceWorkerManager.register();

    // Update status periodically
    const interval = setInterval(() => {
      setStatus(serviceWorkerManager.getStatus());
    }, 1000);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    status,
    isOnline,
    update: () => serviceWorkerManager.update(),
    skipWaiting: () => serviceWorkerManager.skipWaiting(),
    clearCache: (cacheName?: string) => serviceWorkerManager.clearCache(cacheName),
    getCacheInfo: () => serviceWorkerManager.getCacheInfo(),
    subscribeToPush: () => serviceWorkerManager.subscribeToPush(),
    unsubscribeFromPush: () => serviceWorkerManager.unsubscribeFromPush(),
  };
};

export default serviceWorkerManager;
