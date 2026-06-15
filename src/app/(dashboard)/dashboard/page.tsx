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
import { useEffect, useState } from 'react';
import {
  Building2,
  GraduationCap,
  School,
  UserCog,
  UtensilsCrossed,
  Wallet,
  ClipboardCheck,
  Receipt,
  Banknote,
  ArrowRight,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatVND } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useSelectedCampus } from '@/components/shared/dashboard-header';
import { studentService } from '@/services/student.service';
import { classService } from '@/services/class.service';
import { teacherService } from '@/services/teacher.service';

// ---------- Kiểu dữ liệu Stats Card ----------
interface StatsCardData {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  tone: 'indigo' | 'emerald' | 'amber' | 'sky';
  isCurrency?: boolean;
}

// ---------- Shortcut items (link sang các route con) ----------
interface ShortcutItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  tone: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';
}

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

export default function OverviewPage() {
  const { user } = useAuth();
  const { selectedCampusId, campuses, isLoading: isLoadingCampuses } = useSelectedCampus();

  // ============== STATE: 4 stats ==============
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // ============== EFFECT: load stats theo campus ==============
  useEffect(() => {
    if (!selectedCampusId) {
      setStudentCount(null);
      setClassCount(null);
      setTeacherCount(null);
      return;
    }
    let cancelled = false;
    async function loadStats() {
      setIsLoadingStats(true);
      try {
        const [studentsRes, classesRes, teachersRes] = await Promise.all([
          studentService.list({ campusId: selectedCampusId, limit: 1 }),
          classService.list({ campusId: selectedCampusId, limit: 100 }),
          teacherService.list({ campusId: selectedCampusId, limit: 1 }),
        ]);
        if (cancelled) return;

        // Students: đọc total từ meta (nếu BE trả paginated) hoặc array length
        if (studentsRes?.success && studentsRes.data) {
          const p = studentsRes.data as unknown;
          if (Array.isArray(p)) {
            setStudentCount(p.length);
          } else {
            const meta = (p as { meta?: { total?: number } }).meta;
            setStudentCount(meta?.total ?? 0);
          }
        }

        // Classes: thường là array
        if (classesRes?.success && Array.isArray(classesRes.data)) {
          setClassCount(classesRes.data.length);
        }

        // Teachers: tương tự students
        if (teachersRes?.success && teachersRes.data) {
          const p = teachersRes.data as unknown;
          if (Array.isArray(p)) {
            setTeacherCount(p.length);
          } else {
            const meta = (p as { meta?: { total?: number } }).meta;
            setTeacherCount(meta?.total ?? 0);
          }
        }
      } catch {
        /* silent — stats chỉ là tổng quan */
      } finally {
        if (!cancelled) setIsLoadingStats(false);
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [selectedCampusId]);

  // ============== 4 Stats Cards ==============
  const statsCards: StatsCardData[] = [
    { label: 'Tổng học sinh', value: studentCount, icon: <GraduationCap className="h-5 w-5" />, tone: 'indigo' },
    { label: 'Tổng lớp học', value: classCount, icon: <School className="h-5 w-5" />, tone: 'emerald' },
    { label: 'Tổng giáo viên', value: teacherCount, icon: <UserCog className="h-5 w-5" />, tone: 'amber' },
    {
      label: 'Doanh thu học phí ước tính',
      value: 0,
      icon: <Wallet className="h-5 w-5" />,
      tone: 'sky',
      isCurrency: true,
    },
  ];

  const currentCampus = campuses.find((c) => c.id === selectedCampusId);

  return (
    <div className="space-y-6">
      {/* ================== HERO: CHÀO + GỢI Ý ================== */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Xin chào {user?.fullName ?? 'bạn'} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {currentCampus ? (
            <>
              Đang theo dõi vận hành tại cơ sở <strong>{currentCampus.name}</strong>. Bấm vào
              các shortcut bên dưới hoặc dùng menu bên trái để chuyển phân hệ.
            </>
          ) : campuses.length === 0 && !isLoadingCampuses ? (
            <>
              Bạn chưa có cơ sở nào. Bấm nút <strong>Thêm cơ sở</strong> ở Header trên để bắt đầu
              quản lý.
            </>
          ) : (
            <>Đang tải danh sách cơ sở...</>
          )}
        </p>
      </div>

      {/* ================== 4 STATS CARDS ================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <StatsCard key={card.label} data={card} loading={isLoadingStats && card.value === null} />
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
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: StatsCard
// =====================================================================================
function StatsCard({
  data,
  loading,
}: {
  data: StatsCardData;
  loading?: boolean;
}) {
  const toneStyles: Record<StatsCardData['tone'], string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  const displayValue =
    data.value === null
      ? '—'
      : data.isCurrency
        ? formatVND(data.value)
        : data.value.toLocaleString('vi-VN');

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{data.label}</p>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-2xl font-bold tracking-tight text-slate-900">{displayValue}</p>
            )}
          </div>
          <div className={cn('rounded-lg p-2.5', toneStyles[data.tone])}>{data.icon}</div>
        </div>
      </CardContent>
    </Card>
  );
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
