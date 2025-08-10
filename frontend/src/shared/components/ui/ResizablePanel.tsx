import React, { useState, useEffect } from 'react';
import { cn } from '../../utils';

interface ResponsivePanelProps {
  children: React.ReactNode;
  width?: number;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
}

export const ResizablePanel: React.FC<ResponsivePanelProps> = ({
  children,
  width = 384,
  className,
  minWidth = 320,
  maxWidth = 500,
}) => {
  const [panelWidth, setPanelWidth] = useState(width);

  useEffect(() => {
    const updateWidth = () => {
      const viewportWidth = window.innerWidth;

      // On mobile, use full width
      if (viewportWidth < 768) {
        setPanelWidth(viewportWidth);
        return;
      }

      // On desktop, use responsive width based on viewport
      const responsiveWidth = Math.min(
        maxWidth,
        Math.max(minWidth, Math.floor(viewportWidth * 0.35))
      );

      setPanelWidth(responsiveWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [minWidth, maxWidth]);

  return (
    <div
      className={cn('flex-shrink-0 transition-all duration-300', className)}
      style={{ width: panelWidth }}
    >
      {/* Panel Content */}
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
};
