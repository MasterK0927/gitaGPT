import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  fps: number;
  loadTime: number;
  networkLatency: number;
}

interface PerformanceConfig {
  enableFPSMonitoring?: boolean;
  enableMemoryMonitoring?: boolean;
  enableNetworkMonitoring?: boolean;
  reportingInterval?: number;
  onMetricsUpdate?: (metrics: Partial<PerformanceMetrics>) => void;
}

export const usePerformanceMonitor = (config: PerformanceConfig = {}) => {
  const {
    enableFPSMonitoring = true,
    enableMemoryMonitoring = true,
    enableNetworkMonitoring = true,
    reportingInterval = 5000, // 5 seconds
    onMetricsUpdate,
  } = config;

  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  // FPS Monitoring
  useEffect(() => {
    if (!enableFPSMonitoring) return;

    let animationId: number;

    const measureFPS = () => {
      frameCountRef.current++;
      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [enableFPSMonitoring]);

  // Memory Monitoring
  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
    return 0;
  };

  // Network Latency Monitoring
  const measureNetworkLatency = async (): Promise<number> => {
    if (!enableNetworkMonitoring) return 0;

    try {
      const start = performance.now();
      await fetch('/api/health', { method: 'HEAD' });
      const end = performance.now();
      return end - start;
    } catch (error) {
      console.warn('Network latency measurement failed:', error);
      return 0;
    }
  };

  // Component Render Time Monitoring
  const measureRenderTime = (componentName: string) => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 16) { // Log slow renders (>16ms for 60fps)
      }

      setMetrics(prev => ({
        ...prev,
        renderTime,
      }));
    };
  };

  // Page Load Time
  const getLoadTime = (): number => {
    if ('navigation' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navigation.loadEventEnd - navigation.navigationStart;
    }
    return 0;
  };

  // Core Web Vitals
  const getCoreWebVitals = () => {
    const vitals = {
      lcp: 0, // Largest Contentful Paint
      fid: 0, // First Input Delay
      cls: 0, // Cumulative Layout Shift
    };

    // LCP
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
      }

      // CLS
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
      }
    }

    return vitals;
  };

  // Resource Performance
  const getResourceMetrics = () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const metrics = {
      totalResources: resources.length,
      slowResources: resources.filter(r => r.duration > 1000).length,
      averageLoadTime: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length,
      largestResource: Math.max(...resources.map(r => r.transferSize || 0)),
    };

    return metrics;
  };

  // Bundle Analysis
  const getBundleMetrics = () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    return {
      scriptCount: scripts.length,
      styleCount: styles.length,
      totalAssets: scripts.length + styles.length,
    };
  };

  // Performance Budget check
  const checkPerformanceBudget = (metrics: Partial<PerformanceMetrics>) => {
    const budget = {
      maxRenderTime: 16, // 60fps
      maxMemoryUsage: 50, // 50MB
      minFPS: 30,
      maxLoadTime: 3000, // 3 seconds
      maxNetworkLatency: 200, // 200ms
    };

    const violations = [];

    if (metrics.renderTime && metrics.renderTime > budget.maxRenderTime) {
      violations.push(`Render time exceeded: ${metrics.renderTime}ms > ${budget.maxRenderTime}ms`);
    }

    if (metrics.memoryUsage && metrics.memoryUsage > budget.maxMemoryUsage) {
      violations.push(`Memory usage exceeded: ${metrics.memoryUsage}MB > ${budget.maxMemoryUsage}MB`);
    }

    if (metrics.fps && metrics.fps < budget.minFPS) {
      violations.push(`FPS below threshold: ${metrics.fps} < ${budget.minFPS}`);
    }

    if (metrics.loadTime && metrics.loadTime > budget.maxLoadTime) {
      violations.push(`Load time exceeded: ${metrics.loadTime}ms > ${budget.maxLoadTime}ms`);
    }

    if (metrics.networkLatency && metrics.networkLatency > budget.maxNetworkLatency) {
      violations.push(`Network latency exceeded: ${metrics.networkLatency}ms > ${budget.maxNetworkLatency}ms`);
    }

    if (violations.length > 0) {
      console.warn('Performance budget violations:', violations);
    }

    return violations;
  };

  // Main metrics collection
  useEffect(() => {
    const collectMetrics = async () => {
      const currentTime = performance.now();
      const timeDiff = currentTime - lastTimeRef.current;
      
      const newMetrics: Partial<PerformanceMetrics> = {};

      // Calculate FPS
      if (enableFPSMonitoring) {
        const fps = Math.round((frameCountRef.current * 1000) / timeDiff);
        newMetrics.fps = fps;
        frameCountRef.current = 0;
      }

      // Memory usage
      if (enableMemoryMonitoring) {
        newMetrics.memoryUsage = getMemoryUsage();
      }

      // Network latency
      if (enableNetworkMonitoring) {
        newMetrics.networkLatency = await measureNetworkLatency();
      }

      // Load time (only once)
      if (!metrics.loadTime) {
        newMetrics.loadTime = getLoadTime();
      }

      lastTimeRef.current = currentTime;
      
      setMetrics(prev => ({ ...prev, ...newMetrics }));
      
      // Check performance budget
      checkPerformanceBudget(newMetrics);
      
      // Call custom callback
      onMetricsUpdate?.(newMetrics);
    };

    intervalRef.current = setInterval(collectMetrics, reportingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enableFPSMonitoring, enableMemoryMonitoring, enableNetworkMonitoring, reportingInterval, onMetricsUpdate]);

  // Performance report
  const generateReport = () => {
    const coreVitals = getCoreWebVitals();
    const resourceMetrics = getResourceMetrics();
    const bundleMetrics = getBundleMetrics();

    return {
      timestamp: new Date().toISOString(),
      metrics,
      coreVitals,
      resourceMetrics,
      bundleMetrics,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt,
      } : null,
    };
  };

  // Export metrics to external service
  const exportMetrics = async () => {
    const report = generateReport();
    
    try {
      await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
    } catch (error) {
      console.error('Failed to export performance metrics:', error);
    }
  };

  return {
    metrics,
    measureRenderTime,
    generateReport,
    exportMetrics,
    checkPerformanceBudget: () => checkPerformanceBudget(metrics),
  };
};

// HOC for automatic performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => {
    const { measureRenderTime } = usePerformanceMonitor();
    
    useEffect(() => {
      const endMeasurement = measureRenderTime(componentName || Component.name || 'Unknown');
      return endMeasurement;
    });

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
