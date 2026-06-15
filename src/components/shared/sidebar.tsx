'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { filterMenuByRole } from '@/config/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarSkeleton() {
  return (
    <div className="space-y-2 px-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * 1 item trong Sidebar — dùng Next.js <Link> để:
 *  - Tự động prefetch khi vào viewport (UX nhanh hơn)
 *  - Hỗ trợ middle-click / cmd-click mở tab mới
 *  - Tốt cho SEO + accessibility
 */
function SidebarNavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  active,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  active: boolean;
  /** Callback khi user click — dùng để đóng mobile sheet. */
  onNavigate?: () => void;
}) {
  const linkContent = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-50 text-indigo-600'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-indigo-600' : 'text-slate-400')} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0} disableHoverableContent>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return linkContent;
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { role } = useAuth();
  const items = filterMenuByRole(role);

  return (
    <div className="flex flex-col gap-1 px-3">
      {items.map((item) => (
        <SidebarNavItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.title}
          collapsed={collapsed}
          // Active state: khớp chính xác, hoặc là trang con của href (vd /dashboard/classes/123 vẫn active cho /dashboard/classes)
          active={
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          }
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { isLoading } = useAuth();

  const brand = (
    <Link
      href="/dashboard"
      className={cn(
        'flex items-center gap-2 px-4 h-14 border-b border-slate-200',
        collapsed ? 'justify-center' : 'justify-between',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!collapsed && <span className="font-semibold text-slate-900">Kindergarten</span>}
      </div>
    </Link>
  );

  const menuContent = isLoading ? <SidebarSkeleton /> : <SidebarContent collapsed={collapsed} />;

  const collapseButton = (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors',
        collapsed ? 'justify-center' : '',
      )}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      {!collapsed && <span>Thu gọn</span>}
    </button>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white border-r border-slate-200 transition-all duration-300',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {brand}
        <nav className="flex-1 overflow-y-auto py-4">{menuContent}</nav>
        <div className="p-3 border-t border-slate-200">{collapseButton}</div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Điều hướng</SheetTitle>
          </SheetHeader>
          {brand}
          <Separator />
          <nav className="flex-1 overflow-y-auto py-4">
            {/* Bấm item → đóng sheet + navigate */}
            <SidebarContent collapsed={false} onNavigate={onMobileClose} />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
