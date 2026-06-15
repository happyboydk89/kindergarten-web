'use client';

/**
 * =====================================================================================
 * TRANG TỔNG QUAN — /dashboard
 * =====================================================================================
 *
 * Trang mặc định sau khi đăng nhập. Cung cấp cái nhìn tổng quan về cơ sở đang chọn:
 *   - 4 Stats Cards (Tổng HS, Tổng lớp, Tổng GV, Doanh thu học phí ước tính)
 *   - Danh sách shortcut nhanh tới các module con (Lớp học, Học sinh, ...)
 *
 * BỘ QUẢN LÝ BỐI CẢNH CƠ SỞ (Campus Context Manager):
 *   - `selectedCampusId` được quản lý bởi `useSelectedCampus()` (xem
 *     src/components/shared/dashboard-header.tsx) — đã persist vào localStorage
 *     và share cho toàn bộ dashboard.
 *   - Logic fetch stats tách riêng vào `useDashboardStats` (xem
 *     src/hooks/use-dashboard-stats.ts) — auto re-fetch khi campusId đổi, dùng
 *     Promise.allSettled để chịu lỗi từng phần.
 *   - 2 chỉ số (Giáo viên theo campus, Doanh thu) hiện Backend chưa có endpoint;
 *     StatsCard sẽ render "—" mờ + Tooltip giải thích.
 *   - Khi campuses.length === 0 (user mới tạo tài khoản PRINCIPAL), page sẽ tự
 *     mount 1 instance CreateCampusDialog kèm CTA "Tạo cơ sở đầu tiên" trong hero.
 *
 * Mọi logic chi tiết của từng phân hệ đã được tách sang các route riêng:
 *   /dashboard/classes    — Lớp học
 *   /dashboard/students   — Học sinh
 *   /dashboard/teachers   — Giáo viên
 *   /dashboard/attendance — Điểm danh
 *   /dashboard/menu       — Thực đơn
 *   /dashboard/meal-fees  — Tiền ăn
 *   /dashboard/invoices   — Hóa đơn
 *   /dashboard/expenses   — Nhật ký chi tiêu
 *
 * User điều hướng qua Sidebar bên trái. Header (chứa Campus Switcher) được render
 * chung bởi (dashboard)/layout.tsx.
 * =====================================================================================
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  ClipboardCheck,
  GraduationCap,
  Info,
  Plus,
  Receipt,
  School,
  UserCog,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { CreateCampusDialog } from '@/components/shared/create-campus-dialog';
import { cn, formatVND } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useSelectedCampus } from '@/components/shared/dashboard-header';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import type { Campus } from '@/services/campus.service';

// =====================================================================================
// TYPES
// =====================================================================================

// ---------- Kiểu dữ liệu Stats Card ----------
type StatsCardTone = 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose';

interface StatsCardData {
  id: 'students' | 'classes' | 'teachers' | 'revenue';
  label: string;
  value: number | null;
  icon: React.ReactNode;
  tone: StatsCardTone;
  isCurrency?: boolean;
  /**
   * Khi có → StatsCard sẽ render "—" mờ kèm Tooltip giải thích lý do Backend
   * chưa hỗ trợ chỉ số này. Không cần truyền `value` thật.
   */
  disabledReason?: string;
}

// ---------- Shortcut items (link sang các route con) ----------
interface ShortcutItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  tone: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';
}

// =====================================================================================
// CONSTANTS
// =====================================================================================

const SHORTCUTS: ShortcutItem[] = [
  {
    title: 'Lớp học',
    description: 'Quản lý lớp + bảng học phí theo khối',
    href: '/dashboard/classes',
    icon: <School className="h-5 w-5" />,
    tone: 'emerald',
  },
  {
    title: 'Học sinh',
    description: 'Danh sách + tiếp nhận học sinh mới',
    href: '/dashboard/students',
    icon: <GraduationCap className="h-5 w-5" />,
    tone: 'indigo',
  },
  {
    title: 'Giáo viên',
    description: 'Danh sách + phân công đứng lớp',
    href: '/dashboard/teachers',
    icon: <UserCog className="h-5 w-5" />,
    tone: 'amber',
  },
  {
    title: 'Điểm danh',
    description: 'Theo dõi chuyên cần hằng ngày',
    href: '/dashboard/attendance',
    icon: <ClipboardCheck className="h-5 w-5" />,
    tone: 'sky',
  },
  {
    title: 'Thực đơn',
    description: 'Danh mục món + lịch tuần',
    href: '/dashboard/menu',
    icon: <UtensilsCrossed className="h-5 w-5" />,
    tone: 'violet',
  },
  {
    title: 'Tiền ăn',
    description: 'Cấu hình + đối lưu theo tháng',
    href: '/dashboard/meal-fees',
    icon: <Wallet className="h-5 w-5" />,
    tone: 'rose',
  },
  {
    title: 'Hóa đơn',
    description: 'Sinh hóa đơn + theo dõi thanh toán',
    href: '/dashboard/invoices',
    icon: <Receipt className="h-5 w-5" />,
    tone: 'indigo',
  },
  {
    title: 'Nhật ký chi tiêu',
    description: 'Sổ chi nội bộ + danh sách đen học phí',
    href: '/dashboard/expenses',
    icon: <Banknote className="h-5 w-5" />,
    tone: 'amber',
  },
];

// =====================================================================================
// MAIN COMPONENT
// =====================================================================================

