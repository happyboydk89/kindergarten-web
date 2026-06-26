'use client';

/**
 * =====================================================================================
 * TAB 4 — QUẢN LÝ THỰC ĐƠN DINH DƯỠNG
 * =====================================================================================
 *
 * Layout 2 sub-tab (Tabs từ shadcn):
 *
 * 1) THỰC ĐƠN TUẦN (mặc định):
 *    - Bảng calendar table 7 cột (T2..CN) × 3 hàng (Sáng / Trưa / Xế).
 *    - Mỗi ô = dropdown chọn món (filter theo `mealType`).
 *    - Chọn cả tuần rồi bấm "Lưu thực đơn tuần" — giống sổ menu.
 *
 * 2) DANH SÁCH MÓN ĂN:
 *    - CRUD nhanh món ăn (tên + mealType + ingredients + 4 ô dinh dưỡng optional).
 *    - Click từng dòng để sửa, có nút xoá.
 *
 * Quy tắc cứng:
 *   - Tất cả field dinh dưỡng (calories/protein/carbs/fat) + ingredients đều OPTIONAL.
 *   - Mọi date là chuỗi `YYYY-MM-DD`, không qua Date().
 *   - apiClient (withCredentials + baseURL relative).
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
  Pencil,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  dishService,
  type Dish,
  type DishMealType,
  type CreateDishPayload,
  type UpdateDishPayload,
  DISH_MEAL_TYPE_LABELS,
  DISH_MEAL_TYPE_ORDER,
} from '@/services/dish.service';
import { scheduleService } from '@/services/schedule.service';
import {
  WEEKDAY_LABELS_VN,
  addDays,
  formatVNDate,
  getISODayOfWeek,
  getVietnamToday,
  startOfWeek,
} from '@/lib/date-utils';
import { extractApiError } from '@/lib/api-helpers';

// =====================================================================================
// SUB-TAB 1: Thực đơn tuần
// =====================================================================================

const WEEK_DAY_ISOS = [1, 2, 3, 4, 5, 6, 7] as const; // T2..CN

/**
 * Map YYYY-MM-DD → { breakfastDishId, lunchDishId, snackDishId }.
 * Tất cả các field đều optional (null = không gán món).
 */
type MenuDraft = Record<
  string,
  {
    breakfastDishId: number | null;
    /** Tên món sáng (lưu kèm từ BE response để hiển thị ngay cả khi `dishes` array chưa load xong). */
    breakfastDishName: string | null;
    lunchDishId: number | null;
    lunchDishName: string | null;
    snackDishId: number | null;
    snackDishName: string | null;
  }
>;

/**
 * Key lưu `weekStart` vào localStorage để giữ qua F5 / navigate.
 * Khi user chọn "Tuần trước" rồi save menu ở tuần đó, refresh sẽ KHÔNG bị reset
 * về tuần hiện tại (giúp không "mất" menu đã lưu).
 */
const MENU_WEEK_START_STORAGE_KEY = 'kindergarten.menuWeekStart';

function loadStoredWeekStart(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(MENU_WEEK_START_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveWeekStart(weekStart: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MENU_WEEK_START_STORAGE_KEY, weekStart);
  } catch {
    /* silent */
  }
}

