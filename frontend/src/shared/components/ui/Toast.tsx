import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

export const toast = {
  success: ({ title, description, duration = 4000 }: ToastOptions) => {
    const Icon = icons.success;
    sonnerToast.success(title, {
      description,
      duration,
      icon: <Icon className="h-4 w-4" />,
    });
  },

  error: ({ title, description, duration = 5000 }: ToastOptions) => {
    const Icon = icons.error;
    sonnerToast.error(title, {
      description,
      duration,
      icon: <Icon className="h-4 w-4" />,
    });
  },

  warning: ({ title, description, duration = 4000 }: ToastOptions) => {
    const Icon = icons.warning;
    sonnerToast.warning(title, {
      description,
      duration,
      icon: <Icon className="h-4 w-4" />,
    });
  },

  info: ({ title, description, duration = 4000 }: ToastOptions) => {
    const Icon = icons.info;
    sonnerToast.info(title, {
      description,
      duration,
      icon: <Icon className="h-4 w-4" />,
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
    });
  },
};

export const Toast = toast;
