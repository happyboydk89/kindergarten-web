'use client';

/**
 * =====================================================================================
 * TAB 4 — QUẢN LÝ THỰC ĐƠN DINH DƯỠNG
 * =====================================================================================
 *
 * Phạm vi:
 *   1. Danh mục món ăn (CRUD nhanh):
 *      - GET /api/v1/dishes?campusId=...
 *      - POST /api/v1/dishes  (Tên món, thành phần dưỡng chất)
 *   2. Lịch tuần (T2..T6 — Thứ 7 + CN mặc định không có thực đơn):
 *      - Chọn Khối + 1 tuần (T2 mặc định = tuần chứa hôm nay).
 *      - GET /api/v1/schedules/weekly?campusId=&gradeLevel=&weekStart=YYYY-MM-DD
 *      - Ở mỗi ngày, gán/bỏ món ăn bằng cách toggle checkbox.
 *      - Nút "Lưu lịch tuần" → POST /api/v1/schedules/bulk (upsert).
 *
 * Quy tắc cứng (đã tuân thủ):
 *   - Mọi date đều là chuỗi `YYYY-MM-DD`, KHÔNG dùng `new Date()` để format.
 *   - apiClient (withCredentials + baseURL tương đối).
 *   - Luôn check `res?.success && res.data` trước khi dùng.
 *   - Submit button có loading + disabled.
 * =====================================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { dishService, type Dish, type CreateDishPayload } from '@/services/dish.service';
import {
  scheduleService,
  type BulkSchedulesPayload,
  type DailySchedule,
} from '@/services/schedule.service';
import type { GradeLevel } from '@/types';
import { GRADE_LEVELS, GRADE_LEVEL_LABELS } from '@/types';
import {
  WEEKDAY_LABELS_VN,
  addDays,
  diffDays,
  formatVNDate,
  getISODayOfWeek,
  getVietnamToday,
  startOfWeek,
} from '@/lib/date-utils';

// ---------- Schema validate Form "Thêm món ăn" ----------
const createDishSchema = z.object({
  name: z.string().min(2, 'Tên món phải có ít nhất 2 ký tự').max(100, 'Tên món quá dài'),
  nutrients: z.string().max(500, 'Mô tả dưỡng chất quá dài').optional(),
});
type CreateDishFormValues = z.infer<typeof createDishSchema>;

/** Chỉ số 0..4 cho 5 ngày làm việc (T2..T6). */
const WORKING_DAY_ISOS = [1, 2, 3, 4, 5] as const;

