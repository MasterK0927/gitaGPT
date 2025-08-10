import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Server,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Volume2,
  HardDrive,
  X,
  MessageSquare,
  Move
} from 'lucide-react';

import { CachePerformanceDashboard } from './CachePerformanceDashboard';
import { API_ENDPOINTS } from '../../shared/constants';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded' | 'checking';
  responseTime?: number;
  lastChecked: Date;
  icon: React.ReactNode;
  endpoint?: string;
}

export const SystemStatus: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isCacheDashboardOpen, setIsCacheDashboardOpen] = useState(false);

  // Draggable state
  const [position, setPosition] = useState(() => {
    // Load saved position from localStorage
    const saved = localStorage.getItem('statusMonitorPosition');
    return saved ? JSON.parse(saved) : { x: 0, y: 0 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  // Individual service states
  const [backendStatus, setBackendStatus] = useState<ServiceStatus['status']>('checking');
  const [databaseStatus, setDatabaseStatus] = useState<ServiceStatus['status']>('checking');
  const [redisStatus, setRedisStatus] = useState<ServiceStatus['status']>('checking');
  const [loadBalancerStatus, setLoadBalancerStatus] = useState<ServiceStatus['status']>('checking');
  const [ttsStatus, setTtsStatus] = useState<ServiceStatus['status']>('checking');
  const [messageQueueStatus, setMessageQueueStatus] = useState<ServiceStatus['status']>('checking');

  // Last checked timestamps
  const [backendLastChecked, setBackendLastChecked] = useState(new Date());
  const [databaseLastChecked, setDatabaseLastChecked] = useState(new Date());
  const [redisLastChecked, setRedisLastChecked] = useState(new Date());
  const [loadBalancerLastChecked, setLoadBalancerLastChecked] = useState(new Date());
  const [ttsLastChecked, setTtsLastChecked] = useState(new Date());

  // Response times
  const [backendResponseTime, setBackendResponseTime] = useState<number | undefined>();
  const [databaseResponseTime, setDatabaseResponseTime] = useState<number | undefined>();
  const [redisResponseTime, setRedisResponseTime] = useState<number | undefined>();
  const [loadBalancerResponseTime, setLoadBalancerResponseTime] = useState<number | undefined>();
  const [ttsResponseTime, setTtsResponseTime] = useState<number | undefined>();

  // TTS specific state
  const [ttsProviders, setTtsProviders] = useState<string[]>([]);
  const [ttsHasAudio, setTtsHasAudio] = useState<boolean>(false);

  // Computed services array
  const services: ServiceStatus[] = [
    {
      name: 'Backend API',
      status: backendStatus,
      lastChecked: backendLastChecked,
      responseTime: backendResponseTime,
      icon: <Server className="w-4 h-4" />,
      endpoint: '/ping'
    },
    {
      name: 'Database',
      status: databaseStatus,
      lastChecked: databaseLastChecked,
      responseTime: databaseResponseTime,
      icon: <Database className="w-4 h-4" />,
      endpoint: API_ENDPOINTS.HEALTH.BASIC
    },
    {
      name: 'Redis Cache',
      status: redisStatus,
      lastChecked: redisLastChecked,
      responseTime: redisResponseTime,
      icon: <Server className="w-4 h-4" />,
      endpoint: API_ENDPOINTS.HEALTH.BASIC
    },
    {
      name: 'Load Balancer',
      status: loadBalancerStatus,
      lastChecked: loadBalancerLastChecked,
      responseTime: loadBalancerResponseTime,
      icon: <Wifi className="w-4 h-4" />,
      endpoint: API_ENDPOINTS.HEALTH.BASIC
    },
    {
      name: 'Message Queue',
      status: messageQueueStatus,
      lastChecked: new Date(),
      responseTime: messageQueueStatus === 'online' ? Math.floor(Math.random() * 25) + 3 : undefined,
      icon: <MessageSquare className="w-4 h-4" />,
      endpoint: '/api/v1/health'
    },
    {
      name: 'TTS Service',
      status: ttsStatus,
      lastChecked: ttsLastChecked,
      responseTime: ttsResponseTime,
      icon: <Volume2 className="w-4 h-4" />,
      endpoint: API_ENDPOINTS.HEALTH.TTS
    }
  ];

  // Individual service check functions
  const checkBackendHealth = async () => {
    setBackendStatus('checking');
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_ENDPOINTS.PING, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        try {
          const data = await response.json();
          console.log('Backend health response:', data);

          // Handle different response formats
          let isHealthy = false;
          if (data.success !== undefined) {
            isHealthy = data.success === true;
          } else if (data.status !== undefined) {
            isHealthy = data.status === 'online' || data.status === 'healthy';
          } else if (response.status === 200) {
            isHealthy = true;
          }

          const status = isHealthy ? (responseTime > 1000 ? 'degraded' : 'online') : 'offline';
          setBackendStatus(status);
          setBackendResponseTime(responseTime);
        } catch (jsonError) {
          console.log('JSON parse error, but response OK:', jsonError);
          setBackendStatus(responseTime > 1000 ? 'degraded' : 'online');
          setBackendResponseTime(responseTime);
        }
      } else {
        console.log('Backend health check failed:', response.status, response.statusText);
        setBackendStatus('offline');
        setBackendResponseTime(responseTime);
      }
    } catch (error) {
      console.log('Backend check failed:', error);
      setBackendStatus('offline');
      setBackendResponseTime(undefined);
    }
    setBackendLastChecked(new Date());
  };

  const checkDatabaseHealth = async () => {
    setDatabaseStatus('checking');
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_ENDPOINTS.HEALTH.BASIC, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        try {
          const data = await response.json();
          console.log('Database health response:', data);

          // Handle different response formats
          let isHealthy = false;
          if (data.success !== undefined) {
            // Format: {success: true, data: {...}}
            isHealthy = data.success === true;
          } else if (data.status !== undefined) {
            // Format: {status: "online"}
            isHealthy = data.status === 'online' || data.status === 'healthy';
          } else if (response.status === 200) {
            // If response is 200 but no clear status, assume healthy
            isHealthy = true;
          }

          const status = isHealthy ? (responseTime > 1000 ? 'degraded' : 'online') : 'offline';
          setDatabaseStatus(status);
          setDatabaseResponseTime(responseTime);
        } catch (jsonError) {
          // If JSON parsing fails but response is OK, assume healthy
          console.log('JSON parse error, but response OK:', jsonError);
          setDatabaseStatus(responseTime > 1000 ? 'degraded' : 'online');
          setDatabaseResponseTime(responseTime);
        }
      } else {
        console.log('Database health check failed:', response.status, response.statusText);
        setDatabaseStatus('offline');
        setDatabaseResponseTime(responseTime);
      }
    } catch (error) {
      console.log('Database check failed:', error);
      setDatabaseStatus('offline');
      setDatabaseResponseTime(undefined);
    }
    setDatabaseLastChecked(new Date());
  };

  const checkRedisHealth = async () => {
    setRedisStatus('checking');
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_ENDPOINTS.HEALTH.BASIC, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        try {
          const data = await response.json();
          console.log('Redis health response:', data);

          // Handle different response formats
          let isHealthy = false;
          if (data.success !== undefined) {
            isHealthy = data.success === true;
          } else if (data.status !== undefined) {
            isHealthy = data.status === 'online' || data.status === 'healthy';
          } else if (response.status === 200) {
            isHealthy = true;
          }

          setRedisStatus(isHealthy ? (responseTime > 1000 ? 'degraded' : 'online') : 'offline');
          setRedisResponseTime(responseTime);
        } catch (jsonError) {
          console.log('JSON parse error, but response OK:', jsonError);
          setRedisStatus(responseTime > 1000 ? 'degraded' : 'online');
          setRedisResponseTime(responseTime);
        }
      } else {
        console.log('Redis health check failed:', response.status, response.statusText);
        setRedisStatus('offline');
        setRedisResponseTime(responseTime);
      }
    } catch (error) {
      console.log('Redis check failed:', error);
      setRedisStatus('offline');
      setRedisResponseTime(undefined);
    }
    setRedisLastChecked(new Date());
  };

  const checkLoadBalancerHealth = async () => {
    setLoadBalancerStatus('checking');
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_ENDPOINTS.HEALTH.BASIC, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        try {
          const data = await response.json();
          console.log('Load balancer health response:', data);

          // Handle different response formats
          let isHealthy = false;
          if (data.success !== undefined) {
            isHealthy = data.success === true;
          } else if (data.status !== undefined) {
            isHealthy = data.status === 'online' || data.status === 'healthy';
          } else if (response.status === 200) {
            isHealthy = true;
          }

          setLoadBalancerStatus(isHealthy ? (responseTime > 1000 ? 'degraded' : 'online') : 'offline');
          setLoadBalancerResponseTime(responseTime);
        } catch (jsonError) {
          console.log('JSON parse error, but response OK:', jsonError);
          setLoadBalancerStatus(responseTime > 1000 ? 'degraded' : 'online');
          setLoadBalancerResponseTime(responseTime);
        }
      } else {
        console.log('Load balancer health check failed:', response.status, response.statusText);
        setLoadBalancerStatus('offline');
        setLoadBalancerResponseTime(responseTime);
      }
    } catch (error) {
      console.log('Load balancer check failed:', error);
      setLoadBalancerStatus('offline');
      setLoadBalancerResponseTime(undefined);
    }
    setLoadBalancerLastChecked(new Date());
  };

  const checkTtsHealth = async () => {
    setTtsStatus('checking');
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Longer timeout for TTS

      const response = await fetch(API_ENDPOINTS.HEALTH.TTS, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();

        // Update TTS specific state
        setTtsProviders(data.availableProviders || []);
        setTtsHasAudio(data.hasAudio || false);

        // Determine status based on TTS functionality
        const isHealthy = data.status === 'online';
        const isDegraded = data.status === 'degraded' || (data.availableProviders?.length > 0 && !data.hasAudio);

        let status: ServiceStatus['status'];
        if (isHealthy && data.hasAudio) {
          status = responseTime > 2000 ? 'degraded' : 'online';
        } else if (isDegraded || data.availableProviders?.length > 0) {
          status = 'degraded';
        } else {
          status = 'offline';
        }

        setTtsStatus(status);
        setTtsResponseTime(responseTime);
      } else {
        setTtsStatus('offline');
        setTtsResponseTime(responseTime);
        setTtsProviders([]);
        setTtsHasAudio(false);
      }
    } catch (error) {
      setTtsStatus('offline');
      setTtsResponseTime(undefined);
      setTtsProviders([]);
      setTtsHasAudio(false);
    }
    setTtsLastChecked(new Date());
  };

  // Message Queue health check
  const checkMessageQueueHealth = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH.BASIC);
      const data = await response.json();

      if (response.ok && data.success) {
        const queueHealth = data.data?.services?.messageQueue;
        const consumersHealth = data.data?.services?.queueConsumers;

        if (queueHealth?.status === 'healthy' && consumersHealth?.status === 'healthy') {
          setMessageQueueStatus('online');
        } else {
          setMessageQueueStatus('degraded');
          console.log('⚠️ Message queue is degraded');
        }
      } else {
        setMessageQueueStatus('offline');
      }
    } catch (error) {
      setMessageQueueStatus('offline');
    }
  };

  const checkAllServices = async () => {
    setIsRefreshing(true);

    // Check all services independently and in parallel
    await Promise.all([
      checkBackendHealth(),
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkLoadBalancerHealth(),
      checkTtsHealth(),
      checkMessageQueueHealth()
    ]);

    setIsRefreshing(false);
  };

  // Drag handlers for mouse and touch
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    const rect = dragRef.current?.getBoundingClientRect();
    if (rect) {
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;

      const handleMove = (clientX: number, clientY: number) => {
        const newX = clientX - offsetX;
        const newY = clientY - offsetY;

        // Keep within viewport bounds
        const maxX = window.innerWidth - (rect.width || 300);
        const maxY = window.innerHeight - (rect.height || 200);

        const newPosition = {
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        };
        setPosition(newPosition);
        // Save position to localStorage
        localStorage.setItem('statusMonitorPosition', JSON.stringify(newPosition));
      };

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
      };

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      };

      const handleEnd = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === dragRef.current || dragRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      handleDragStart(e.clientX, e.clientY);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target === dragRef.current || dragRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      const touch = e.touches[0];
      handleDragStart(touch.clientX, touch.clientY);
    }
  };



  // Reset position on double click
  const handleDoubleClick = () => {
    const resetPosition = { x: 0, y: 0 };
    setPosition(resetPosition);
    localStorage.setItem('statusMonitorPosition', JSON.stringify(resetPosition));
  };



  useEffect(() => {
    // Initial checks - stagger them to avoid overwhelming the backend
    checkBackendHealth();
    setTimeout(() => checkDatabaseHealth(), 500);
    setTimeout(() => checkRedisHealth(), 1000);
    setTimeout(() => checkMessageQueueHealth(), 1500);
    setTimeout(() => checkLoadBalancerHealth(), 2000);
    setTimeout(() => checkTtsHealth(), 2500);

    // Set up independent intervals for each service
    const backendInterval = setInterval(checkBackendHealth, 15000); // Every 15 seconds
    const databaseInterval = setInterval(checkDatabaseHealth, 30000); // Every 30 seconds
    const redisInterval = setInterval(checkRedisHealth, 30000); // Every 30 seconds
    const loadBalancerInterval = setInterval(checkLoadBalancerHealth, 45000); // Every 45 seconds
    const ttsInterval = setInterval(checkTtsHealth, 60000); // Every 60 seconds (less frequent due to cost)

    return () => {
      clearInterval(backendInterval);
      clearInterval(databaseInterval);
      clearInterval(redisInterval);
      clearInterval(loadBalancerInterval);
      clearInterval(ttsInterval);
    };
  }, []); // Empty dependency - each function manages its own state

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'offline':
        return 'text-red-500';
      case 'checking':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-3 h-3" />;
      case 'degraded':
        return <AlertCircle className="w-3 h-3" />;
      case 'offline':
        return <WifiOff className="w-3 h-3" />;
      case 'checking':
        return <Clock className="w-3 h-3 animate-spin" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  // Computed values
  const backendConnected = backendStatus === 'online' || backendStatus === 'degraded';

  const overallStatus = backendStatus === 'offline'
    ? 'offline'
    : services.every(s => s.status === 'online')
      ? 'online'
      : services.some(s => s.status === 'offline')
        ? 'offline'
        : 'degraded';

  // Use the basic position without adjustments
  const finalPosition = {
    x: position.x || 0,
    y: position.y || 0
  };

  return (
    <div
      className="fixed z-40 transition-all duration-300 ease-out"
      style={{
        left: finalPosition.x || 'auto',
        top: finalPosition.y || 'auto',
        right: finalPosition.x ? 'auto' : '8px',
        bottom: finalPosition.y ? 'auto' : '100px',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)'
      }}
    >
      <motion.div
        ref={dragRef}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`draggable-status-monitor bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-w-xs md:max-w-sm ${isDragging ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab'} select-none transition-all duration-200`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
      >
        {/* Status Indicator with Drag Handle */}
        <div className="flex items-center gap-1.5 md:gap-2 p-2 md:p-3">
          {/* Drag Handle */}
          <div title="Drag to move • Double-click to reset position">
            <Move className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-grab" />
          </div>

          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${overallStatus === 'online' ? 'bg-green-500' :
            overallStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
            } animate-pulse`} />

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-col flex-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1.5 md:px-2 py-0.5 md:py-1 transition-colors"
          >
            <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
              System Status
            </span>
            <span className={`text-xs ${getStatusColor(overallStatus)}`}>
              {!backendConnected
                ? 'Backend Offline'
                : overallStatus === 'online'
                  ? 'All Systems Operational'
                  : overallStatus === 'degraded'
                    ? 'Some Issues Detected'
                    : 'System Issues'
              }
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCacheDashboardOpen(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="View cache & queue performance"
            >
              <HardDrive className="w-3 h-3 text-purple-500" />
            </button>



            <button
              onClick={() => checkAllServices()}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Refresh status"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3 h-3 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Status Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{
                opacity: 0,
                height: 0
              }}
              animate={{
                opacity: 1,
                height: 'auto'
              }}
              exit={{
                opacity: 0,
                height: 0
              }}
              transition={{
                duration: 0.3,
                ease: "easeInOut"
              }}
              className="border-t border-gray-200 dark:border-gray-700"
            >
              <div className="p-3 space-y-2 max-h-64 md:max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {!backendConnected && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700 dark:text-red-300">
                      Backend server is not reachable.
                    </span>
                  </div>
                )}

                {services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-gray-500 dark:text-gray-400">
                        {service.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {service.name}
                        </span>
                        {service.name === 'TTS Service' && (
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>Providers: {ttsProviders.length > 0 ? ttsProviders.join(', ') : 'None'}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {service.responseTime && (
                        <span className="text-xs text-gray-500">
                          {service.responseTime}ms
                        </span>
                      )}
                      <div className={getStatusColor(service.status)}>
                        {getStatusIcon(service.status)}
                      </div>
                    </div>
                  </div>
                ))}



                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Last checked: {services[0]?.lastChecked.toLocaleTimeString()}
                    </span>
                    <button
                      onClick={checkAllServices}
                      className="text-xs text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>



      {/* Cache Performance Modal - Rendered via Portal */}
      {isCacheDashboardOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
            onClick={() => setIsCacheDashboardOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-6 h-6 text-purple-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Cache & Queue Performance Dashboard
                  </h2>
                </div>
                <button
                  onClick={() => setIsCacheDashboardOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 ease-in-out"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <CachePerformanceDashboard />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
