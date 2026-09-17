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

export function formatDate(timestamp: number) {
  return format(new Date(timestamp), 'dd/MM/yyyy');
}

export function calculateDueDays(billDate: number, fullyPaidDate: number | null | undefined) {
  const end = fullyPaidDate ? new Date(fullyPaidDate) : new Date();
  const start = new Date(billDate);
  const diff = differenceInDays(end, start);
  return Math.max(0, diff); // Never negative
}
