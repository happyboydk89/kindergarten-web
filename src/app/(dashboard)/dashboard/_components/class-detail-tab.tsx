'use client';

/**
 * =====================================================================================
 * TAB: CHI TIẾT LỚP HỌC — /dashboard/classes/:id
 * =====================================================================================
 *
 * Phạm vi:
 *   1. Header: tên lớp, khối, năm học, nút quay lại + nút "Sửa" thông tin cơ bản.
 *   2. Quick stats: sĩ số, số GV, học phí (kèm nút chỉnh sửa).
 *   3. Section Giáo viên: DS giáo viên phụ trách + nút "Phân công" (PRINCIPAL).
 *   4. Section Học sinh: DS học sinh hiện tại + nút "Thêm" / "Xóa" từng SV (PRINCIPAL).
 *
 * Mọi thao tác write đều gọi `onChanged` → parent refetch cả detail lẫn students.
 * Phân quyền:
 *   - PRINCIPAL: đầy đủ quyền (sửa info, phân GV, thêm/xóa SV, đổi phí).
 *   - STAFF/TEACHER: chỉ xem.
 * =====================================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Loader2,
  Pencil,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useAuth } from '@/hooks/use-auth';
import { cn, formatVND } from '@/lib/utils';
import { GRADE_LEVEL_LABELS, type GradeLevel } from '@/types';

import {
  classService,
  type ClassDetail,
  type ClassTeacher,
} from '@/services/class.service';
import { studentService, type StudentBrief } from '@/services/student.service';
import { attendanceService, type StudentAttendanceRecord } from '@/services/attendance.service';

import { AssignTeachersDialog } from './assign-teachers-dialog';
import { AddStudentsDialog } from './add-students-dialog';
import { EditFeeDialog } from './edit-fee-dialog';

const formatDateTime = (d: string | Date): string => {
  try {
    return new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(d);
  }
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClassDetailTab({
  classId,
  campusId,
}: {
  classId: string;
  campusId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const isPrincipal = user?.role === 'PRINCIPAL';

  // ============== STATE ==============
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

  // Dialogs
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAddStudentsOpen, setIsAddStudentsOpen] = useState(false);
  const [isFeeOpen, setIsFeeOpen] = useState(false);

  // Remove student confirm
  const [removingStudent, setRemovingStudent] = useState<StudentBrief | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // ============== FETCHERS ==============
  const fetchDetail = useCallback(async () => {
    if (!classId) return;
    setIsLoadingDetail(true);
    try {
      const res = await classService.getById(classId);
      if (res.success && res.data) setDetail(res.data);
      else toast.error(res.message ?? 'Không thể tải thông tin lớp');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải lớp');
    } finally {
      setIsLoadingDetail(false);
    }
  }, [classId]);

  const fetchStudents = useCallback(async () => {
    if (!classId) return;
    setIsLoadingStudents(true);
    try {
      const res = await attendanceService.getClassAttendance(classId, new Date().toISOString().slice(0, 10));
      // attendanceService trả về `ClassAttendanceDay[]` — lấy SV từ records.
      // Tuy nhiên, nếu lớp chưa điểm danh hôm nay thì data rỗng. Fallback về gọi
      // studentService.list với classId để lấy đầy đủ SV (kể cả chưa điểm danh).
      const records: StudentAttendanceRecord[] =
        res.success && res.data && res.data.length > 0 ? res.data[0].records : [];

      if (records.length > 0) {
        setStudents(
          records.map((r) => ({
            id: Number(r.studentId),
            fullName: r.studentName,
            status: 'STUDYING' as const,
          })),
        );
      } else {
        // Fallback: gọi studentService với classId
        const stRes = await studentService.list({ classId, limit: 200 });
        if (stRes.success) {
          const rawData: unknown = stRes.data;
          const items: StudentBrief[] =
            rawData && typeof rawData === 'object' && 'data' in rawData
              ? ((rawData as { data: StudentBrief[] }).data ?? [])
              : Array.isArray(rawData)
                ? (rawData as StudentBrief[])
                : [];
          setStudents(items);
        }
      }
    } catch {
      // fallback cuối cùng: gọi studentService.list
      try {
        const stRes = await studentService.list({ classId, limit: 200 });
        if (stRes.success) {
          const rawData: unknown = stRes.data;
          const items: StudentBrief[] =
            rawData && typeof rawData === 'object' && 'data' in rawData
              ? ((rawData as { data: StudentBrief[] }).data ?? [])
              : Array.isArray(rawData)
                ? (rawData as StudentBrief[])
                : [];
          setStudents(items);
        }
      } catch {
        // silent
      }
    } finally {
      setIsLoadingStudents(false);
    }
  }, [classId]);

  const fetchTeachers = useCallback(async () => {
    if (!classId) return;
    setIsLoadingTeachers(true);
    try {
      const res = await classService.getTeachers(classId);
      if (res.success && res.data) setClassTeachers(res.data.teachers);
    } catch {
      // silent
    } finally {
      setIsLoadingTeachers(false);
    }
  }, [classId]);

  // ============== EFFECTS ==============
  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  // ============== HANDLERS ==============
  const handleClassChanged = useCallback(() => {
    void fetchDetail();
    void fetchStudents();
    void fetchTeachers();
  }, [fetchDetail, fetchStudents, fetchTeachers]);

  const handleRemoveStudent = useCallback(async () => {
    if (!removingStudent) return;
    setIsRemoving(true);
    try {
      const res = await classService.removeStudent(classId, String(removingStudent.id));
      if (res.success) {
        toast.success(res.data?.removed ? 'Đã xóa học sinh khỏi lớp' : 'Học sinh không ở trong lớp này');
        setRemovingStudent(null);
        handleClassChanged();
        router.refresh();
      } else {
        toast.error(res.message ?? 'Xóa thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setIsRemoving(false);
    }
  }, [removingStudent, classId, handleClassChanged, router]);

  // ============== RENDER ==============
  if (isLoadingDetail && !detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-sm text-slate-500">Không tìm thấy lớp học.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard/classes">Quay lại danh sách lớp</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============== HEADER ============== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-slate-500">
            <Link href="/dashboard/classes">
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">{detail.name}</h1>
            <Badge variant="secondary">
              {GRADE_LEVEL_LABELS[detail.gradeLevel as GradeLevel] ?? detail.gradeLevel}
            </Badge>
            {detail.academicYear && (
              <span className="text-sm text-slate-500">· {detail.academicYear}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Cơ sở: <strong>{detail.campus?.name}</strong>
          </p>
        </div>
      </div>

      {/* ============== QUICK STATS ============== */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Sĩ số</p>
                <p className="text-2xl font-bold text-slate-900">
                  {students.length}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {detail._count?.students ?? students.length}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Giáo viên phụ trách</p>
                <p className="text-2xl font-bold text-slate-900">{classTeachers.length}</p>
                <p className="text-xs text-muted-foreground">
                  {classTeachers.filter((t) => t.isMainTeacher).length > 0
                    ? `${classTeachers.filter((t) => t.isMainTeacher).length} chủ nhiệm`
                    : 'Chưa có chủ nhiệm'}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600">
                <UserCog className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Học phí / tháng</p>
                <p className="text-2xl font-bold text-slate-900">
                  {detail.effectiveBaseFee !== null ? formatVND(detail.effectiveBaseFee) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detail.baseFee !== null && detail.baseFee !== undefined
                    ? 'Đang dùng giá riêng của lớp'
                    : detail.effectiveBaseFee !== null
                      ? 'Đang dùng FeeConfig mặc định theo khối'
                      : 'Chưa cấu hình'}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-lg p-2.5',
                  detail.baseFee !== null && detail.baseFee !== undefined
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-sky-50 text-sky-600',
                )}
              >
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            {isPrincipal && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 -ml-2 text-indigo-600 hover:text-indigo-700"
                onClick={() => setIsFeeOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {detail.baseFee !== null && detail.baseFee !== undefined
                  ? 'Sửa học phí'
                  : 'Đặt học phí riêng'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============== TEACHERS SECTION ============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <UserCog className="h-5 w-5 text-indigo-600" />
                Giáo viên phụ trách
              </CardTitle>
              <CardDescription>
                {classTeachers.length === 0
                  ? 'Lớp chưa có giáo viên phụ trách'
                  : `${classTeachers.length} giáo viên đang phụ trách lớp`}
              </CardDescription>
            </div>
            {isPrincipal && campusId && (
              <Button onClick={() => setIsAssignOpen(true)}>
                <Pencil className="h-4 w-4" />
                Phân công
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTeachers ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : classTeachers.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
              Chưa có giáo viên nào. Bấm <strong>Phân công</strong> để thêm.
            </p>
          ) : (
            <ul className="space-y-2">
              {classTeachers.map((t) => (
                <li
                  key={t.linkId}
                  className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-amber-100 text-amber-700">
                      {getInitials(t.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{t.fullName}</p>
                      {t.isMainTeacher && (
                        <Badge variant="default" className="text-xs">
                          Chủ nhiệm
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.phoneNumber}
                      {t.email ? ` · ${t.email}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    Phân công: {formatDateTime(t.assignedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ============== STUDENTS SECTION ============== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Users className="h-5 w-5 text-indigo-600" />
                Học sinh trong lớp
              </CardTitle>
              <CardDescription>
                {students.length === 0
                  ? 'Lớp chưa có học sinh'
                  : `${students.length} học sinh đang theo học`}
              </CardDescription>
            </div>
            {isPrincipal && campusId && (
              <Button onClick={() => setIsAddStudentsOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Thêm học sinh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStudents ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
              Lớp chưa có học sinh. Bấm <strong>Thêm học sinh</strong> để chọn từ danh sách của cơ sở.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">STT</TableHead>
                    <TableHead className="w-28">Mã SV</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Biệt danh</TableHead>
                    {isPrincipal && <TableHead className="w-24 text-center">Thao tác</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">#{s.id}</TableCell>
                      <TableCell className="font-medium text-slate-800">{s.fullName}</TableCell>
                      <TableCell className="text-slate-600">{s.nickname ?? '—'}</TableCell>
                      {isPrincipal && (
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Xóa khỏi lớp"
                            onClick={() => setRemovingStudent(s)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============== DIALOGS ============== */}
      <AssignTeachersDialog
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        classId={classId}
        className={detail.name}
        campusId={campusId}
        currentTeachers={classTeachers}
        onSaved={handleClassChanged}
      />
      <AddStudentsDialog
        open={isAddStudentsOpen}
        onOpenChange={setIsAddStudentsOpen}
        classId={classId}
        className={detail.name}
        campusId={campusId}
        currentStudentIds={students.map((s) => String(s.id))}
        onSaved={handleClassChanged}
      />
      <EditFeeDialog
        open={isFeeOpen}
        onOpenChange={setIsFeeOpen}
        classId={classId}
        className={detail.name}
        currentBaseFee={detail.baseFee ?? null}
        effectiveBaseFee={detail.effectiveBaseFee ?? null}
        onSaved={handleClassChanged}
      />

      <AlertDialog
        open={!!removingStudent}
        onOpenChange={(o) => !o && setRemovingStudent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa học sinh khỏi lớp?</AlertDialogTitle>
            <AlertDialogDescription>
              Học sinh <strong>{removingStudent?.fullName}</strong> sẽ được tách khỏi lớp{' '}
              <strong>{detail.name}</strong>. Học sinh vẫn còn trong hệ thống và có thể được thêm
              lại sau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRemoveStudent()}
              disabled={isRemoving}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                'Xóa khỏi lớp'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
