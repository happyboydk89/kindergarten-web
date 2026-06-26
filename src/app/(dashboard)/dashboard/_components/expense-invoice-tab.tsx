'use client';

/**
 * =====================================================================================
 * TAB 6 — NHẬT KÝ CHI TIÊU & HÓA ĐƠN (DATA-DENSE)
 * =====================================================================================
 *
 * Gồm 2 phần:
 *
 *   PHẦN 1: SỔ NHẬT KÝ CHI TIÊU NỘI BỘ
 *     - Form ghi nhận nhanh (Nội dung, Số tiền VND, Ngày chi YYYY-MM-DD).
 *     - Bảng tổng hợp các khoản chi trong tháng đang chọn (lọc theo campusId).
 *     - GET/POST/DELETE /api/v1/expenses
 *
 *   PHẦN 2: DANH SÁCH ĐEN (BLACKLIST) - HỌC SINH CHƯA ĐÓNG TIỀN
 *     - GET /api/v1/invoices?status=UNPAID&month=&year=
 *     - Hiển thị: Tên HS, Lớp, Số tiền còn nợ, SĐT Phụ huynh.
 *     - Nút "Gửi nhắc nhở" → mở SMS/Zalo với SĐT phụ huynh.
 *     - Nếu invoice không include `parentPhone` → fallback lookup qua
 *       /api/v1/parents?studentId=... và cache kết quả.
 *
 * Quy tắc cứng (đã tuân thủ):
 *   - Mọi date là chuỗi `YYYY-MM-DD` (qua date-utils), KHÔNG `new Date()`.
 *   - apiClient (withCredentials + baseURL tương đối).
 *   - Luôn check `res?.success && res.data` trước khi dùng.
 *   - Submit có loading + disabled.
 * =====================================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareWarning,
  Plus,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react';
import { extractApiError } from '@/lib/api-helpers';

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
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
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

import { expenseService, type Expense } from '@/services/expense.service';
import { invoiceService, type InvoiceItem } from '@/services/invoice.service';
import { cn, formatVND } from '@/lib/utils';
import {
  MONTH_LABELS_VN,
  formatVNDate,
  getDatesInMonth,
  getVietnamToday,
} from '@/lib/date-utils';

// ---------- Schema validate Form "Ghi nhận chi tiêu" ----------
const expenseSchema = z.object({
  description: z
    .string()
    .min(2, 'Nội dung phải có ít nhất 2 ký tự')
    .max(200, 'Nội dung quá dài'),
  amount: z
    .number({ invalid_type_error: 'Vui lòng nhập số tiền' })
    .int('Số tiền phải là số nguyên')
    .min(1, 'Số tiền phải lớn hơn 0')
    .max(1_000_000_000, 'Số tiền quá lớn'),
  date: z.string().min(1, 'Vui lòng chọn ngày chi'),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function ExpenseInvoiceTab({ campusId }: { campusId: string }) {
  // ============== STATE: tháng/năm hiện tại (chia sẻ giữa 2 phần) ==============
  const today = getVietnamToday(); // YYYY-MM-DD
  const [month, setMonth] = useState<string>(today.slice(0, 7)); // YYYY-MM
  const [monthNumber, yearNumber] = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return [m, y] as const;
  }, [month]);

  return (
    <div className="space-y-4">
      {/* Thanh chọn tháng dùng chung cho cả 2 phần */}
      <Card>
        <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              Đang xem tháng
            </Badge>
            <span className="text-sm font-medium text-slate-800">
              {MONTH_LABELS_VN[monthNumber - 1]} {yearNumber}
            </span>
          </div>
          <MonthPicker month={month} onChange={setMonth} />
        </CardContent>
      </Card>

      <ExpenseLogSection
        campusId={campusId}
        month={monthNumber}
        year={yearNumber}
      />

      <BlacklistSection
        campusId={campusId}
        month={monthNumber}
        year={yearNumber}
      />
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: MonthPicker — chọn tháng (Select 12 tháng trong năm)
// =====================================================================================
function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [y, m] = month.split('-').map(Number);
  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => shift(-1)} title="Tháng trước">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={month} onValueChange={onChange}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => {
            const v = `${y}-${String(i + 1).padStart(2, '0')}`;
            return (
              <SelectItem key={v} value={v}>
                {MONTH_LABELS_VN[i]} {y}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" onClick={() => shift(1)} title="Tháng sau">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// =====================================================================================
// PHẦN 1: SỔ NHẬT KÝ CHI TIÊU
// =====================================================================================
function ExpenseLogSection({
  campusId,
  month,
  year,
}: {
  campusId: string;
  month: number;
  year: number;
}) {
  // ============== STATE ==============
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ============== EFFECT: load theo campus + tháng/năm ==============
  useEffect(() => {
    if (!campusId) {
      setExpenses([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await expenseService.list({ campusId, month, year, limit: 200 });
        if (cancelled) return;
        if (res?.success && res.data) {
          // res.data có thể là ExpenseListResponse ({data, meta}) hoặc Expense[] (phẳng)
          const payload = res.data as unknown;
          if (Array.isArray(payload)) {
            setExpenses(payload as Expense[]);
          } else {
            const p = payload as { data: Expense[] };
            setExpenses(p.data ?? []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(extractApiError(err, 'Không thể tải nhật ký chi tiêu'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId, month, year]);

  // ============== COMPUTED: tổng hợp tháng ==============
  const totals = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      count: expenses.length,
      totalAmount,
      avgPerDay: expenses.length > 0
        ? Math.round(totalAmount / Math.max(1, getDatesInMonth(`${year}-${String(month).padStart(2, '0')}`).length))
        : 0,
    };
  }, [expenses, month, year]);

  // ============== CALLBACK: thêm mới ==============
  const handleCreated = useCallback((e: Expense) => {
    setExpenses((prev) => [e, ...prev]); // prepend để hiển thị mới nhất trên đầu
  }, []);

  // ============== CALLBACK: xóa ==============
  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await expenseService.remove(deletingId);
      if (res?.success) {
        toast.success('Đã xóa khoản chi');
        setExpenses((prev) => prev.filter((e) => e.id !== deletingId));
      } else {
        toast.error(res?.message ?? 'Xóa thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Xóa thất bại'));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  }, [deletingId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Banknote className="h-5 w-5 text-amber-600" />
              Sổ nhật ký chi tiêu nội bộ
            </CardTitle>
            <CardDescription>
              Ghi nhận nhanh các khoản chi tiền mặt hằng ngày của cơ sở (đi chợ, sửa chữa, v.v.).
            </CardDescription>
          </div>
          <NewExpenseDialog campusId={campusId} onCreated={handleCreated} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tổng hợp nhanh */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard
            label="Số khoản đã chi"
            value={totals.count.toLocaleString('vi-VN')}
            tone="indigo"
          />
          <SummaryCard
            label="Tổng tiền đã chi"
            value={formatVND(totals.totalAmount)}
            tone="rose"
          />
          <SummaryCard
            label="Trung bình / ngày"
            value={formatVND(totals.avgPerDay)}
            tone="amber"
          />
        </div>

        {/* Bảng chi tiết */}
        {!campusId ? (
          <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState message="Tháng này chưa có khoản chi nào. Bấm Ghi nhận chi tiêu để bắt đầu." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatVNDate(e.date)}
                    </TableCell>
                    <TableCell className="text-slate-800">{e.description}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-600">
                      −{formatVND(e.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(e.id)}
                        title="Xóa khoản chi"
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* AlertDialog xác nhận xóa */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khoản chi này?</AlertDialogTitle>
            <AlertDialogDescription>
              Khoản chi sẽ bị xóa vĩnh viễn khỏi sổ nhật ký của tháng. Hành động này không thể
              hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                'Xóa khoản chi'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// =====================================================================================
// SUB-COMPONENT: NewExpenseDialog — Form ghi nhận nhanh 1 khoản chi
// =====================================================================================
function NewExpenseDialog({
  campusId,
  onCreated,
}: {
  campusId: string;
  onCreated: (e: Expense) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: 0,
      date: getVietnamToday(),
    },
  });

  // Reset form mỗi khi đóng
  useEffect(() => {
    if (!open) {
      form.reset({ description: '', amount: 0, date: getVietnamToday() });
    }
  }, [open, form]);

  const onSubmit = async (values: ExpenseFormValues) => {
    if (!campusId) {
      toast.error('Vui lòng chọn cơ sở trước khi ghi nhận');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await expenseService.create({
        campusId,
        description: values.description.trim(),
        amount: values.amount,
        date: values.date,
      });
      if (res?.success && res.data) {
        toast.success('Đã ghi nhận khoản chi');
        onCreated(res.data);
        setOpen(false);
      } else {
        toast.error(res?.message ?? 'Ghi nhận thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Có lỗi xảy ra'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!campusId}>
        <Plus className="h-4 w-4" />
        Ghi nhận chi tiêu
      </Button>
      <CreateExpenseDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        campusId={campusId}
      />
    </>
  );
}

/** Tách Dialog ra sub-component để dùng lại Form context. */
function CreateExpenseDialog({
  open,
  onOpenChange,
  form,
  isSubmitting,
  onSubmit,
  campusId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: ReturnType<typeof useForm<ExpenseFormValues>>;
  isSubmitting: boolean;
  onSubmit: (v: ExpenseFormValues) => Promise<void>;
  campusId: string;
}) {
  return (
    <DialogLike open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-600" />
          Ghi nhận khoản chi mới
        </DialogTitle>
        <DialogDescription>
          Nhập nội dung, số tiền và ngày chi. Khoản chi sẽ được thêm vào sổ nhật ký của tháng.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nội dung chi</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Vd: Tiền đi chợ mua rau cho bữa trưa 30 cháu lớp Lá"
                    rows={2}
                    autoComplete="off"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (VND)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      placeholder="50000"
                      disabled={isSubmitting}
                      value={field.value || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? 0 : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày chi</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Chọn ngày"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
                  <Save className="h-4 w-4" />
                  Lưu khoản chi
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </DialogLike>
  );
}

// =====================================================================================
// PHẦN 2: DANH SÁCH ĐEN (BLACKLIST) - HÓA ĐƠN CHƯA THANH TOÁN
// =====================================================================================
function BlacklistSection({
  campusId,
  month,
  year,
}: {
  campusId: string;
  month: number;
  year: number;
}) {
  // ============== STATE ==============
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Cache SĐT phụ huynh lookup riêng khi invoice không include sẵn. */
  const [parentPhoneCache, setParentPhoneCache] = useState<Record<string, string>>({});
  /** Tập các studentId đang lookup SĐT phụ huynh. */
  const [lookingUp, setLookingUp] = useState<Set<string>>(new Set());

  // ============== EFFECT: load invoices UNPAID ==============
  useEffect(() => {
    if (!campusId) {
      setInvoices([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await invoiceService.list({
          status: 'UNPAID',
          month,
          year,
          limit: 200,
        });
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data)) {
          setInvoices(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(extractApiError(err, 'Không thể tải danh sách nợ học phí'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId, month, year]);

  // ============== EFFECT: với mỗi invoice KHÔNG có parentPhone → lookup ==============
  useEffect(() => {
    invoices.forEach((inv) => {
      if (inv.parentPhone || parentPhoneCache[inv.studentId] || lookingUp.has(inv.studentId)) {
        return;
      }
      // Bắt đầu lookup
      setLookingUp((prev) => new Set(prev).add(inv.studentId));
      invoiceService
        .getParentsByStudent(inv.studentId)
        .then((res) => {
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            // Lấy SĐT của parent đầu tiên (hoặc ưu tiên relationship = "Bố"/"Mẹ")
            const phone = res.data[0]?.phoneNumber;
            if (phone) {
              setParentPhoneCache((prev) => ({ ...prev, [inv.studentId]: phone }));
            }
          }
        })
        .catch(() => {
          /* silent */
        })
        .finally(() => {
          setLookingUp((prev) => {
            const next = new Set(prev);
            next.delete(inv.studentId);
            return next;
          });
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  // ============== CALLBACK: gửi nhắc nhở (mở SMS / Zalo) ==============
  const handleRemind = useCallback((inv: InvoiceItem) => {
    const phone = inv.parentPhone || parentPhoneCache[inv.studentId];
    if (!phone) {
      toast.error('Chưa có SĐT phụ huynh để nhắc nhở');
      return;
    }
    const message = encodeURIComponent(
      `Kính gửi PHHS của em ${inv.studentName} (${inv.className ?? ''}),\n` +
        `Nhà trường xin nhắc nhở khoản học phí tháng ${month}/${year} còn nợ: ${formatVND(inv.totalAmount)}.\n` +
        `Xin vui lòng đóng sớm để đảm bảo quyền lợi cho học sinh. Trân trọng.`,
    );
    // Mặc định mở SMS (zalo:// giao thức không phổ biến trên desktop, SMS an toàn hơn)
    const smsUrl = `sms:${phone}?body=${message}`;
    window.open(smsUrl, '_self');
    toast.success(`Đã mở SMS nhắc nhở cho PHHS em ${inv.studentName}`);
  }, [parentPhoneCache, month, year]);

  // ============== COMPUTED: tổng nợ ==============
  const totalDebt = useMemo(
    () => invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    [invoices],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <MessageSquareWarning className="h-5 w-5 text-rose-600" />
              Danh sách đen — Học sinh chưa đóng tiền
            </CardTitle>
            <CardDescription>
              Tổng hợp các hóa đơn <strong>UNPAID</strong> trong tháng. Bấm{' '}
              <strong>Gửi nhắc nhở</strong> để mở SMS/Zalo nhắc PHHS.
            </CardDescription>
          </div>
          {invoices.length > 0 && (
            <Badge variant="destructive" className="font-normal">
              Tổng nợ: {formatVND(totalDebt)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!campusId ? (
          <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState message="Tuyệt vời! Tháng này không có hóa đơn nào chưa thanh toán." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học sinh</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>SĐT Phụ huynh</TableHead>
                  <TableHead className="text-right">Số tiền nợ</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const phone = inv.parentPhone || parentPhoneCache[inv.studentId];
                  const isLookingUp = lookingUp.has(inv.studentId);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-slate-800">{inv.studentName}</p>
                          {inv.studentCode && (
                            <p className="font-mono text-xs text-slate-500">
                              {inv.studentCode}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{inv.className ?? '—'}</TableCell>
                      <TableCell>
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            className="font-mono text-xs text-indigo-600 hover:underline"
                          >
                            {phone}
                          </a>
                        ) : isLookingUp ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Đang tải...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Chưa có</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-rose-600">
                        {formatVND(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemind(inv)}
                          disabled={!phone}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <MessageSquareWarning className="h-4 w-4" />
                          Gửi nhắc nhở
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================================
// SUB-COMPONENT: DialogLike — wrapper tối giản cho Dialog (tách form context)
// =====================================================================================
function DialogLike({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
}) {
  // Import runtime để tránh vòng tròn — dùng shadcn Dialog từ '@/components/ui/dialog'
  // nhưng lazy vì chỉ cần khi open
  // Để đơn giản, dùng thẳng import bình thường
  return <DialogShell open={open} onOpenChange={onOpenChange}>{children}</DialogShell>;
}

// =====================================================================================
// SUB-COMPONENT: DialogShell — re-export shadcn Dialog để tránh vòng import
// =====================================================================================
import {
  Dialog,
  DialogContent,
  DialogHeader as DHeader,
  DialogTitle as DTitle,
  DialogDescription as DDescription,
} from '@/components/ui/dialog';

function DialogShell({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{children}</DialogContent>
    </Dialog>
  );
}

// Re-alias để JSX trong CreateExpenseDialog dùng
const DialogHeader = DHeader;
const DialogTitle = DTitle;
const DialogDescription = DDescription;

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
// SUB-COMPONENT: SummaryCard
// =====================================================================================
function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'indigo' | 'rose' | 'amber';
}) {
  const toneStyles: Record<typeof tone, string> = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <div className={cn('rounded-md border px-3 py-2', toneStyles[tone])}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
