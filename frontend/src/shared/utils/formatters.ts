import { format, formatDistanceToNow } from 'date-fns';

export const formatDate = (date: Date | string) => {
  if (!date) return 'Unknown date';
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'Invalid date';
  return format(parsedDate, 'MMM dd, yyyy');
};

export const formatDateTime = (date: Date | string) => {
  if (!date) return 'Unknown date';
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'Invalid date';
  return format(parsedDate, 'MMM dd, yyyy HH:mm');
};

export const formatRelativeTime = (date: Date | string) => {
  if (!date) return 'Unknown time';
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'Invalid time';
  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};
