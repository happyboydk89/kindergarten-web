'use client';

/**
 * =====================================================================================
 * TAB 5 — HỌC PHÍ & TIỀN ĂN (ĐỐI LƯU)
 * =====================================================================================
 *
 * Phạm vi:
 *   1. Ô cấu hình tiền ăn mặc định / ngày (VND):
 *      - GET /api/v1/campuses/:campusId/meal-fee  (lấy cấu hình hiện tại)
 *      - PUT /api/v1/campuses/:campusId/meal-fee  (cập nhật)
 *   2. Bảng đối lưu theo tháng (YYYY-MM):
 *      - User chọn 1 tháng → load điểm danh của tất cả học sinh của campus trong tháng đó.
 *      - Với mỗi học sinh:
 *          Tổng ngày đi học (PRESENT) → Tiền ăn thực tế = presentDays * feePerDay
 *          Số ngày nghỉ có phép (ABSENT_PLANNED) → Tiền dư = plannedDays * feePerDay
 *              (số tiền này sẽ được TRỪ vào hoá đơn tháng tiếp theo)
 *          Số ngày nghỉ không phép (ABSENT_UNPLANNED) → KHÔNG được dư
 *      - Cột "Tổng tiền ăn phải thu" = presentDays * feePerDay
 *
 * Quy tắc:
 *   - Tất cả date là chuỗi `YYYY-MM-DD`, KHÔNG `new Date()`.
 *   - Tính toán theo tháng (từ ngày 1 đến ngày cuối tháng).
 * =====================================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Wallet,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { mealFeeService } from '@/services/meal-fee.service';
import {
  studentService,
  type StudentBrief,
} from '@/services/student.service';
import {
  attendanceService,
  type ClassAttendanceDay,
  type StudentAttendanceRangeResponse,
} from '@/services/attendance.service';
import type { AttendanceStatus } from '@/types';
import { cn, formatVND } from '@/lib/utils';
import {
  MONTH_LABELS_VN,
  getDatesInMonth,
  getVietnamToday,
} from '@/lib/date-utils';

// ---------- Schema validate Form cấu hình tiền ăn ----------
const mealFeeSchema = z.object({
  defaultAmountPerDay: z
    .number({ invalid_type_error: 'Vui lòng nhập số' })
    .int('Phải là số nguyên')
    .min(0, 'Không được âm')
    .max(1_000_000, 'Giá trị quá lớn'),
});
type MealFeeFormValues = z.infer<typeof mealFeeSchema>;

/** Số liệu đối lưu ăn uống của 1 học sinh trong 1 tháng. */
interface StudentReconciliation {
  student: StudentBrief;
  presentDays: number;
  plannedDays: number;
  unplannedDays: number;
  /** Tiền ăn phải thu = presentDays * feePerDay */
  amountDue: number;
  /** Tiền dư do nghỉ có phép = plannedDays * feePerDay (sẽ trừ tháng sau) */
  creditAmount: number;
}

