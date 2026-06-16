'use client';

/**
 * =====================================================================================
 * TAB 1 — QUẢN LÝ LỚP HỌC & HỌC PHÍ KHỐI
 * =====================================================================================
 *
 * Phạm vi:
 *   1. Bảng danh sách lớp học của campus đang chọn (filter theo selectedCampusId).
 *      - Gọi GET /api/v1/classes?campusId=...
 *      - Mỗi dòng có nút Sửa / Xóa / Xem nhanh kết quả điểm danh.
 *   2. Dialog Thêm / Sửa lớp (name, gradeLevel, academicYear, teacherIds).
 *   3. Bảng cấu hình học phí cứng theo khối (read-only, lấy từ GRADE_LEVEL_FEE).
 *   4. Dialog "Xem nhanh kết quả điểm danh của lớp" (lấy theo ngày hôm nay).
 *
 * Ràng buộc business:
 *   - Mọi request qua apiClient (withCredentials + baseURL tương đối).
 *   - Luôn check `res?.success && res.data` trước khi dùng.
 *   - Nút Submit có loading + disabled ngay khi click.
 * =====================================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  School,
  Trash2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { classService, type ClassInfo, type ClassPayload } from '@/services/class.service';
import { attendanceService, type ClassAttendanceDay } from '@/services/attendance.service';
import type { GradeLevel } from '@/types';
import { GRADE_LEVELS, GRADE_LEVEL_LABELS } from '@/types';
import { formatVND } from '@/lib/utils';
import {
  GRADE_LEVEL_FEE,
  GRADE_LEVELS_ORDERED,
  getSuggestedAcademicYear,
  isValidAcademicYear,
} from './shared';

// ---------- Schema validate Form Thêm/Sửa lớp ----------
const classFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên lớp phải có ít nhất 2 ký tự')
    .max(50, 'Tên lớp quá dài'),
  gradeLevel: z.enum(['NHA_TRE', 'MAM', 'CHOI', 'LA'] as const, {
    required_error: 'Vui lòng chọn khối lớp',
  }),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'Năm học phải có định dạng YYYY-YYYY (vd: 2025-2026)')
    .refine(isValidAcademicYear, 'Năm học phải là YYYY-(YYYY+1)'),
});
type ClassFormValues = z.infer<typeof classFormSchema>;

/** Hàm helper lấy ngày hôm nay theo timezone VN (YYYY-MM-DD). */
function getVietnamToday(): string {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, '0');
  const d = String(vn.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ClassesTab({ campusId }: { campusId: string }) {
  const router = useRouter();

  // ============== STATE ==============
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Dialog xem nhanh điểm danh
  const [previewingClass, setPreviewingClass] = useState<ClassInfo | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDay, setPreviewDay] = useState<ClassAttendanceDay | null>(null);

  // ============== EFFECT: load lớp theo campusId ==============
  useEffect(() => {
    if (!campusId) {
      setClasses([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await classService.list({ campusId, limit: 100 });
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setClasses(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách lớp');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  // ============== CALLBACK: mở form thêm ==============
  const openCreate = useCallback(() => {
    setEditingClass(null);
    setFormDialogOpen(true);
  }, []);

  // ============== CALLBACK: mở form sửa ==============
  const openEdit = useCallback((c: ClassInfo) => {
    setEditingClass(c);
    setFormDialogOpen(true);
  }, []);

  // ============== CALLBACK: xóa ==============
  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await classService.remove(deletingId);
      if (res?.success) {
        toast.success('Đã xóa lớp');
        setClasses((prev) => prev.filter((c) => c.id !== deletingId));
      } else {
        toast.error(res?.message ?? 'Xóa lớp thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa lớp thất bại');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  }, [deletingId]);

  // ============== CALLBACK: xem nhanh điểm danh ==============
  const handlePreviewAttendance = useCallback(async (c: ClassInfo) => {
    setPreviewingClass(c);
    setPreviewDay(null);
    setPreviewLoading(true);
    try {
      const today = getVietnamToday();
      const res = await attendanceService.getClassAttendance(c.id, today);
      if (res?.success && Array.isArray(res.data)) {
        setPreviewDay(res.data[0] ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải điểm danh');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ============== CALLBACK: callback khi tạo/sửa thành công ==============
  const handleClassSaved = useCallback((saved: ClassInfo) => {
    setClasses((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* =============== PHẦN 1: BẢNG LỚP HỌC =============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <School className="h-5 w-5 text-indigo-600" />
                Danh sách lớp học
              </CardTitle>
              <CardDescription>
                Quản lý các lớp đang hoạt động tại cơ sở. Lọc tự động theo cơ sở đang chọn.
              </CardDescription>
            </div>
            <Button onClick={openCreate} disabled={!campusId}>
              <Plus className="h-4 w-4" />
              Thêm lớp
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên để xem danh sách lớp." />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <EmptyState message="Chưa có lớp nào trong cơ sở này. Bấm Thêm lớp để tạo mới." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên lớp</TableHead>
                    <TableHead>Khối</TableHead>
                    <TableHead>Năm học</TableHead>
                    <TableHead>Giáo viên phụ trách</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-indigo-50/40"
                      onClick={() => router.push(`/dashboard/classes/${c.id}`)}
                    >
                      <TableCell className="font-medium text-slate-800">
                        <Link
                          href={`/dashboard/classes/${c.id}`}
                          className="flex items-center gap-1 hover:text-indigo-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {GRADE_LEVEL_LABELS[c.gradeLevel as GradeLevel]}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.academicYear ?? '—'}</TableCell>
                      <TableCell className="text-slate-600">
                        {c.teacherNames && c.teacherNames.length > 0
                          ? c.teacherNames.join(', ')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Xem nhanh điểm danh"
                            onClick={() => handlePreviewAttendance(c)}
                          >
                            <Eye className="h-4 w-4 text-sky-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Sửa lớp"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-4 w-4 text-indigo-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Xóa lớp"
                            onClick={() => setDeletingId(c.id)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
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

      {/* =============== PHẦN 2: BẢNG HỌC PHÍ CỨNG THEO KHỐI =============== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-800">Cấu hình học phí cứng theo khối</CardTitle>
          <CardDescription>
            Mức học phí áp dụng đồng nhất cho mọi lớp trong từng khối. Giá trị chỉ hiển thị
            tham khảo, cập nhật theo chính sách nhà trường.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GRADE_LEVELS_ORDERED.map((gl) => (
              <div
                key={gl}
                className="rounded-lg border border-slate-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Khối
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {GRADE_LEVEL_LABELS[gl]}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-600">
                  {formatVND(GRADE_LEVEL_FEE[gl])}
                </p>
                <p className="text-xs text-slate-500">/ tháng / học sinh</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* =============== DIALOG THÊM/SỬA LỚP =============== */}
      <ClassFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        editing={editingClass}
        campusId={campusId}
        onSaved={(c) => {
          handleClassSaved(c);
          setFormDialogOpen(false);
        }}
      />

      {/* =============== ALERT DIALOG XÁC NHẬN XÓA =============== */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa lớp học này?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Lớp sẽ bị xóa khỏi cơ sở đang chọn.
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
                'Xóa lớp'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* =============== DIALOG XEM NHANH ĐIỂM DANH =============== */}
      <AttendancePreviewDialog
        classItem={previewingClass}
        loading={previewLoading}
        day={previewDay}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewingClass(null);
            setPreviewDay(null);
          }
        }}
        onViewFull={() => {
          if (previewingClass) {
            router.push(`/dashboard/attendance?classId=${previewingClass.id}`);
          }
        }}
      />
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
// SUB-COMPONENT: ClassFormDialog
// =====================================================================================
function ClassFormDialog({
  open,
  onOpenChange,
  editing,
  campusId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ClassInfo | null;
  campusId: string;
  onSaved: (c: ClassInfo) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      gradeLevel: undefined as unknown as GradeLevel,
      academicYear: getSuggestedAcademicYear(),
    },
  });

  // Reset form khi mở dialog hoặc chuyển từ "Thêm" sang "Sửa"
  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? '',
        gradeLevel: (editing?.gradeLevel as GradeLevel) ?? undefined,
        academicYear: editing?.academicYear ?? getSuggestedAcademicYear(),
      });
    }
  }, [open, editing, form]);

  const onSubmit = async (values: ClassFormValues) => {
    if (!campusId) {
      toast.error('Vui lòng chọn cơ sở trước khi tạo lớp');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: ClassPayload = {
        name: values.name.trim(),
        gradeLevel: values.gradeLevel,
        academicYear: values.academicYear,
        campusId,
      };
      const res = editing
        ? await classService.update(editing.id, payload)
        : await classService.create(payload);
      if (res?.success && res.data) {
        toast.success(editing ? 'Đã cập nhật lớp' : 'Đã tạo lớp mới');
        onSaved(res.data);
      } else {
        toast.error(res?.message ?? 'Lưu lớp thất bại');
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
          <DialogTitle>{editing ? 'Sửa thông tin lớp' : 'Thêm lớp học mới'}</DialogTitle>
          <DialogDescription>
            Nhập tên lớp, chọn khối và năm học. Lớp sẽ gắn với cơ sở đang chọn ở thanh trên.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên lớp</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: Lá 1, Mầm A, ..."
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
              name="gradeLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Khối lớp</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn khối" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GRADE_LEVELS.map((gl) => (
                        <SelectItem key={gl.value} value={gl.value}>
                          {gl.label}
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
              name="academicYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Năm học</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="2025-2026"
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
              <Button type="submit" disabled={isSubmitting || !campusId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : editing ? (
                  'Lưu thay đổi'
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tạo lớp
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
// SUB-COMPONENT: AttendancePreviewDialog
// =====================================================================================
function AttendancePreviewDialog({
  classItem,
  loading,
  day,
  onOpenChange,
  onViewFull,
}: {
  classItem: ClassInfo | null;
  loading: boolean;
  day: ClassAttendanceDay | null;
  onOpenChange: (o: boolean) => void;
  onViewFull: () => void;
}) {
  const stats = useMemo(() => {
    if (!day) return { present: 0, absentPlanned: 0, absentUnplanned: 0, total: 0 };
    return {
      present: day.records.filter((r) => r.status === 'PRESENT').length,
      absentPlanned: day.records.filter((r) => r.status === 'ABSENT_PLANNED').length,
      absentUnplanned: day.records.filter((r) => r.status === 'ABSENT_UNPLANNED').length,
      total: day.records.length,
    };
  }, [day]);

  return (
    <Dialog open={!!classItem} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Điểm danh — {classItem?.name}</DialogTitle>
          <DialogDescription>
            Xem nhanh kết quả điểm danh ngày hôm nay ({getVietnamToday()}).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !day ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
            Hôm nay chưa có dữ liệu điểm danh cho lớp này.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-emerald-50 p-2">
                <p className="text-xs text-slate-500">Có mặt</p>
                <p className="text-lg font-bold text-emerald-600">{stats.present}</p>
              </div>
              <div className="rounded-md bg-amber-50 p-2">
                <p className="text-xs text-slate-500">Nghỉ phép</p>
                <p className="text-lg font-bold text-amber-600">{stats.absentPlanned}</p>
              </div>
              <div className="rounded-md bg-rose-50 p-2">
                <p className="text-xs text-slate-500">Nghỉ không phép</p>
                <p className="text-lg font-bold text-rose-600">{stats.absentUnplanned}</p>
              </div>
            </div>

            {/* Danh sách học sinh */}
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã HS</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {day.records.map((r) => (
                    <TableRow key={r.studentId}>
                      <TableCell className="font-mono text-xs">{r.studentCode}</TableCell>
                      <TableCell>{r.studentName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === 'PRESENT'
                              ? 'success'
                              : r.status === 'ABSENT_PLANNED'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {r.status === 'PRESENT'
                            ? 'Có mặt'
                            : r.status === 'ABSENT_PLANNED'
                              ? 'Nghỉ phép'
                              : 'Nghỉ KP'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={onViewFull}>Xem chi tiết</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