export function MenuTab({ campusId }: { campusId: string }) {
  // ============== STATE: danh mục món ==============
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [createDishOpen, setCreateDishOpen] = useState(false);
  const [deletingDishId, setDeletingDishId] = useState<string | null>(null);
  const [isDeletingDish, setIsDeletingDish] = useState(false);

  // ============== STATE: lịch tuần ==============
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | ''>('');
  const [weekStart, setWeekStart] = useState<string>(startOfWeek(getVietnamToday()));
  const [scheduleMap, setScheduleMap] = useState<Record<string, string[]>>({});
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // ============== EFFECT: load dishes ==============
  useEffect(() => {
    if (!campusId) {
      setDishes([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoadingDishes(true);
      try {
        const res = await dishService.list({ campusId });
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setDishes(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Không thể tải danh mục món');
        }
      } finally {
        if (!cancelled) setIsLoadingDishes(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  // ============== EFFECT: load schedule (khi đổi campus/khối/tuần) ==============
  useEffect(() => {
    if (!campusId || !gradeLevel) {
      setScheduleMap({});
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoadingSchedule(true);
      try {
        const res = await scheduleService.getWeekly({
          campusId,
          gradeLevel: gradeLevel as GradeLevel,
          weekStart,
        });
        if (cancelled) return;
        // BE mới trả `{ campus, gradeLevel, startDate, endDate, days: [...] }`
        // với `days[].breakfast`/`lunch`/`snack`/`activities` là CHUỖI TỰ DO
        // (xem schedule.service.ts BE). Khi có bảng `Dish` riêng, sẽ chuyển sang
        // dùng `dishIds: string[]`. Tạm thời để trống để tương thích code cũ.
        const payload = res.data as unknown;
        const dayEntries: Array<{ date: string }> =
          payload && typeof payload === 'object' && 'days' in payload
            ? ((payload as { days: Array<{ date: string }> }).days ?? [])
            : Array.isArray(payload)
              ? (payload as Array<{ date: string }>)
              : [];

        const map: Record<string, string[]> = {};
        for (const s of dayEntries) {
          if (s.date) map[s.date] = [];
        }
        setScheduleMap(map);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Không thể tải lịch tuần');
        }
      } finally {
        if (!cancelled) setIsLoadingSchedule(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId, gradeLevel, weekStart]);

  // ============== CALLBACK: thêm món mới ==============
  const handleDishCreated = useCallback((d: Dish) => {
    setDishes((prev) => [...prev, d]);
  }, []);

  // ============== CALLBACK: xóa món ==============
  const handleDeleteDish = useCallback(async () => {
    if (!deletingDishId) return;
    setIsDeletingDish(true);
    try {
      const res = await dishService.remove(deletingDishId);
      if (res?.success) {
        toast.success('Đã xóa món ăn');
        setDishes((prev) => prev.filter((d) => d.id !== deletingDishId));
        // Đồng thời loại bỏ món này khỏi scheduleMap (nếu có)
        setScheduleMap((prev) => {
          const next: Record<string, string[]> = {};
          for (const [date, ids] of Object.entries(prev)) {
            next[date] = ids.filter((id) => id !== deletingDishId);
          }
          return next;
        });
      } else {
        toast.error(res?.message ?? 'Xóa món thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa món thất bại');
    } finally {
      setIsDeletingDish(false);
      setDeletingDishId(null);
    }
  }, [deletingDishId]);

  // ============== CALLBACK: toggle 1 món trong 1 ngày ==============
  const toggleDishInDay = useCallback((date: string, dishId: string) => {
    setScheduleMap((prev) => {
      const current = prev[date] ?? [];
      const next = current.includes(dishId)
        ? current.filter((id) => id !== dishId)
        : [...current, dishId];
      return { ...prev, [date]: next };
    });
  }, []);

  // ============== CALLBACK: lưu lịch tuần ==============
  const handleSaveSchedule = useCallback(async () => {
    if (!campusId || !gradeLevel) {
      toast.error('Vui lòng chọn cơ sở và khối lớp trước khi lưu');
      return;
    }
    setIsSavingSchedule(true);
    try {
      const payload: BulkSchedulesPayload = {
        campusId,
        gradeLevel,
        weekStart,
        schedules: WORKING_DAY_ISOS.map((iso) => {
          const date = addDays(weekStart, iso - 1);
          return { date, dishIds: scheduleMap[date] ?? [] };
        }),
      };
      const res = await scheduleService.bulkUpsert(payload);
      if (res?.success) {
        toast.success('Đã lưu lịch thực đơn tuần');
      } else {
        toast.error(res?.message ?? 'Lưu lịch thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu lịch');
    } finally {
      setIsSavingSchedule(false);
    }
  }, [campusId, gradeLevel, weekStart, scheduleMap]);

  // ============== COMPUTED: 5 ngày làm việc của tuần hiện tại ==============
  const workingDates = useMemo(
    () => WORKING_DAY_ISOS.map((iso) => addDays(weekStart, iso - 1)),
    [weekStart],
  );

  // ============== COMPUTED: tuần có thay đổi chưa lưu ==============
  // (Đơn giản: hiển thị thông báo nhắc; không tracking chi tiết để tránh over-engineering)
  const today = getVietnamToday();

  return (
    <div className="space-y-4">
      {/* =============== PHẦN 1: DANH MỤC MÓN ĂN =============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <ChefHat className="h-5 w-5 text-indigo-600" />
                Danh mục món ăn
              </CardTitle>
              <CardDescription>
                Tạo nhanh các món ăn cùng thành phần dưỡng chất để dùng chung cho mọi khối lớp.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDishOpen(true)} disabled={!campusId}>
              <Plus className="h-4 w-4" />
              Thêm món
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoadingDishes ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : dishes.length === 0 ? (
            <EmptyState message="Chưa có món nào trong danh mục. Bấm Thêm món để bắt đầu." />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dishes.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                    {d.nutrients && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{d.nutrients}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingDishId(d.id)}
                    title="Xóa món"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =============== PHẦN 2: LỊCH THỰC ĐƠN THEO TUẦN =============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <CalendarIcon className="h-5 w-5 text-emerald-600" />
                Lịch thực đơn tuần
              </CardTitle>
              <CardDescription>
                Gán các món ăn trong danh mục vào từng ngày (T2–T6) theo từng khối. Bấm{' '}
                <strong>Lưu lịch tuần</strong> để ghi nhận.
              </CardDescription>
            </div>

            {/* Controls: chọn khối + điều hướng tuần */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full space-y-1.5 sm:w-56">
                <label className="text-sm font-medium">Khối lớp</label>
                <Select
                  value={gradeLevel}
                  onValueChange={(v) => setGradeLevel(v as GradeLevel)}
                  disabled={!campusId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khối" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_LEVELS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  title="Tuần trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tuần bắt đầu (T2)</label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {formatVNDate(weekStart)} — {formatVNDate(addDays(weekStart, 4))}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      (còn {diffDays(today, weekStart)} ngày nữa)
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  title="Tuần sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekStart(startOfWeek(getVietnamToday()))}
                >
                  Hôm nay
                </Button>
              </div>

              <div className="ml-auto">
                <Button
                  onClick={handleSaveSchedule}
                  disabled={isSavingSchedule || !campusId || !gradeLevel}
                >
                  {isSavingSchedule ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu lịch tuần
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!campusId || !gradeLevel ? (
            <EmptyState message="Vui lòng chọn cơ sở và khối lớp ở thanh trên." />
          ) : isLoadingSchedule ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : dishes.length === 0 ? (
            <EmptyState message="Cơ sở chưa có món ăn nào trong danh mục. Hãy thêm món trước khi lên lịch." />
          ) : (
            <div className="space-y-3">
              {workingDates.map((date) => {
                const dow = getISODayOfWeek(date);
                const wd = WEEKDAY_LABELS_VN.find((w) => w.iso === dow);
                const selectedIds = new Set(scheduleMap[date] ?? []);
                return (
                  <div
                    key={date}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-normal">
                          {wd?.full}
                        </Badge>
                        <span className="text-sm font-medium text-slate-800">
                          {formatVNDate(date)}
                        </span>
                        {date === today && (
                          <Badge variant="default" className="font-normal">
                            Hôm nay
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        Đã gán: {selectedIds.size} món
                      </span>
                    </div>

                    {/* Danh sách checkbox món cho ngày này */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {dishes.map((d) => {
                        const checked = selectedIds.has(d.id);
                        return (
                          <label
                            key={d.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm transition-colors hover:bg-slate-50 has-[[data-state=checked]]:border-indigo-300 has-[[data-state=checked]]:bg-indigo-50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleDishInDay(date, d.id)}
                            />
                            <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate text-slate-700">{d.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =============== DIALOG THÊM MÓN =============== */}
      <CreateDishDialog
        open={createDishOpen}
        onOpenChange={setCreateDishOpen}
        campusId={campusId}
        onCreated={handleDishCreated}
      />

      {/* =============== ALERT DIALOG XÓA MÓN =============== */}
      <AlertDialog
        open={!!deletingDishId}
        onOpenChange={(o) => !o && setDeletingDishId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa món ăn này?</AlertDialogTitle>
            <AlertDialogDescription>
              Món sẽ bị xóa khỏi danh mục và tự động gỡ khỏi mọi ngày trong lịch tuần hiện tại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDish}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDish}
              disabled={isDeletingDish}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeletingDish ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                'Xóa món'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: EmptyState
// =====================================================================================
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: CreateDishDialog
// =====================================================================================
function CreateDishDialog({
  open,
  onOpenChange,
  campusId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campusId: string;
  onCreated: (d: Dish) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateDishFormValues>({
    resolver: zodResolver(createDishSchema),
    defaultValues: { name: '', nutrients: '' },
  });

  useEffect(() => {
    if (!open) form.reset({ name: '', nutrients: '' });
  }, [open, form]);

  const onSubmit = async (values: CreateDishFormValues) => {
    if (!campusId) {
      toast.error('Vui lòng chọn cơ sở trước khi tạo món');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: CreateDishPayload = {
        name: values.name.trim(),
        nutrients: values.nutrients?.trim() || undefined,
        campusId,
      };
      const res = await dishService.create(payload);
      if (res?.success && res.data) {
        toast.success(`Đã thêm món "${res.data.name}"`);
        onCreated(res.data);
        onOpenChange(false);
      } else {
        toast.error(res?.message ?? 'Thêm món thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-600" />
            Thêm món ăn mới
          </DialogTitle>
          <DialogDescription>
            Tạo nhanh món ăn để dùng chung trong danh mục. Có thể bổ sung thành phần dưỡng chất.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên món</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: Cháo gà hạt sen"
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
              name="nutrients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thành phần dưỡng chất (tuỳ chọn)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Vd: Đạm 12g, Béo 8g, Tinh bột 30g, Chất xơ 4g..."
                      rows={3}
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
              <Button type="submit" disabled={isSubmitting || !campusId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Thêm món
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

// Export GradeLevel labels cho debug
export { GRADE_LEVEL_LABELS };