function WeekMenuEditor({ campusId }: { campusId: string }) {
  // ============== STATE ==============
  // Menu thống nhất theo campus — không còn chọn khối (gradeLevel).
  //
  // `weekStart` khởi tạo từ localStorage (nếu có) — giữ qua F5/navigate.
  // Fallback về tuần hiện tại nếu localStorage trống.
  const [weekStart, setWeekStartState] = useState<string>(
    () => loadStoredWeekStart() ?? startOfWeek(getVietnamToday()),
  );
  const setWeekStart = useCallback((iso: string) => {
    setWeekStartState(iso);
    saveWeekStart(iso);
  }, []);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [menu, setMenu] = useState<MenuDraft>({});
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ============== EFFECT: load dishes theo campus ==============
  // Chạy ngay khi campusId có (kể cả sau khi component remount) — đảm bảo
  // khi user navigate sang tab khác rồi quay lại, danh sách món vẫn tự động load.
  useEffect(() => {
    if (!campusId) {
      setDishes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingDishes(true);
      try {
        const res = await dishService.list({ campusId, limit: 500 });
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setDishes(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(extractApiError(err, 'Không thể tải danh sách món'));
        }
      } finally {
        if (!cancelled) setIsLoadingDishes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  // ============== EFFECT: load schedule tuần (theo campus) ==============
  // Trigger khi [campusId, weekStart] đổi. Re-fetch ngay khi mount (initial state của
  // weekStart đã là tuần hiện tại, nên component remount sẽ tự re-fetch đúng tuần cũ).
  useEffect(() => {
    if (!campusId) {
      setMenu({});
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingSchedule(true);
      try {
        const res = await scheduleService.getWeeklyByCampus({
          campusId,
          weekStart,
        });
        if (cancelled) return;
        const data = res.data;
        const next: MenuDraft = {};
        if (data && Array.isArray(data.days)) {
          for (const d of data.days) {
            if (!d.date) continue;
            next[d.date] = {
              breakfastDishId: d.breakfastDishId ?? null,
              // Lưu tên món ngay từ BE response (nested breakfastDish/lunchDish/snackDish)
              // → hiển thị được ngay cả khi `dishes` array (catalog) chưa load xong.
              breakfastDishName: d.breakfastDish?.name ?? null,
              lunchDishId: d.lunchDishId ?? null,
              lunchDishName: d.lunchDish?.name ?? null,
              snackDishId: d.snackDishId ?? null,
              snackDishName: d.snackDish?.name ?? null,
            };
          }
        }
        setMenu(next);
        setHasUnsavedChanges(false);
      } catch (err) {
        if (!cancelled) {
          toast.error(extractApiError(err, 'Không thể tải thực đơn tuần'));
        }
      } finally {
        if (!cancelled) setIsLoadingSchedule(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId, weekStart]);

  // ============== COMPUTED: 7 ngày trong tuần ==============
  const weekDays = useMemo(
    () => WEEK_DAY_ISOS.map((iso) => addDays(weekStart, iso - 1)),
    [weekStart],
  );

  // ============== COMPUTED: dishes theo mealType ==============
  const dishesByMealType = useMemo(() => {
    const map: Record<DishMealType, Dish[]> = {
      BREAKFAST: [],
      LUNCH: [],
      SNACK: [],
    };
    for (const d of dishes) {
      if (d.isActive !== false && map[d.mealType]) {
        map[d.mealType].push(d);
      }
    }
    return map;
  }, [dishes]);

  // ============== CALLBACK: set 1 món cho 1 ngày ==============
  const setMenuItem = useCallback(
    (date: string, mealType: DishMealType, dishId: number | null) => {
      setMenu((prev) => {
        const current = prev[date] ?? { breakfastDishId: null, lunchDishId: null, snackDishId: null };
        const key = `${mealType}DishId` as 'breakfastDishId' | 'lunchDishId' | 'snackDishId';
        return { ...prev, [date]: { ...current, [key]: dishId } };
      });
      setHasUnsavedChanges(true);
    },
    [],
  );

  // ============== CALLBACK: lưu thực đơn cả tuần ==============
  const handleSaveMenu = useCallback(async () => {
    if (!campusId) {
      toast.error('Vui lòng chọn cơ sở trước khi lưu');
      return;
    }
    setIsSaving(true);
    try {
      const daysPayload = weekDays
        .filter((d) => menu[d]) // chỉ gửi các ngày user đã thao tác
        .map((d) => ({
          date: d,
          breakfastDishId: menu[d]?.breakfastDishId ?? null,
          lunchDishId: menu[d]?.lunchDishId ?? null,
          snackDishId: menu[d]?.snackDishId ?? null,
        }));

      if (daysPayload.length === 0) {
        toast.info('Chưa có thay đổi nào để lưu');
        return;
      }

      const res = await scheduleService.setMenuForWeek({
        campusId: Number(campusId),
        days: daysPayload,
      });
      const savedDays = res?.data?.saved;
      if (res?.success && savedDays) {
        toast.success(`Đã lưu thực đơn cho ${savedDays.length} ngày.`);
        setHasUnsavedChanges(false);
        // Đồng bộ `menu` state với data BE vừa lưu — đảm bảo UI phản ánh đúng
        // (kể cả khi BE normalize data như set null, trim, v.v.). Tránh stale state.
        setMenu((prev) => {
          const next = { ...prev };
          for (const saved of savedDays) {
            // Đồng bộ cả id + name từ BE response để hiển thị tức thì, không phụ thuộc
            // vào `dishes` catalog (load song song có thể chậm hơn).
            next[saved.date] = {
              breakfastDishId: saved.breakfastDishId,
              breakfastDishName: saved.breakfastDish?.name ?? null,
              lunchDishId: saved.lunchDishId,
              lunchDishName: saved.lunchDish?.name ?? null,
              snackDishId: saved.snackDishId,
              snackDishName: saved.snackDish?.name ?? null,
            };
          }
          return next;
        });
      } else {
        toast.error(res?.message ?? 'Lưu thực đơn thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Có lỗi xảy ra khi lưu thực đơn'));
    } finally {
      setIsSaving(false);
    }
  }, [campusId, weekDays, menu]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <CalendarIcon className="h-5 w-5 text-emerald-600" />
                Sổ thực đơn tuần
              </CardTitle>
              <CardDescription>
                Calendar table 7 ngày (T2–CN) × 3 bữa (Sáng/Trưa/Xế). Mỗi ô là dropdown chọn món
                từ danh mục. Bấm <strong>Lưu thực đơn</strong> để ghi nhận cả tuần.
                Thực đơn <strong>thống nhất</strong> cho cả cơ sở (không phân biệt khối lớp).
              </CardDescription>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 items-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  title="Tuần trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tuần</label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {formatVNDate(weekStart)} → {formatVNDate(addDays(weekStart, 6))}
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

              <Button
                onClick={handleSaveMenu}
                disabled={isSaving || !campusId || isLoadingDishes}
                className="shrink-0"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Lưu thực đơn{hasUnsavedChanges ? ' *' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoadingSchedule || isLoadingDishes ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : dishes.length === 0 ? (
            <EmptyState message="Cơ sở chưa có món ăn nào. Bấm tab Danh sách món ăn để thêm món trước khi lên lịch." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32 bg-slate-50">Bữa</TableHead>
                    {weekDays.map((date) => {
                      const dow = getISODayOfWeek(date);
                      const wd = WEEKDAY_LABELS_VN.find((w) => w.iso === dow);
                      const isToday = date === getVietnamToday();
                      return (
                        <TableHead
                          key={date}
                          className={`min-w-[180px] text-center ${isToday ? 'bg-amber-50' : 'bg-slate-50'}`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-medium text-slate-500">{wd?.short}</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {formatVNDate(date)}
                            </span>
                            {isToday && (
                              <Badge variant="default" className="h-4 px-1 text-[10px]">
                                Hôm nay
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DISH_MEAL_TYPE_ORDER.map((mealType) => (
                    <TableRow key={mealType}>
                      <TableCell className="bg-slate-50/50 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <UtensilsCrossed className="h-3.5 w-3.5 text-slate-400" />
                          {DISH_MEAL_TYPE_LABELS[mealType]}
                        </div>
                      </TableCell>
                      {weekDays.map((date) => {
                        const entry = menu[date];
                        const current = entry?.[`${mealType}DishId` as 'breakfastDishId' | 'lunchDishId' | 'snackDishId'] ?? null;
                        const name =
                          entry?.[`${mealType}DishName` as 'breakfastDishName' | 'lunchDishName' | 'snackDishName'] ?? null;
                        // Tên hiển thị: ưu tiên tên lưu trong state (set ngay khi load schedule
                        // từ BE response), fallback tên từ `dishes` catalog.
                        const displayName =
                          name ??
                          (current != null
                            ? dishes.find((d) => d.id === current)?.name ?? null
                            : null);
                        const options = dishesByMealType[mealType];
                        return (
                          <TableCell key={`${date}-${mealType}`} className="p-2 align-top">
                            <DishPicker
                              value={current}
                              options={options}
                              currentName={displayName}
                              onChange={(id) => setMenuItem(date, mealType, id)}
                              disabled={isSaving}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Dropdown chọn 1 món cho 1 ô của calendar table. Khi user chọn "(trống)" → id = null.
 */
function DishPicker({
  value,
  options,
  currentName,
  onChange,
  disabled,
}: {
  value: number | null;
  options: Dish[];
  /**
   * Tên món đang chọn — lấy từ `menu[date].breakfastDishName` (state, set ngay khi
   * load schedule từ BE). Dùng để hiển thị ngay cả khi `dishes` array (catalog)
   * chưa load xong — khắc phục race condition giữa 2 useEffect load song song.
   */
  currentName: string | null;
  onChange: (id: number | null) => void;
  disabled: boolean;
}) {
  // Khi `value` được set nhưng `dishes` chưa load xong (race condition giữa 2 useEffect
  // load schedule + load dishes song song), `options` rỗng → shadcn Select không tìm
  // thấy option tương ứng với `value` → hiển thị `(trống)`. Fix bằng cách thêm 1
  // "option ảo" với tên từ `currentName` (state) để Select luôn render đúng tên.
  const selectedFromOptions = options.find((d) => d.id === value);
  const showGhostOption = value !== null && !selectedFromOptions;

  return (
    <Select
      value={value === null ? '__none__' : String(value)}
      onValueChange={(v) => onChange(v === '__none__' ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className="h-9 w-full text-xs">
        <SelectValue placeholder="(trống)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-slate-400 italic">
          — (trống) —
        </SelectItem>
        {showGhostOption && (
          <SelectItem key={`ghost-${value}`} value={String(value)}>
            {currentName ?? `Món #${value}`}
          </SelectItem>
        )}
        {options.map((d) => (
          <SelectItem key={d.id} value={String(d.id)}>
            {d.name}
            {d.calories != null && (
              <span className="ml-1 text-[10px] text-slate-400">· {Math.round(d.calories)} kcal</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// =====================================================================================
// SUB-TAB 2: Danh sách món ăn
// =====================================================================================

/**
 * Schema form — tất cả trường là string ở tầng form (để dễ bind với `<Input>`),
 * convert sang number | null khi submit. Validate ngay tại schema (không qua transform
 * để tránh phải khai báo lại type cho defaultValues).
 */
const nutrientString = z
  .string()
  .refine(
    (v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    { message: 'Phải là số ≥ 0 hoặc để trống' },
  );

const editDishSchema = z.object({
  name: z.string().trim().min(1, 'Tên món là bắt buộc').max(100),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'SNACK']),
  ingredients: z.string().max(2000).optional().or(z.literal('')),
  calories: nutrientString,
  protein: nutrientString,
  carbs: nutrientString,
  fat: nutrientString,
});
type EditDishFormValues = z.infer<typeof editDishSchema>;

/** Convert string form value → number | null cho payload. */
const toNutrient = (v: string | undefined): number | null => {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function DishesAdmin({ campusId }: { campusId: string }) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDishes = useCallback(async () => {
    if (!campusId) {
      setDishes([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await dishService.list({ campusId, limit: 500 });
      if (res?.success && Array.isArray(res.data)) {
        setDishes(res.data);
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Không thể tải danh sách món'));
    } finally {
      setIsLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    void fetchDishes();
  }, [fetchDishes]);

  // Mở dialog tạo mới khi campus đổi (clear editing)
  useEffect(() => {
    setEditing(null);
  }, [campusId]);

  const handleDelete = useCallback(async () => {
    if (deletingId === null) return;
    setIsDeleting(true);
    try {
      const res = await dishService.remove(deletingId);
      if (res?.success) {
        toast.success('Đã xoá món ăn (archived)');
        setDishes((prev) => prev.filter((d) => d.id !== deletingId));
      } else {
        toast.error(res?.message ?? 'Xoá thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Xoá thất bại'));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  }, [deletingId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <ChefHat className="h-5 w-5 text-indigo-600" />
                Danh sách món ăn
              </CardTitle>
              <CardDescription>
                Tạo món ăn cùng thành phần dưỡng chất (tất cả trường dinh dưỡng đều tuỳ chọn).
                Dùng chung cho mọi khối lớp trong cơ sở.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)} disabled={!campusId}>
              <Plus className="h-4 w-4" />
              Thêm món
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : dishes.length === 0 ? (
            <EmptyState message="Chưa có món nào. Bấm Thêm món để bắt đầu." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Tên món</TableHead>
                    <TableHead className="w-32">Bữa</TableHead>
                    <TableHead className="w-24 text-right">kcal</TableHead>
                    <TableHead className="w-20 text-right">Đạm (g)</TableHead>
                    <TableHead className="w-20 text-right">Bột (g)</TableHead>
                    <TableHead className="w-20 text-right">Béo (g)</TableHead>
                    <TableHead className="w-24 text-center">Trạng thái</TableHead>
                    <TableHead className="w-24 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dishes.map((d, idx) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                        {d.ingredients && (
                          <p className="line-clamp-1 text-xs text-slate-500">
                            {d.ingredients}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            d.mealType === 'BREAKFAST'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : d.mealType === 'LUNCH'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-violet-300 bg-violet-50 text-violet-700'
                          }
                        >
                          {DISH_MEAL_TYPE_LABELS[d.mealType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {d.calories != null ? Math.round(d.calories) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {d.protein != null ? d.protein : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {d.carbs != null ? d.carbs : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {d.fat != null ? d.fat : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {d.isActive ? (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                            Hoạt động
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Đã ẩn</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(d)}
                            title="Sửa món"
                          >
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(d.id)}
                            title="Xoá món"
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog tạo mới */}
      <DishFormDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        campusId={campusId}
        dish={null}
        onSaved={(d) => {
          setDishes((prev) => [...prev, d]);
          setIsCreating(false);
        }}
      />

      {/* Dialog sửa */}
      {editing && (
        <DishFormDialog
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          campusId={campusId}
          dish={editing}
          onSaved={(d) => {
            setDishes((prev) => prev.map((x) => (x.id === d.id ? d : x)));
            setEditing(null);
          }}
        />
      )}

      {/* Alert xoá */}
      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá món ăn này?</AlertDialogTitle>
            <AlertDialogDescription>
              Món sẽ bị ẩn khỏi danh mục và tự động gỡ khỏi mọi ngày trong thực đơn tuần (SetNull FK).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xoá...
                </>
              ) : (
                'Xoá món'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Dialog tạo mới / sửa món ăn. Tất cả field dinh dưỡng + ingredients là OPTIONAL.
 */
function DishFormDialog({
  open,
  onOpenChange,
  campusId,
  dish,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campusId: string;
  dish: Dish | null;
  onSaved: (d: Dish) => void;
}) {
  const isEdit = !!dish;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditDishFormValues>({
    resolver: zodResolver(editDishSchema),
    defaultValues: {
      name: dish?.name ?? '',
      mealType: (dish?.mealType as DishMealType) ?? 'BREAKFAST',
      ingredients: dish?.ingredients ?? '',
      calories: dish?.calories != null ? String(dish.calories) : '',
      protein: dish?.protein != null ? String(dish.protein) : '',
      carbs: dish?.carbs != null ? String(dish.carbs) : '',
      fat: dish?.fat != null ? String(dish.fat) : '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: dish?.name ?? '',
        mealType: (dish?.mealType as DishMealType) ?? 'BREAKFAST',
        ingredients: dish?.ingredients ?? '',
        calories: dish?.calories != null ? String(dish.calories) : '',
        protein: dish?.protein != null ? String(dish.protein) : '',
        carbs: dish?.carbs != null ? String(dish.carbs) : '',
        fat: dish?.fat != null ? String(dish.fat) : '',
      });
    }
  }, [open, dish, form]);

  const onSubmit = async (values: EditDishFormValues) => {
    if (!campusId) {
      toast.error('Vui lòng chọn cơ sở trước');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && dish) {
        const payload: UpdateDishPayload = {
          name: values.name.trim(),
          mealType: values.mealType,
          ingredients: values.ingredients?.trim() ? values.ingredients.trim() : null,
          calories: toNutrient(values.calories),
          protein: toNutrient(values.protein),
          carbs: toNutrient(values.carbs),
          fat: toNutrient(values.fat),
        };
        const res = await dishService.update(dish.id, payload);
        if (res?.success && res.data) {
          toast.success('Đã cập nhật món');
          onSaved(res.data);
        } else {
          toast.error(res?.message ?? 'Cập nhật thất bại');
        }
      } else {
        const payload: CreateDishPayload = {
          campusId: Number(campusId),
          name: values.name.trim(),
          mealType: values.mealType,
          ingredients: values.ingredients?.trim() ? values.ingredients.trim() : null,
          calories: toNutrient(values.calories),
          protein: toNutrient(values.protein),
          carbs: toNutrient(values.carbs),
          fat: toNutrient(values.fat),
        };
        const res = await dishService.create(payload);
        if (res?.success && res.data) {
          toast.success(`Đã thêm món "${res.data.name}"`);
          onSaved(res.data);
        } else {
          toast.error(res?.message ?? 'Thêm món thất bại');
        }
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Có lỗi xảy ra'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>
                <Pencil className="h-5 w-5 text-indigo-600" />
                Sửa món ăn
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-indigo-600" />
                Thêm món ăn mới
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Tất cả trường dinh dưỡng và thành phần đều <strong>tuỳ chọn</strong>. Chỉ tên món + loại
            bữa là bắt buộc.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên món *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: Cháo thịt bằm cà rốt"
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
              name="mealType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại bữa *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DISH_MEAL_TYPE_ORDER.map((m) => (
                        <SelectItem key={m} value={m}>
                          {DISH_MEAL_TYPE_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ingredients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thành phần dưỡng chất (tuỳ chọn)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Vd: Gạo 30g, thịt heo xay 20g, cà rốt 15g, hành lá 5g..."
                      rows={3}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Có thể ghi nguyên liệu + thành phần dinh dưỡng định lượng.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="calories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calories</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="kcal"
                        min="0"
                        step="0.1"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="protein"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đạm (g)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        min="0"
                        step="0.1"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carbs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tinh bột (g)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        min="0"
                        step="0.1"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Béo (g)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        min="0"
                        step="0.1"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Huỷ
              </Button>
              <Button type="submit" disabled={isSubmitting || !campusId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : isEdit ? (
                  <>
                    <Save className="h-4 w-4" />
                    Lưu thay đổi
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

// =====================================================================================
// MAIN COMPONENT
// =====================================================================================

export function MenuTab({ campusId }: { campusId: string }) {
  const [activeTab, setActiveTab] = useState<'menu' | 'dishes'>('menu');

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'menu' | 'dishes')}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="menu" className="gap-1.5">
            <CalendarIcon className="h-4 w-4" />
            Thực đơn tuần
          </TabsTrigger>
          <TabsTrigger value="dishes" className="gap-1.5">
            <ChefHat className="h-4 w-4" />
            Danh sách món ăn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-4">
          <WeekMenuEditor campusId={campusId} />
        </TabsContent>
        <TabsContent value="dishes" className="mt-4">
          <DishesAdmin campusId={campusId} />
        </TabsContent>
      </Tabs>
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
