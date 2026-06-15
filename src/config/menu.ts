import {
  LayoutDashboard,
  School,
  GraduationCap,
  UserCog,
  UtensilsCrossed,
  Wallet,
  Receipt,
  Banknote,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';

/**
 * Mỗi item trong Sidebar bên trái — tương ứng với 1 route (/dashboard/...).
 * Người dùng bấm vào đây sẽ điều hướng sang trang riêng (không phải Tab).
 */
export interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const sidebarItems: SidebarItem[] = [
  {
    title: 'Tổng quan',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['PRINCIPAL', 'TEACHER', 'STAFF'],
  },
  {
    title: 'Lớp học',
    href: '/dashboard/classes',
    icon: School,
    roles: ['PRINCIPAL', 'TEACHER', 'STAFF'],
  },
  {
    title: 'Học sinh',
    href: '/dashboard/students',
    icon: GraduationCap,
    roles: ['PRINCIPAL', 'TEACHER', 'STAFF'],
  },
  {
    title: 'Giáo viên',
    href: '/dashboard/teachers',
    icon: UserCog,
    roles: ['PRINCIPAL'],
  },
  {
    title: 'Điểm danh',
    href: '/dashboard/attendance',
    icon: ClipboardCheck,
    roles: ['PRINCIPAL', 'TEACHER'],
  },
  {
    title: 'Thực đơn',
    href: '/dashboard/menu',
    icon: UtensilsCrossed,
    roles: ['PRINCIPAL', 'STAFF'],
  },
  {
    title: 'Tiền ăn',
    href: '/dashboard/meal-fees',
    icon: Wallet,
    roles: ['PRINCIPAL', 'STAFF'],
  },
  {
    title: 'Hóa đơn',
    href: '/dashboard/invoices',
    icon: Receipt,
    roles: ['PRINCIPAL', 'STAFF'],
  },
  {
    title: 'Nhật ký chi tiêu',
    href: '/dashboard/expenses',
    icon: Banknote,
    roles: ['PRINCIPAL', 'STAFF'],
  },
];

export function filterMenuByRole(role: UserRole | null): SidebarItem[] {
  if (!role) return [];
  return sidebarItems.filter((item) => item.roles.includes(role));
}
