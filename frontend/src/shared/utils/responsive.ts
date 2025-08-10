// Responsive utility functions and classes
import { useState, useEffect } from 'react';

// Breakpoint constants
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Hook to detect screen size
export const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenSize;
};

// Hook to detect if mobile
export const useIsMobile = () => {
  const { width } = useScreenSize();
  return width < BREAKPOINTS.md;
};

// Hook to detect if tablet
export const useIsTablet = () => {
  const { width } = useScreenSize();
  return width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
};

// Hook to detect if desktop
export const useIsDesktop = () => {
  const { width } = useScreenSize();
  return width >= BREAKPOINTS.lg;
};

// Responsive class utilities
export const responsiveClasses = {
  // Spacing
  padding: {
    sm: 'p-2 md:p-3 lg:p-4',
    md: 'p-3 md:p-4 lg:p-6',
    lg: 'p-4 md:p-6 lg:p-8',
  },
  margin: {
    sm: 'm-2 md:m-3 lg:m-4',
    md: 'm-3 md:m-4 lg:m-6',
    lg: 'm-4 md:m-6 lg:m-8',
  },
  gap: {
    sm: 'gap-1 md:gap-2',
    md: 'gap-2 md:gap-3',
    lg: 'gap-3 md:gap-4',
  },

  // Typography
  text: {
    xs: 'text-xs md:text-sm',
    sm: 'text-sm md:text-base',
    base: 'text-base md:text-lg',
    lg: 'text-lg md:text-xl',
    xl: 'text-xl md:text-2xl',
    '2xl': 'text-2xl md:text-3xl',
    '3xl': 'text-3xl md:text-4xl',
  },

  // Sizes
  size: {
    xs: 'w-3 h-3 md:w-4 md:h-4',
    sm: 'w-4 h-4 md:w-5 md:h-5',
    md: 'w-5 h-5 md:w-6 md:h-6',
    lg: 'w-6 h-6 md:w-8 md:h-8',
    xl: 'w-8 h-8 md:w-10 md:h-10',
  },

  // Button sizes
  button: {
    sm: 'h-7 px-2 md:h-8 md:px-3 text-xs md:text-sm',
    md: 'h-8 px-3 md:h-9 md:px-4 text-sm md:text-base',
    lg: 'h-9 px-4 md:h-10 md:px-6 text-sm md:text-base',
  },

  // Grid layouts
  grid: {
    responsive: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    cards: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    stats: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  },

  // Flex layouts
  flex: {
    responsive: 'flex-col md:flex-row',
    center: 'flex items-center justify-center',
    between: 'flex items-center justify-between',
    stack: 'flex flex-col space-y-2 md:space-y-3',
  },
};

// Responsive component wrapper interface
export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

// Responsive container class generator
export const getResponsiveContainerClasses = (size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'lg', className = '') => {
  const containerClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full',
  };

  return `container mx-auto px-3 md:px-6 ${containerClasses[size]} ${className}`;
};

// Responsive text truncation
export const getResponsiveText = (text: string, mobileLength: number = 20, desktopLength: number = 50) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.md;
  const maxLength = isMobile ? mobileLength : desktopLength;
  
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Responsive placeholder text
export const getResponsivePlaceholder = (mobile: string, desktop: string) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.md;
  return isMobile ? mobile : desktop;
};

// Common responsive patterns
export const patterns = {
  // Chat interface
  chatContainer: 'h-screen flex flex-col md:flex-row',
  chatSidebar: 'h-1/2 md:h-full md:w-96 border-t md:border-t-0 md:border-l',
  chatMain: 'flex-1 relative',
  
  // Dashboard
  dashboardGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6',
  dashboardHeader: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4',
  
  // Cards
  card: 'p-3 md:p-4 lg:p-6 rounded-lg border bg-card',
  cardHeader: 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3',
  
  // Forms
  formContainer: 'space-y-3 md:space-y-4',
  formGrid: 'grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4',
  
  // Navigation
  nav: 'flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4',
  navItem: 'text-sm md:text-base px-2 md:px-3 py-1 md:py-2',
};

export default {
  useScreenSize,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  responsiveClasses,
  getResponsiveContainerClasses,
  getResponsiveText,
  getResponsivePlaceholder,
  patterns,
  BREAKPOINTS,
};
