'use client';

/**
 * =====================================================================================
 * TAB 2 — QUẢN LÝ HỌC SINH
 * =====================================================================================
 *
 * Phạm vi:
 *   1. Bảng danh sách học sinh (phân trang, filter theo campusId).
 *      - Gọi GET /api/v1/students?campusId=&page=&limit=
 *      - Đọc `data` và `meta` (page, limit, total, totalPages) từ response.
 *   2. Form "Tiếp nhận học sinh mới":
 *      - Họ, Tên, Ngày sinh (DatePicker), Giới tính, Lớp (Select lọc theo campus + khối phù hợp).
 *      - Submit: POST /api/v1/students.
 *      - Sau khi tạo xong, refresh lại trang hiện tại.
 *
 * Ràng buộc:
 *   - campusId thay đổi → refetch lại từ trang 1.
 *   - Luôn check `res?.success && res.data` trước khi dùng data.
 *   - Submit button có loading + disabled.
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
  GraduationCap,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { extractApiError } from '@/lib/api-helpers';

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
import { DatePicker } from '@/components/ui/date-picker';

import {
  studentService,
  type StudentBrief,
  type StudentInfo,
  type CreateStudentPayload,
} from '@/services/student.service';
import { classService, type ClassInfo } from '@/services/class.service';
import { useAuth } from '@/hooks/use-auth';
import type { GradeLevel } from '@/types';
import { GRADE_LEVEL_LABELS, STUDENT_STATUS_LABELS } from '@/types';

// ---------- Schema validate Form tiếp nhận học sinh ----------
const createStudentSchema = z.object({
  firstName: z.string().min(1, 'Vui lòng nhập họ').max(50, 'Họ quá dài'),
  lastName: z.string().min(1, 'Vui lòng nhập tên').max(50, 'Tên quá dài'),
  dateOfBirth: z
    .string()
    .min(1, 'Vui lòng chọn ngày sinh')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Ngày sinh không hợp lệ'),
  gender: z.string().min(1, 'Vui lòng chọn giới tính'),
  classId: z.string().min(1, 'Vui lòng chọn lớp'),
});
type CreateStudentFormValues = z.infer<typeof createStudentSchema>;

const GENDER_OPTIONS = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
];

const PAGE_SIZE = 10;

export function StudentsTab({ campusId }: { campusId: string }) {
  // ============== STATE ==============
  const { role, user } = useAuth();
  // TEACHER chỉ xem danh sách HS lớp mình dạy, không tiếp nhận HS mới.
  const isTeacher = role === 'TEACHER';

  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // ============== EFFECT: load theo campusId + page ==============
  useEffect(() => {
    setPage(1); // đổi campus → về trang 1
  }, [campusId]);

  useEffect(() => {
    if (!campusId) {
      setStudents([]);
      setMeta({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await studentService.list({ campusId, page, limit: PAGE_SIZE });
        if (cancelled) return;
        if (res?.success) {
          // BE trả về `data: StudentBrief[]` (axios interceptor đã strip wrapper).
          // `res.meta` ở level ApiResponse (cùng cấp với `data`).
          const items = Array.isArray(res.data) ? res.data : [];
          setStudents(items);
          if (res.meta) setMeta(res.meta);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(extractApiError(err, 'Không thể tải danh sách học sinh'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId, page]);

  // ============== CALLBACK: refresh ==============
  const refresh = useCallback(async () => {
    if (!campusId) return;
    try {
      const res = await studentService.list({ campusId, page, limit: PAGE_SIZE });
      if (res?.success) {
        const items = Array.isArray(res.data) ? res.data : [];
        setStudents(items);
        if (res.meta) setMeta(res.meta);
      }
    } catch {
      /* silent */
    }
  }, [campusId, page]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                {isTeacher ? 'Danh sách học sinh lớp của tôi' : 'Danh sách học sinh'}
              </CardTitle>
              <CardDescription>
                {campusId
                  ? isTeacher
                    ? `Bao gồm ${meta.total} học sinh thuộc các lớp bạn đang phụ trách.`
                    : `Tổng cộng ${meta.total} học sinh tại cơ sở đang chọn.`
                  : 'Vui lòng chọn cơ sở để xem danh sách học sinh.'}
              </CardDescription>
            </div>
            {!isTeacher && (
              <Button onClick={() => setCreateOpen(true)} disabled={!campusId}>
                <UserPlus className="h-4 w-4" />
                Tiếp nhận học sinh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState message="Chưa có học sinh nào trong cơ sở này." />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã HS</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs text-slate-500">
                          #{s.id}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {s.fullName}
                          {s.nickname && (
                            <span className="ml-1 text-xs text-slate-400">
                              ({s.nickname})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const klass = (s as StudentInfo).class;
                            return klass?.name ?? s.className ?? '—';
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {STUDENT_STATUS_LABELS[s.status] ?? s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination meta={meta} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <CreateStudentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        campusId={campusId}
        onCreated={async () => {
          // Quay về trang 1 và refresh để thấy học sinh mới
          setPage(1);
          await refresh();
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
// SUB-COMPONENT: Pagination
// =====================================================================================
function Pagination({
  meta,
  onPageChange,
}: {
  meta: { page: number; limit: number; total: number; totalPages: number };
  onPageChange: (p: number) => void;
}) {
  const start = (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Hiển thị <strong>{start}</strong>–<strong>{end}</strong> trong tổng số{' '}
        <strong>{meta.total}</strong> học sinh
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Trước
        </Button>
        <span className="text-sm text-slate-600">
          Trang {meta.page} / {Math.max(1, meta.totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Sau
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: CreateStudentDialog
// =====================================================================================
function CreateStudentDialog({
  open,
  onOpenChange,
  campusId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campusId: string;
  onCreated: () => void | Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const form = useForm<CreateStudentFormValues>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      classId: '',
    },
  });

  // Khi mở dialog → load danh sách lớp của campus hiện tại
  useEffect(() => {
    if (!open) {
      form.reset({ firstName: '', lastName: '', dateOfBirth: '', gender: '', classId: '' });
      return;
    }
    if (!campusId) {
      setClasses([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingClasses(true);
      try {
        const res = await classService.list({ campusId, limit: 100 });
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setClasses(res.data);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, campusId, form]);

  // Gợi ý khối phù hợp dựa theo tuổi của học sinh (heuristic VN)
  const suggestedGrade = useMemo<GradeLevel | null>(() => {
    const dob = form.watch('dateOfBirth');
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    const ageYears = (today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 1.5) return 'NHA_TRE';
    if (ageYears < 3) return 'MAM';
    if (ageYears < 4.5) return 'CHOI';
    return 'LA';
  }, [form]);

  const filteredClassOptions = useMemo(() => {
    if (!suggestedGrade) return classes;
    return classes.filter((c) => c.gradeLevel === suggestedGrade);
  }, [classes, suggestedGrade]);

  const onSubmit = async (values: CreateStudentFormValues) => {
    setIsSubmitting(true);
    try {
      // classId từ Form là string (Select value), BE cần number.
      const classIdNum = Number(values.classId);
      if (!Number.isInteger(classIdNum) || classIdNum <= 0) {
        toast.error('Vui lòng chọn lớp hợp lệ');
        return;
      }
      const payload: CreateStudentPayload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        classId: classIdNum,
        status: 'STUDYING',
      };
      const res = await studentService.create(payload);
      if (res?.success && res.data) {
        toast.success(`Đã tiếp nhận học sinh "${res.data.fullName}" vào lớp.`);
        // Reset form TRƯỚC khi đóng dialog để tránh lần mở sau còn state cũ.
        form.reset({ firstName: '', lastName: '', dateOfBirth: '', gender: '', classId: '' });
        await onCreated();
        onOpenChange(false);
      } else {
        toast.error(res?.message ?? 'Tiếp nhận học sinh thất bại');
      }
    } catch (err) {
      // Lấy thông báo lỗi validation từ interceptor (status 422) nếu có
      const fieldErrors = (err as { fieldErrors?: Record<string, string> })?.fieldErrors;
      const firstFieldError = fieldErrors
        ? Object.values(fieldErrors).find(Boolean) ?? null
        : null;
      const message =
        firstFieldError ??
        (extractApiError(err, 'Có lỗi xảy ra khi tiếp nhận học sinh'));
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            Tiếp nhận học sinh mới
          </DialogTitle>
          <DialogDescription>
            Nhập thông tin cá nhân và chọn lớp phù hợp. Hệ thống sẽ gợi ý khối theo độ tuổi.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Họ</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nguyễn"
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
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="An"
                        autoComplete="off"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày sinh</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Chọn ngày sinh"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giới tính</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn giới tính" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
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
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Lớp học
                    {suggestedGrade && (
                      <span className="ml-2 text-xs font-normal text-indigo-600">
                        Gợi ý: {GRADE_LEVEL_LABELS[suggestedGrade]}
                      </span>
                    )}
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || loadingClasses}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingClasses
                              ? 'Đang tải lớp...'
                              : classes.length === 0
                                ? 'Chưa có lớp nào'
                                : 'Chọn lớp'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredClassOptions.length > 0 ? (
                        filteredClassOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({GRADE_LEVEL_LABELS[c.gradeLevel as GradeLevel]})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-xs text-slate-500">
                          Không có lớp phù hợp với khối gợi ý.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
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
                    <UserPlus className="h-4 w-4" />
                    Tiếp nhận
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