export function MealFeeTab({ campusId }: { campusId: string }) {
  // ============== STATE: cấu hình tiền ăn ==============
  const [feePerDay, setFeePerDay] = useState<number>(25000); // mặc định
  const [isLoadingFee, setIsLoadingFee] = useState(false);

  // ============== STATE: tháng đang xem ==============
  const [month, setMonth] = useState<string>(getVietnamToday().slice(0, 7)); // YYYY-MM

  // ============== STATE: đối lưu ==============
  const [rows, setRows] = useState<StudentReconciliation[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);

  // ============== EFFECT: load meal fee config ==============
  useEffect(() => {
    if (!campusId) return;
    let cancelled = false;
    async function load() {
      setIsLoadingFee(true);
      try {
        const res = await mealFeeService.get(campusId);
        if (!cancelled && res?.success && res.data) {
          setFeePerDay(res.data.defaultAmountPerDay);
        }
      } catch {
        // BE có thể chưa có cấu hình → giữ mặc định
        if (!cancelled) setFeePerDay(25000);
      } finally {
        if (!cancelled) setIsLoadingFee(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  // ============== EFFECT: load students + attendance theo tháng ==============
  useEffect(() => {
    if (!campusId) {
      setRows([]);
      return;
    }
    let cancelled = false;

    async function load() {
      setIsLoadingRows(true);
      try {
        // 1. Lấy tất cả học sinh của campus (chỉ lấy trang 1 với limit lớn — nên BE cần hỗ trợ)
        const listRes = await studentService.list({ campusId, page: 1, limit: 200 });
        if (cancelled) return;
        if (!listRes?.success || !listRes.data) {
          setRows([]);
          return;
        }
        // res.data là StudentBrief[] trực tiếp (axios interceptor đã strip wrapper).
        const students: StudentBrief[] = Array.isArray(listRes.data) ? listRes.data : [];

        // 2. Lấy tất cả ngày trong tháng
        const dates = getDatesInMonth(month);
        if (dates.length === 0) {
          setRows([]);
          return;
        }
        const fromDate = dates[0];
        const toDate = dates[dates.length - 1];

        // 3. Với từng học sinh, gọi API lấy điểm danh theo khoảng ngày
        //    (Có thể tối ưu bằng BE aggregate, hiện tại loop từng HS)
        const results: StudentReconciliation[] = [];
        for (const s of students) {
          if (cancelled) return;
          const attRes = await attendanceService.getStudentAttendance(String(s.id), {
            fromDate,
            toDate,
            limit: 31, // 1 tháng tối đa 31 ngày
          });
          if (!attRes?.success || !attRes.data) {
            results.push(makeEmptyRow(s));
            continue;
          }
          // res.data có thể là StudentAttendanceRangeResponse (bọc) hoặc mảng Day[]
          const attPayload = attRes.data as unknown;
          let days: ClassAttendanceDay[] = [];
          if (Array.isArray(attPayload)) {
            days = attPayload as ClassAttendanceDay[];
          } else {
            const p = attPayload as StudentAttendanceRangeResponse;
            days = p.data ?? [];
          }
          results.push(computeReconciliation(s, days, feePerDay));
        }

        if (!cancelled) {
          setRows(results);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Không thể tải dữ liệu đối lưu');
        }
      } finally {
        if (!cancelled) setIsLoadingRows(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [campusId, month, feePerDay]);

  // ============== COMPUTED: tổng hợp cuối bảng ==============
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.present += r.presentDays;
        acc.planned += r.plannedDays;
        acc.unplanned += r.unplannedDays;
        acc.amountDue += r.amountDue;
        acc.credit += r.creditAmount;
        return acc;
      },
      { present: 0, planned: 0, unplanned: 0, amountDue: 0, credit: 0 },
    );
  }, [rows]);

  // ============== CALLBACK: tăng/giảm tháng ==============
  const shiftMonth = useCallback((delta: number) => {
    setMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* =============== PHẦN 1: CẤU HÌNH TIỀN ĂN =============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Wallet className="h-5 w-5 text-indigo-600" />
            Cấu hình tiền ăn
          </CardTitle>
          <CardDescription>
            Đặt số tiền ăn mặc định / ngày cho cơ sở. Áp dụng cho tất cả học sinh đang học tại cơ
            sở này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoadingFee ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <MealFeeConfigForm
              campusId={campusId}
              initialAmount={feePerDay}
              onSaved={(amount) => {
                setFeePerDay(amount);
                // Re-run đối lưu với fee mới
                setRows([]);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* =============== PHẦN 2: BẢNG ĐỐI LƯU ĂN UỐNG THEO THÁNG =============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-slate-800">Bảng đối lưu tiền ăn theo tháng</CardTitle>
              <CardDescription>
                Tổng hợp số ngày đi học / nghỉ của từng học sinh, từ đó tính số tiền phải thu và
                số tiền dư (do nghỉ có phép) — số dư sẽ được trừ vào hoá đơn tháng sau.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => shiftMonth(-1)}
                title="Tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const y = Number(month.split('-')[0]);
                    return (
                      <SelectItem
                        key={`${y}-${String(i + 1).padStart(2, '0')}`}
                        value={`${y}-${String(i + 1).padStart(2, '0')}`}
                      >
                        {MONTH_LABELS_VN[i]} {y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => shiftMonth(1)}
                title="Tháng sau"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoadingRows ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState message="Tháng này cơ sở chưa có học sinh nào hoặc chưa có dữ liệu điểm danh." />
          ) : (
            <>
              {/* Bảng thông tin tham khảo */}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <InfoChip label="Đơn giá / ngày" value={formatVND(feePerDay)} tone="indigo" />
                <InfoChip label="Tổng ngày đi học" value={totals.present} tone="emerald" />
                <InfoChip label="Nghỉ có phép" value={totals.planned} tone="amber" />
                <InfoChip label="Nghỉ không phép" value={totals.unplanned} tone="rose" />
                <InfoChip
                  label="Tổng tiền ăn phải thu"
                  value={formatVND(totals.amountDue)}
                  tone="sky"
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã HS</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead className="text-center">Đi học</TableHead>
                      <TableHead className="text-center">Nghỉ phép</TableHead>
                      <TableHead className="text-center">Nghỉ KP</TableHead>
                      <TableHead className="text-right">Phải thu</TableHead>
                      <TableHead className="text-right">Dư (trừ T+1)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.student.id}>
                        <TableCell className="font-mono text-xs text-slate-500">#{r.student.id}</TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {r.student.fullName}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="success" className="font-mono">
                            {r.presentDays}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="warning" className="font-mono">
                            {r.plannedDays}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="font-mono">
                            {r.unplannedDays}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-indigo-600">
                          {formatVND(r.amountDue)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {r.creditAmount > 0 ? `−${formatVND(r.creditAmount)}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                * Số dư <strong>(Nghỉ có phép × Đơn giá)</strong> sẽ được trừ vào hoá đơn tháng
                kế tiếp (T+1). Nghỉ không phép không được tính dư.
              </p>
            </>
          )}
        </CardContent>
      </Card>
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
// SUB-COMPONENT: InfoChip — thẻ thông tin tóm tắt
// =====================================================================================
function InfoChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const toneStyles: Record<typeof tone, string> = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return (
    <div className={cn('rounded-md border px-3 py-2', toneStyles[tone])}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: MealFeeConfigForm — Form cấu hình tiền ăn
// =====================================================================================
function MealFeeConfigForm({
  campusId,
  initialAmount,
  onSaved,
}: {
  campusId: string;
  initialAmount: number;
  onSaved: (amount: number) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MealFeeFormValues>({
    resolver: zodResolver(mealFeeSchema),
    defaultValues: { defaultAmountPerDay: initialAmount },
  });

  // Khi `initialAmount` thay đổi (từ API load về), reset form
  useEffect(() => {
    form.reset({ defaultAmountPerDay: initialAmount });
  }, [initialAmount, form]);

  const onSubmit = async (values: MealFeeFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await mealFeeService.update(campusId, {
        defaultAmountPerDay: values.defaultAmountPerDay,
      });
      if (res?.success) {
        toast.success('Đã lưu cấu hình tiền ăn');
        onSaved(values.defaultAmountPerDay);
      } else {
        toast.error(res?.message ?? 'Lưu cấu hình thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <FormField
          control={form.control}
          name="defaultAmountPerDay"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Số tiền ăn mặc định / ngày (VND)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  disabled={isSubmitting}
                  {...field}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v === '' ? 0 : Number(v));
                  }}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu cấu hình
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

// =====================================================================================
// HELPERS
// =====================================================================================

/** Tạo 1 row trống (khi HS chưa có điểm danh). */
function makeEmptyRow(s: StudentBrief): StudentReconciliation {
  return {
    student: s,
    presentDays: 0,
    plannedDays: 0,
    unplannedDays: 0,
    amountDue: 0,
    creditAmount: 0,
  };
}

/**
 * Tính số liệu đối lưu từ danh sách `ClassAttendanceDay` của 1 học sinh.
 * - PRESENT → presentDays
 * - ABSENT_PLANNED → plannedDays
 * - ABSENT_UNPLANNED → unplannedDays
 * - amountDue = presentDays * feePerDay
 * - creditAmount = plannedDays * feePerDay
 */
function computeReconciliation(
  student: StudentBrief,
  days: ClassAttendanceDay[],
  feePerDay: number,
): StudentReconciliation {
  let presentDays = 0;
  let plannedDays = 0;
  let unplannedDays = 0;
  for (const day of days) {
    // Mỗi day có thể chứa nhiều records (cho nhiều HS) → chỉ lấy record của HS hiện tại
    const myRec = day.records.find((r) => Number(r.studentId) === student.id);
    if (!myRec) continue;
    switch (myRec.status as AttendanceStatus) {
      case 'PRESENT':
        presentDays += 1;
        break;
      case 'ABSENT_PLANNED':
        plannedDays += 1;
        break;
      case 'ABSENT_UNPLANNED':
        unplannedDays += 1;
        break;
    }
  }
  return {
    student,
    presentDays,
    plannedDays,
    unplannedDays,
    amountDue: presentDays * feePerDay,
    creditAmount: plannedDays * feePerDay,
  };
}

// Re-export utility for tests
export { computeReconciliation, makeEmptyRow };
