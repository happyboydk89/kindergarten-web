import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  UtensilsCrossed,
  CookingPot,
  Settings,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';

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
    title: 'Quản lý Học sinh',
    href: '/dashboard/students',
    icon: Users,
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
    title: 'Nhật ký bếp',
    href: '/dashboard/kitchen',
    icon: CookingPot,
    roles: ['PRINCIPAL', 'STAFF'],
  },
  {
    title: 'Cấu hình học phí',
    href: '/dashboard/fee-configs',
    icon: Settings,
    roles: ['PRINCIPAL'],
  },
  {
    title: 'Hóa đơn',
    href: '/dashboard/invoices',
    icon: Receipt,
    roles: ['PRINCIPAL', 'STAFF'],
  },
];

export function filterMenuByRole(role: UserRole | null): SidebarItem[] {
  if (!role) return [];
  return sidebarItems.filter((item) => item.roles.includes(role));
}
