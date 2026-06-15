import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format một số nguyên (VND) thành chuỗi hiển thị tiền tệ Việt Nam.
 * - 1500000 -> "1.500.000 ₫"
 * - 0 -> "0 ₫"
 * - undefined/null/NaN -> "—"
 */
export function formatVND(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}