export default function OverviewPage() {
  const { user, role } = useAuth();
  const {
    selectedCampusId,
    campuses,
    isLoading: isLoadingCampuses,
    setSelectedCampusId,
    refreshCampuses,
  } = useSelectedCampus();

  // Hook fetch stats tự động re-fetch khi `selectedCampusId` đổi
  const { stats, isLoading: isLoadingStats } = useDashboardStats(selectedCampusId, role);

  // State riêng cho Dialog "Tạo cơ sở đầu tiên" trong empty state
  // (Header vẫn có nút riêng cho case có campus)
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCampusCreated = useCallback(
    (c: Campus) => {
      setSelectedCampusId(c.id);
      void refreshCampuses();
      setIsCreateOpen(false);
    },
    [setSelectedCampusId, refreshCampuses],
  );

  // ============== 4 Stats Cards ==============
  const statsCards: StatsCardData[] = [
    {
      id: 'students',
      label: 'Tổng học sinh',
      value: stats.studentCount,
      icon: <GraduationCap className="h-5 w-5" />,
      tone: 'indigo',
    },
    {
      id: 'classes',
      label: 'Tổng lớp học',
      value: stats.classCount,
      icon: <School className="h-5 w-5" />,
      tone: 'emerald',
    },
    {
      id: 'teachers',
      label: 'Tổng giáo viên',
      value: stats.teacherCount,
      icon: <UserCog className="h-5 w-5" />,
      tone: 'amber',
      disabledReason: 'Đang chờ Backend bổ sung endpoint GET /campuses/:campusId/teachers',
    },
    {
      id: 'revenue',
      label: 'Doanh thu học phí ước tính',
      value: stats.revenue,
      icon: <Wallet className="h-5 w-5" />,
      tone: 'sky',
      isCurrency: true,
      disabledReason: 'Đang chờ Backend bổ sung endpoint GET /campuses/:campusId/stats',
    },
  ];

  const currentCampus = campuses.find((c) => c.id === selectedCampusId);
  const showEmptyState = !isLoadingCampuses && campuses.length === 0 && role === 'PRINCIPAL';

  return (
    <div className="space-y-6">
      {/* ================== HERO: CHÀO + GỢI Ý + CTA EMPTY STATE ================== */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Xin chào {user?.fullName ?? 'bạn'} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {currentCampus ? (
                <>
                  Đang theo dõi vận hành tại cơ sở <strong>{currentCampus.name}</strong>. Bấm vào
                  các shortcut bên dưới hoặc dùng menu bên trái để chuyển phân hệ.
                </>
              ) : showEmptyState ? (
                <>
                  Bạn chưa có cơ sở nào. Bấm nút <strong>Tạo cơ sở đầu tiên</strong> bên cạnh để
                  bắt đầu quản lý học sinh, lớp học và giáo viên.
                </>
              ) : (
                <>Đang tải danh sách cơ sở...</>
              )}
            </p>
          </div>
          {showEmptyState && (
            <Button onClick={() => setIsCreateOpen(true)} className="shrink-0">
              <Plus className="h-4 w-4" />
              Tạo cơ sở đầu tiên
            </Button>
          )}
        </div>
      </div>

      {/* ================== 4 STATS CARDS ================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <StatsCard
            key={card.id}
            data={card}
            loading={isLoadingStats && card.value === null && !card.disabledReason}
          />
        ))}
      </div>

      {/* ================== SHORTCUTS TỚI CÁC PHÂN HỆ ================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-800">Truy cập nhanh</CardTitle>
          <CardDescription>
            Bấm vào từng thẻ để mở phân hệ tương ứng (sidebar cũng có thể dùng).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUTS.map((s) => (
              <ShortcutCard key={s.href} item={s} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ================== DIALOG TẠO CƠ SỞ (cho empty state) ================== */}
      <CreateCampusDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleCampusCreated}
      />
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: StatsCard
// =====================================================================================
function StatsCard({ data, loading }: { data: StatsCardData; loading?: boolean }) {
  const toneStyles: Record<StatsCardTone, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  const displayValue =
    data.value === null
      ? '—'
      : data.isCurrency
        ? formatVND(data.value)
        : data.value.toLocaleString('vi-VN');

  const isDisabled = !!data.disabledReason;

  const cardBody = (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">{data.label}</p>
              {isDisabled && (
                <Info
                  className="h-3.5 w-3.5 shrink-0 text-amber-500"
                  aria-label={data.disabledReason}
                />
              )}
            </div>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  isDisabled ? 'text-slate-400' : 'text-slate-900',
                )}
              >
                {displayValue}
              </p>
            )}
          </div>
          <div
            className={cn(
              'rounded-lg p-2.5',
              toneStyles[data.tone],
              isDisabled && 'opacity-60',
            )}
          >
            {data.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{cardBody}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{data.disabledReason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return cardBody;
}

// =====================================================================================
// SUB-COMPONENT: ShortcutCard
// =====================================================================================
function ShortcutCard({ item }: { item: ShortcutItem }) {
  const toneStyles: Record<ShortcutItem['tone'], { bg: string; text: string; ring: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'hover:ring-indigo-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'hover:ring-emerald-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'hover:ring-amber-200' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'hover:ring-sky-200' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'hover:ring-rose-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'hover:ring-violet-200' },
  };
  const tone = toneStyles[item.tone];

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:shadow-md hover:ring-2',
        tone.ring,
      )}
    >
      <div className={cn('rounded-lg p-2', tone.bg, tone.text)}>{item.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 self-center text-slate-300 transition-colors group-hover:text-slate-500" />
    </Link>
  );
}
