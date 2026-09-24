import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function safeDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && num > 1000000000) return new Date(num);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  if (val && typeof val === 'object') {
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    if (typeof val.toDate === 'function') return val.toDate();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatDate(timestamp: any) {
  try {
    return format(safeDate(timestamp), 'dd/MM/yyyy');
  } catch {
    return '-';
  }
}

export function calculateDueDays(billDate: any, fullyPaidDate: any) {
  try {
    const end = fullyPaidDate ? safeDate(fullyPaidDate) : new Date();
    const start = safeDate(billDate);
    const diff = differenceInDays(end, start);
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}
