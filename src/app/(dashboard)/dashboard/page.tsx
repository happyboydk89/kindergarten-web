'use client';

/**
 * =====================================================================================
 * DASHBOARD CHÍNH — TRANG TỔNG QUAN DÀNH CHO HIỆU TRƯỞNG (PRINCIPAL)
 * =====================================================================================
 *
 * Kiến trúc dữ liệu & luồng hoạt động:
 *
 *   1. HEADER + CAMPUS SWITCHER
 *      - Khi mount: gọi `campusService.list()` (GET /api/v1/campuses) để lấy danh sách
 *        toàn bộ cơ sở. Mặc định chọn campus đầu tiên trong mảng (lưu vào state
 *        `selectedCampusId`).
 *      - Nếu mảng rỗng → hiển thị Empty State kèm CTA mở Dialog "Thêm cơ sở mới".
 *      - Khi user chọn campus khác trong Select, các Stats Cards và Tabs sẽ tự
 *        động cập nhật theo `campusId` (hiện tại Stats là mock — sẽ nối API thật
 *        ở bước sau).
 *
 *   2. DIALOG "THÊM CƠ SỞ MỚI"
 *      - Mở bằng nút "Thêm cơ sở" ở góc trên bên phải Header.
 *      - Form gồm 2 trường: Tên cơ sở, Địa chỉ (validate với Zod).
 *      - Submit gọi `campusService.create({ name, address })` → POST /api/v1/campuses.
 *      - Thành công: append campus mới vào `campuses[]` + auto-select campus vừa tạo.
 *      - Nút Submit có `disabled={isSubmitting}` ngay khi click để chống double-click.
 *
 *   3. STATS CARDS (4 thẻ)
 *      - Tổng học sinh, Tổng lớp học, Tổng giáo viên, Doanh thu học phí ước tính.
 *      - Tiền tệ format bằng `formatVND()` (locale vi-VN).
 *
 *   4. TABS ĐIỀU HƯỚNG CHỨC NĂNG (6 phân hệ)
 *      - Tổng quan, Học sinh, Điểm danh, Thực đơn, Học phí, Báo cáo.
 *      - Mỗi Tab hiện tại là layout trống (placeholder) kèm tiêu đề + nút bấm
 *        chức năng tương ứng — sẽ được fill logic ở các commit sau.
 *
 * Quy tắc cứng (đã tuân thủ):
 *   - Mọi request dùng `apiClient` (đã cấu hình `withCredentials: true` + baseURL
 *     tương đối `/api/v1` qua Next.js rewrite proxy).
 *   - Luôn check `response.data?.success` trước khi dùng `data`.
 *   - Nút Submit có loading + `disabled` ngay khi click.
 * =====================================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2,
  GraduationCap,
  Loader2,
  Plus,
  Wallet,
  LayoutDashboard,
  UserCog,
  ClipboardCheck,
  UtensilsCrossed,
  FileBarChart,
  School,
  BookOpen,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAuth } from '@/hooks/use-auth';
import { campusService, type Campus, type CreateCampusPayload } from '@/services/campus.service';
import { cn, formatVND } from '@/lib/utils';
import { ClassesTab } from './_components/classes-tab';
import { StudentsTab } from './_components/students-tab';
import { TeachersTab } from './_components/teachers-tab';
import { MenuTab } from './_components/menu-tab';
import { MealFeeTab } from './_components/meal-fee-tab';

// ---------- Schema validate Dialog "Thêm cơ sở mới" ----------
const createCampusSchema = z.object({
  name: z.string().min(2, 'Tên cơ sở phải có ít nhất 2 ký tự').max(100, 'Tên cơ sở quá dài'),
  address: z.string().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').max(200, 'Địa chỉ quá dài'),
});
type CreateCampusFormValues = z.infer<typeof createCampusSchema>;

// ---------- Kiểu dữ liệu hiển thị của Stats Card ----------
interface StatsCardData {
  label: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string; // ví dụ "₫"
  tone: 'indigo' | 'emerald' | 'amber' | 'sky';
}

// ---------- Cấu hình các Tab còn lại (chỉ còn 3 tab placeholder) ----------
interface FunctionalTab {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  primaryAction: { label: string; icon: React.ReactNode };
}

/**
 * Danh sách placeholder cho 3 Tab chưa làm: Tổng quan, Điểm danh, Báo cáo.
 * Các tab Lớp học / Học sinh / Giáo viên / Thực đơn / Học phí (tiền ăn)
 * đã có component riêng trong `_components/`, sẽ được render thẳng vào
 * <TabsContent> tương ứng trong DashboardPage.
 */
