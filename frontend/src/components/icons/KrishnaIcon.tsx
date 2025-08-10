import React from 'react';

interface KrishnaIconProps {
  size?: number;
  className?: string;
  variant?: 'flute' | 'peacock-feather' | 'lotus';
}

export const KrishnaIcon: React.FC<KrishnaIconProps> = ({ 
  size = 24, 
  className = '', 
  variant = 'flute' 
}) => {
  const baseClasses = `inline-block ${className}`;

  if (variant === 'flute') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={baseClasses}
      >
        {/* Krishna's Flute (Murali) */}
        <path d="M3 12c0-.5.5-1 1-1h16c.5 0 1 .5 1 1s-.5 1-1 1H4c-.5 0-1-.5-1-1z" />
        <circle cx="6" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="10" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="14" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="18" cy="12" r="1.5" fill="currentColor" opacity="0.7" />
        
        {/* Musical notes floating around */}
        <path d="M7 8c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z" opacity="0.5" />
        <path d="M15 8c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z" opacity="0.5" />
        <path d="M11 6c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z" opacity="0.3" />
        
        <path d="M7 16c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z" opacity="0.5" />
        <path d="M15 16c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z" opacity="0.5" />
        <path d="M11 18c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z" opacity="0.3" />
      </svg>
    );
  }

  if (variant === 'peacock-feather') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={baseClasses}
      >
        {/* Peacock Feather */}
        <path d="M12 2c-2 0-4 2-4 4 0 1 .5 2 1 2.5L12 22l3-13.5c.5-.5 1-1.5 1-2.5 0-2-2-4-4-4z" />
        <ellipse cx="12" cy="6" rx="3" ry="2" fill="currentColor" opacity="0.7" />
        <ellipse cx="12" cy="6" rx="1.5" ry="1" fill="currentColor" opacity="0.9" />
        <circle cx="12" cy="6" r="0.5" fill="white" />
        
        {/* Feather details */}
        <path d="M10 8l-1 2M14 8l1 2M10 10l-1 2M14 10l1 2M10 12l-1 2M14 12l1 2" 
              stroke="currentColor" 
              strokeWidth="0.5" 
              opacity="0.6" 
              fill="none" />
      </svg>
    );
  }

  if (variant === 'lotus') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={baseClasses}
      >
        {/* Lotus Flower */}
        <path d="M12 4c-1 0-2 1-2 2v2c0 1 1 2 2 2s2-1 2-2V6c0-1-1-2-2-2z" />
        <path d="M8 8c-1-1-2-1-3 0s-1 2 0 3l2 2c1 1 2 1 3 0s1-2 0-3l-2-2z" />
        <path d="M16 8c1-1 2-1 3 0s1 2 0 3l-2 2c-1 1-2 1-3 0s-1-2 0-3l2-2z" />
        <path d="M6 12c0-1-1-2-2-2s-2 1-2 2 1 2 2 2h2c1 0 2-1 2-2z" />
        <path d="M18 12c0-1 1-2 2-2s2 1 2 2-1 2-2 2h-2c-1 0-2-1-2-2z" />
        <path d="M8 16c-1 1-2 1-3 0s-1-2 0-3l2-2c1-1 2-1 3 0s1 2 0 3l-2 2z" />
        <path d="M16 16c1 1 2 1 3 0s1-2 0-3l-2-2c-1-1-2-1-3 0s-1-2 0-3l2 2z" />
        <path d="M12 20c-1 0-2-1-2-2v-2c0-1 1-2 2-2s2 1 2 2v2c0 1-1 2-2 2z" />
        
        {/* Center */}
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.8" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }

  return null;
};

// Pre-configured variants for easy use
export const KrishnaFlute: React.FC<Omit<KrishnaIconProps, 'variant'>> = (props) => (
  <KrishnaIcon {...props} variant="flute" />
);

export const KrishnaPeacockFeather: React.FC<Omit<KrishnaIconProps, 'variant'>> = (props) => (
  <KrishnaIcon {...props} variant="peacock-feather" />
);

export const KrishnaLotus: React.FC<Omit<KrishnaIconProps, 'variant'>> = (props) => (
  <KrishnaIcon {...props} variant="lotus" />
);
