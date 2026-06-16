'use client';

/**
 * =====================================================================================
 * TAB 5 — ĐIỂM DANH
 * =====================================================================================
 *
 * Phạm vi (refactor từ page.tsx cũ — file 392 dòng):
 *   1. Chọn ngày (DatePicker) + chọn lớp (Select — lọc theo campusId).
 *   2. Bulk mark attendance cho lớp đó: PRESENT / ABSENT_PLANNED / ABSENT_UNPLANNED.
 *   3. Ghi chú giáo viên cho từng học sinh.
 *   4. Nút "Chọn tất cả đi học" để tiết kiệm thao tác.
 *
 * Data isolation theo campus:
 *   - `classService.list({ campusId, limit: 100 })` chỉ trả lớp thuộc campus đang chọn.
 *   - Khi user đổi campus ở Header → re-fetch danh sách lớp + reset lớp đang chọn.
 *
 * Phân quyền:
 *   - TEACHER: chỉ thấy lớp mình phụ trách (BE đã lọc qua `ClassTeacher`).
 *     Nếu teacher không thuộc lớp nào → hiển thị empty state.
 *   - PRINCIPAL/STAFF: thấy tất cả lớp trong campus.
 * =====================================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCheck,
  Save,
  UserCheck,
  UserX,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarOff,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/hooks/use-auth';
import {
  attendanceService,
  type StudentAttendanceRecord,
  type AbsentListItem,
} from '@/services/attendance.service';
import { classService, type ClassInfo } from '@/services/class.service';
import type { AttendanceStatus, GradeLevel } from '@/types';
import { ATTENDANCE_STATUS_LABELS, GRADE_LEVEL_LABELS } from '@/types';

function getVietnamToday(): string {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const yyyy = vnTime.getFullYear();
  const mm = String(vnTime.getMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface AttendanceFormValues {
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    teacherNote: string;
  }>;
}

const statusOptions: Array<{ value: AttendanceStatus; icon: React.ReactNode; className: string }> = [
  { value: 'PRESENT', icon: <UserCheck className="h-3.5 w-3.5" />, className: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:border-emerald-600' },
  { value: 'ABSENT_PLANNED', icon: <Clock className="h-3.5 w-3.5" />, className: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 data-[state=on]:bg-amber-600 data-[state=on]:text-white data-[state=on]:border-amber-600' },
  { value: 'ABSENT_UNPLANNED', icon: <UserX className="h-3.5 w-3.5" />, className: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 data-[state=on]:bg-red-600 data-[state=on]:text-white data-[state=on]:border-red-600' },
];

export function AttendanceTab({ campusId }: { campusId: string }) {
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL';

  const [selectedDate, setSelectedDate] = useState(getVietnamToday());
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<AttendanceFormValues>({
    defaultValues: { records: [] },
  });

  const formRecords = watch('records');

  // Load danh sách lớp theo campusId (reset lớp đang chọn khi đổi campus)
  useEffect(() => {
    if (!campusId) {
      setClasses([]);
      setSelectedClassId('');
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingClasses(true);
      try {
        const res = await classService.list({ campusId, limit: 100 });
        if (cancelled) return;
        if (res.success) {
          setClasses(res.data ?? []);
          // Mặc định chọn lớp đầu tiên (hoặc lớp user đang dạy nếu teacher)
          if (user?.classId) {
            setSelectedClassId(user.classId);
          } else if (res.data && res.data.length > 0) {
            setSelectedClassId(res.data[0].id);
          } else {
            setSelectedClassId('');
          }
        }
      } catch {
        if (!cancelled) toast.error('Không thể tải danh sách lớp học');
      } finally {
        if (!cancelled) setIsLoadingClasses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId, user?.classId]);

  const fetchAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    setIsLoadingRecords(true);
    try {
      const res = await attendanceService.getClassAttendance(selectedClassId, selectedDate);
      if (res.success && res.data) {
        const dayData = res.data[0];
        if (dayData) {
          setRecords(dayData.records);
          reset({
            records: dayData.records.map((r) => ({
              studentId: r.studentId,
              status: r.status,
              teacherNote: r.teacherNote ?? '',
            })),
          });
        } else {
          setRecords([]);
          reset({ records: [] });
        }
      } else {
        setRecords([]);
        reset({ records: [] });
      }
    } catch {
      toast.error('Không thể tải dữ liệu điểm danh');
    } finally {
      setIsLoadingRecords(false);
    }
  }, [selectedClassId, selectedDate, reset]);

  useEffect(() => {
    if (selectedClassId) {
      void fetchAttendance();
    }
  }, [selectedClassId, selectedDate, fetchAttendance]);

  const handleStatusChange = (index: number, status: AttendanceStatus) => {
    setValue(`records.${index}.status`, status);
  };

  const markAllPresent = () => {
    formRecords.forEach((_, i) => {
      setValue(`records.${i}.status`, 'PRESENT');
    });
  };

  const markAllPresentCount = formRecords.filter((r) => r.status !== 'PRESENT').length;

  const onSubmit = async (data: AttendanceFormValues) => {
    if (!selectedClassId) return;
    setIsSaving(true);
    try {
      const res = await attendanceService.markAttendance({
        classId: selectedClassId,
        date: selectedDate,
        records: data.records.map((r) => ({
          studentId: r.studentId,
          status: r.status,
          teacherNote: r.teacherNote?.trim() || undefined,
        })),
      });
      if (res.success) {
        toast.success('Đã lưu bảng điểm danh');
      } else {
        toast.error(res.message ?? 'Lưu thất bại');
      }
    } catch {
      toast.error('Lưu bảng điểm danh thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name;

  // ============== DANH SÁCH VẮNG (phân trang 20/page, sort date DESC) ==============
  const [absentItems, setAbsentItems] = useState<AbsentListItem[]>([]);
  const [absentMeta, setAbsentMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [absentPage, setAbsentPage] = useState(1);
  const [isLoadingAbsent, setIsLoadingAbsent] = useState(false);

  // Reset về trang 1 khi đổi campus
  useEffect(() => {
    setAbsentPage(1);
  }, [campusId]);

  const fetchAbsent = useCallback(async () => {
    if (!campusId) {
      setAbsentItems([]);
      setAbsentMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
      return;
    }
    setIsLoadingAbsent(true);
    try {
      const res = await attendanceService.getAbsentList({
        campusId,
        page: absentPage,
        limit: 20,
      });
      if (res?.success) {
        const items = Array.isArray(res.data) ? res.data : [];
        setAbsentItems(items);
        if (res.meta) setAbsentMeta(res.meta);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách vắng');
    } finally {
      setIsLoadingAbsent(false);
    }
  }, [campusId, absentPage]);

  useEffect(() => {
    void fetchAbsent();
  }, [fetchAbsent]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Điểm danh lớp học</h1>
        <p className="text-sm text-muted-foreground">
          {selectedClassName
            ? `Lớp ${selectedClassName} — ${selectedDate}`
            : 'Chọn lớp và ngày để bắt đầu điểm danh'}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Ngày điểm danh</label>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Lớp học</label>
              {!campusId ? (
                <p className="text-sm text-muted-foreground">Vui lòng chọn cơ sở trước</p>
              ) : isLoadingClasses ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn lớp học" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.academicYear ? `(${c.academicYear})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              variant="outline"
              size="default"
              onClick={() => void fetchAttendance()}
              disabled={!selectedClassId || isLoadingRecords}
              className="h-9 shrink-0"
            >
              {isLoadingRecords ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Tải dữ liệu
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedClassId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-600">Chọn lớp học để bắt đầu</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPrincipal
                ? 'Vui lòng chọn lớp và ngày để xem danh sách điểm danh'
                : 'Bạn chưa được phân công lớp học. Vui lòng liên hệ Ban Giám hiệu.'}
            </p>
          </CardContent>
        </Card>
      ) : isLoadingRecords ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : formRecords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-600">Không có học sinh nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lớp học này chưa có học sinh hoặc chưa có dữ liệu điểm danh.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Danh sách điểm danh</CardTitle>
              <CardDescription>{formRecords.length} học sinh</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {markAllPresentCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllPresent}
                  className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  Chọn tất cả đi học ({markAllPresentCount})
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSubmit(onSubmit)}
                disabled={isSaving}
                className="gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? 'Đang lưu...' : 'Lưu bảng điểm danh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">STT</TableHead>
                    <TableHead className="w-28">Mã SV</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead className="w-80">Trạng thái</TableHead>
                    <TableHead className="w-44">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formRecords.map((record, index) => {
                    const student = records[index];
                    return (
                      <TableRow key={student?.studentId ?? index}>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {student?.studentCode ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {student?.studentName ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {statusOptions.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                data-state={record.status === opt.value ? 'on' : 'off'}
                                onClick={() => handleStatusChange(index, opt.value)}
                                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${opt.className}`}
                              >
                                {opt.icon}
                                {ATTENDANCE_STATUS_LABELS[opt.value]}
                              </button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            {...register(`records.${index}.teacherNote`)}
                            placeholder="Ghi chú..."
                            className="h-8 min-h-0 resize-none text-xs"
                            rows={1}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* =============== DANH SÁCH VẮNG MẶT (20/page, date DESC) =============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <CalendarOff className="h-5 w-5 text-red-600" />
                Danh sách vắng mặt
              </CardTitle>
              <CardDescription>
                {campusId
                  ? `Tổng cộng ${absentMeta.total} lượt vắng tại cơ sở đang chọn — sắp xếp theo ngày gần nhất.`
                  : 'Vui lòng chọn cơ sở để xem danh sách vắng mặt.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
              <CalendarOff className="h-8 w-8 text-slate-300" />
              <span>Vui lòng chọn cơ sở ở thanh trên.</span>
            </div>
          ) : isLoadingAbsent ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : absentItems.length === 0 ? (
            <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-8 text-center text-sm text-emerald-700">
              <UserCheck className="h-8 w-8 text-emerald-300" />
              <span>Không có học sinh vắng mặt nào trong cơ sở này.</span>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-center">#</TableHead>
                      <TableHead className="w-32">Ngày vắng</TableHead>
                      <TableHead>Học sinh</TableHead>
                      <TableHead className="w-44">Lớp</TableHead>
                      <TableHead className="w-36">Loại vắng</TableHead>
                      <TableHead>Lý do</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absentItems.map((item, idx) => (
                      <TableRow key={item.attendanceId}>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {(absentMeta.page - 1) * absentMeta.limit + idx + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.date}</TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {item.student.fullName}
                        </TableCell>
                        <TableCell>
                          {item.student.className ? (
                            <span className="text-sm text-slate-700">
                              {item.student.className}
                              {item.student.gradeLevel && (
                                <span className="ml-1 text-xs text-slate-500">
                                  (
                                  {GRADE_LEVEL_LABELS[item.student.gradeLevel as GradeLevel] ??
                                    item.student.gradeLevel}
                                  )
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.status === 'ABSENT_PLANNED' ? (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-700"
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              Nghỉ có phép
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-red-300 bg-red-50 text-red-700"
                            >
                              <UserX className="mr-1 h-3 w-3" />
                              Nghỉ không phép
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.teacherNote ? (
                            <div className="flex items-start gap-1.5 text-sm text-slate-700">
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="line-clamp-2">{item.teacherNote}</span>
                            </div>
                          ) : (
                            <span className="text-xs italic text-slate-400">
                              Không có ghi chú
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination 20/page */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Hiển thị{' '}
                  <strong>
                    {absentMeta.total === 0
                      ? 0
                      : (absentMeta.page - 1) * absentMeta.limit + 1}
                  </strong>
                  –<strong>{Math.min(absentMeta.page * absentMeta.limit, absentMeta.total)}</strong>{' '}
                  trong tổng số <strong>{absentMeta.total}</strong> lượt vắng
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={absentMeta.page <= 1}
                    onClick={() => setAbsentPage(absentMeta.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                  </Button>
                  <span className="text-sm text-slate-600">
                    Trang {absentMeta.page} / {Math.max(1, absentMeta.totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={absentMeta.page >= absentMeta.totalPages}
                    onClick={() => setAbsentPage(absentMeta.page + 1)}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