const PLACEHOLDER_TABS: FunctionalTab[] = [
  {
    value: 'overview',
    label: 'Tổng quan',
    icon: <LayoutDashboard className="h-4 w-4" />,
    description:
      'Bảng điều khiển tổng hợp số liệu vận hành của cơ sở đang chọn: học sinh, lớp, giáo viên, doanh thu học phí và các chỉ số nhanh khác.',
    primaryAction: { label: 'Xem chi tiết', icon: <LayoutDashboard className="h-4 w-4" /> },
  },
  {
    value: 'attendance',
    label: 'Điểm danh',
    icon: <ClipboardCheck className="h-4 w-4" />,
    description:
      'Theo dõi điểm danh hằng ngày của từng lớp, hỗ trợ đánh dấu nghỉ có phép / không phép và ghi chú của giáo viên.',
    primaryAction: { label: 'Mở bảng điểm danh', icon: <ClipboardCheck className="h-4 w-4" /> },
  },
  {
    value: 'reports',
    label: 'Báo cáo',
    icon: <FileBarChart className="h-4 w-4" />,
    description:
      'Xuất báo cáo tổng hợp: tỉ lệ chuyên cần, doanh thu theo tháng, tình hình sức khỏe và các chỉ số vận hành khác.',
    primaryAction: { label: 'Xem báo cáo', icon: <FileBarChart className="h-4 w-4" /> },
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  // ============== STATE: danh sách campus & campus đang chọn ==============
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [isLoadingCampuses, setIsLoadingCampuses] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ============== EFFECT: fetch danh sách campus lúc mount ==============
  useEffect(() => {
    let cancelled = false;

    async function fetchCampuses() {
      setIsLoadingCampuses(true);
      try {
        const res = await campusService.list();
        // Luôn check response.data?.success trước khi dùng data
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          const list = res.data;
          setCampuses(list);
          // Mặc định chọn campus đầu tiên nếu chưa chọn
          if (list.length > 0) {
            setSelectedCampusId((prev) => prev || list[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Không thể tải danh sách cơ sở';
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCampuses(false);
        }
      }
    }

    fetchCampuses();
    return () => {
      cancelled = true;
    };
  }, []);

  // ============== CALLBACK: khi tạo campus mới thành công ==============
  const handleCampusCreated = useCallback((newCampus: Campus) => {
    setCampuses((prev) => [...prev, newCampus]);
    setSelectedCampusId(newCampus.id);
  }, []);

  // ============== COMPUTED: campus hiện tại (để hiển thị tên ở tiêu đề) ==============
  const currentCampus = campuses.find((c) => c.id === selectedCampusId);

  // ============== COMPUTED: stats cards (mock — sẽ nối API thật ở bước sau) ==============
  // Lưu ý: hiện tại chưa gọi API thống kê theo campus. Khi có endpoint thật, các giá trị
  // này sẽ được thay bằng dữ liệu từ `useEffect` phụ thuộc `selectedCampusId`.
  const statsCards: StatsCardData[] = [
    {
      label: 'Tổng học sinh',
      value: 0,
      icon: <GraduationCap className="h-5 w-5" />,
      tone: 'indigo',
    },
    {
      label: 'Tổng lớp học',
      value: 0,
      icon: <School className="h-5 w-5" />,
      tone: 'emerald',
    },
    {
      label: 'Tổng giáo viên',
      value: 0,
      icon: <UserCog className="h-5 w-5" />,
      tone: 'amber',
    },
    {
      label: 'Doanh thu học phí ước tính',
      value: 0,
      icon: <Wallet className="h-5 w-5" />,
      tone: 'sky',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ================== HEADER + CAMPUS SWITCHER ================== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Tổng quan
            </h1>
            {currentCampus && (
              <Badge variant="secondary" className="font-normal">
                <Building2 className="mr-1 h-3 w-3" />
                {currentCampus.name}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Xin chào {user?.fullName ?? 'bạn'} — theo dõi tình hình vận hành các cơ sở
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Switcher cơ sở */}
          <div className="w-full sm:w-72">
            {isLoadingCampuses ? (
              <Skeleton className="h-9 w-full" />
            ) : campuses.length > 0 ? (
              <Select
                value={selectedCampusId}
                onValueChange={setSelectedCampusId}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                    <SelectValue placeholder="Chọn cơ sở" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <EmptyCampusState onAddClick={() => setCreateDialogOpen(true)} />
            )}
          </div>

          {/* Nút mở Dialog thêm cơ sở */}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Thêm cơ sở
          </Button>
        </div>
      </div>

      {/* ================== STATS CARDS ================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <StatsCard key={card.label} data={card} />
        ))}
      </div>

      {/* ================== TABS ĐIỀU HƯỚNG CHỨC NĂNG ==================
          Thứ tự tab:
          1-3: Lớp học, Học sinh, Giáo viên (3 tab có logic chi tiết)
          4:   Thực đơn (danh mục món + lịch tuần)
          5:   Học phí & Tiền ăn (đối lưu điểm danh)
          Còn lại: Tổng quan, Điểm danh, Báo cáo (placeholder) */}
      <Tabs defaultValue="classes" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:flex-nowrap sm:overflow-x-auto">
          {/* Tab 1: Lớp học */}
          <TabsTrigger value="classes" className="flex-shrink-0">
            <School className="h-4 w-4" />
            <span className="hidden sm:inline">Lớp học</span>
          </TabsTrigger>
          {/* Tab 2: Học sinh */}
          <TabsTrigger value="students" className="flex-shrink-0">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Học sinh</span>
          </TabsTrigger>
          {/* Tab 3: Giáo viên */}
          <TabsTrigger value="teachers" className="flex-shrink-0">
            <UserCog className="h-4 w-4" />
            <span className="hidden sm:inline">Giáo viên</span>
          </TabsTrigger>
          {/* Tab 4: Thực đơn */}
          <TabsTrigger value="menu" className="flex-shrink-0">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="hidden sm:inline">Thực đơn</span>
          </TabsTrigger>
          {/* Tab 5: Học phí & Tiền ăn */}
          <TabsTrigger value="tuition" className="flex-shrink-0">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Tiền ăn</span>
          </TabsTrigger>
          {/* Các tab còn lại (placeholder) */}
          {PLACEHOLDER_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-shrink-0">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* === 5 Tab có logic chi tiết (gắn liền selectedCampusId) === */}
        <TabsContent value="classes">
          <ClassesTab campusId={selectedCampusId} />
        </TabsContent>
        <TabsContent value="students">
          <StudentsTab campusId={selectedCampusId} />
        </TabsContent>
        <TabsContent value="teachers">
          <TeachersTab campusId={selectedCampusId} />
        </TabsContent>
        <TabsContent value="menu">
          <MenuTab campusId={selectedCampusId} />
        </TabsContent>
        <TabsContent value="tuition">
          <MealFeeTab campusId={selectedCampusId} />
        </TabsContent>

        {/* === Các tab placeholder === */}
        {PLACEHOLDER_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <TabPlaceholder tab={tab} campusName={currentCampus?.name} />
          </TabsContent>
        ))}
      </Tabs>

      {/* ================== DIALOG THÊM CƠ SỞ MỚI ================== */}
      <CreateCampusDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleCampusCreated}
      />
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: StatsCard — 1 thẻ thống kê
// =====================================================================================
function StatsCard({ data }: { data: StatsCardData }) {
  // Bảng màu nền + chữ theo `tone` để đồng bộ với brand indigo của app
  const toneStyles: Record<StatsCardData['tone'], string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  // Nếu là thẻ tiền tệ → dùng formatVND; ngược lại format số thường
  const isCurrency = data.suffix === '₫' || data.label.toLowerCase().includes('doanh thu');
  const displayValue = isCurrency ? formatVND(data.value) : data.value.toLocaleString('vi-VN');

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{data.label}</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {displayValue}
            </p>
          </div>
          <div className={cn('rounded-lg p-2.5', toneStyles[data.tone])}>{data.icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================================
// SUB-COMPONENT: EmptyCampusState — Hiển thị khi campuses[] rỗng
// =====================================================================================
function EmptyCampusState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
      <Building2 className="h-4 w-4 shrink-0" />
      <span className="truncate">Chưa có cơ sở nào.</span>
      <button
        onClick={onAddClick}
        className="ml-auto text-xs font-medium text-indigo-600 hover:underline"
      >
        Tạo ngay
      </button>
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: TabPlaceholder — Layout trống cho mỗi Tab (sẽ fill sau)
// =====================================================================================
function TabPlaceholder({
  tab,
  campusName,
}: {
  tab: FunctionalTab;
  campusName?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              {tab.icon}
              {tab.label}
            </CardTitle>
            <CardDescription>{tab.description}</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled>
            {tab.primaryAction.icon}
            {tab.primaryAction.label}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            {tab.icon}
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Phân hệ đang được phát triển</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Logic chi tiết của phân hệ <strong>{tab.label}</strong>
            {campusName ? <> cho cơ sở <strong>{campusName}</strong></> : null} sẽ được bổ sung ở
            bước tiếp theo. Bấm nút bên trên để xem chức năng tương ứng.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================================
// SUB-COMPONENT: CreateCampusDialog — Form thêm cơ sở mới (Dialog)
// =====================================================================================
function CreateCampusDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campus: Campus) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateCampusFormValues>({
    resolver: zodResolver(createCampusSchema),
    defaultValues: { name: '', address: '' },
  });

  // Reset form mỗi khi đóng Dialog
  useEffect(() => {
    if (!open) {
      form.reset({ name: '', address: '' });
    }
  }, [open, form]);

  const onSubmit = async (values: CreateCampusFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await campusService.create({
        name: values.name.trim(),
        address: values.address.trim(),
      });
      // Luôn check response.data?.success trước khi dùng data
      if (res?.success && res.data) {
        toast.success(`Đã tạo cơ sở "${res.data.name}"`);
        onCreated(res.data);
        onOpenChange(false);
      } else {
        toast.error(res?.message ?? 'Tạo cơ sở thất bại');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Có lỗi xảy ra khi tạo cơ sở';
      toast.error(message);
    } finally {
      // Luôn release trạng thái loading dù thành công hay thất bại
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {/* Trigger ẩn — Dialog được mở qua state từ component cha */}
        <span className="hidden" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Thêm cơ sở mới
          </DialogTitle>
          <DialogDescription>
            Tạo một cơ sở mới để bắt đầu quản lý học sinh, lớp học và giáo viên tại đây.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên cơ sở</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: Cơ sở Quận 1"
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa chỉ</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: 12 Nguyễn Huệ, Quận 1, TP.HCM"
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              {/* Nút Submit có loading + disabled ngay khi click — chống double-click */}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tạo cơ sở
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
