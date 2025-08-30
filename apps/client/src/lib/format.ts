import { format as dateFnsFormat, formatDistance, formatRelative } from 'date-fns';

export const formatDate = (date: Date | string, formatStr = 'PPP') => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(d, formatStr);
};

export const formatTimeAgo = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistance(d, new Date(), { addSuffix: true });
};

export const formatRelativeTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatRelative(d, new Date());
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
