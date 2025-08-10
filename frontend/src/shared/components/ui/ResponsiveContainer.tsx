import React from 'react';
import { getResponsiveContainerClasses } from '../../utils/responsive';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ 
  children, 
  className = '', 
  size = 'lg' 
}) => {
  return (
    <div className={getResponsiveContainerClasses(size, className)}>
      {children}
    </div>
  );
};

export default ResponsiveContainer;
