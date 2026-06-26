'use client';

/**
 * =====================================================================================
 * TAB 3 — QUẢN LÝ GIÁO VIÊN & PHÂN CÔNG (refactor)
 * =====================================================================================
 *
 * Layout mới (dễ quản lý hơn so với bản cũ):
 *   1. Header: tiêu đề + nút "Tạo mới giáo viên" (PRINCIPAL only).
 *   2. Bảng danh sách giáo viên với cột "Lớp đang dạy" — hiển thị tên lớp + badge chủ nhiệm.
 *   3. Section "Phân công giáo viên đứng lớp" mới:
 *      - Bảng MỘT DÒNG MỖI LỚP, columns: Tên lớp | DS giáo viên hiện tại | Hành động.
 *      - Click "Sửa phân công" → mở `AssignTeachersDialog` (đã có) để thay đổi nhanh.
 *   4. Mount `CreateTeacherDialog` ở cuối.
 * =====================================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Building2,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  UserCog,
  Users,
} from 'lucide-react';
import { extractApiError } from '@/lib/api-helpers';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { teacherService, type TeacherBrief } from '@/services/teacher.service';
import { classService, type ClassInfo, type ClassTeacher } from '@/services/class.service';
import type { GradeLevel } from '@/types';
import { GRADE_LEVEL_LABELS } from '@/types';

import { AssignTeachersDialog } from './assign-teachers-dialog';
import { CreateTeacherDialog } from './create-teacher-dialog';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeachersTab({ campusId }: { campusId: string }) {
  const router = useRouter();

  // ============== STATE ==============
  const [teachers, setTeachers] = useState<TeacherBrief[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);
  const [currentClassTeachers, setCurrentClassTeachers] = useState<ClassTeacher[]>([]);
  const [isLoadingClassTeachers, setIsLoadingClassTeachers] = useState(false);

  // ============== EFFECT: load teachers theo campus ==============
  const loadTeachers = useCallback(async () => {
    if (!campusId) {
      setTeachers([]);
      return;
    }
    setIsLoadingTeachers(true);
    try {
      const res = await teacherService.list({ campusId, limit: 200 });
      if (res?.success && res.data) {
        const payload = res.data as unknown;
        if (Array.isArray(payload)) {
          setTeachers(payload as TeacherBrief[]);
        } else {
          const p = payload as { data: TeacherBrief[] };
          setTeachers(p.data ?? []);
        }
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Không thể tải danh sách giáo viên'));
    } finally {
      setIsLoadingTeachers(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  // ============== EFFECT: load classes theo campus ==============
  const loadClasses = useCallback(async () => {
    if (!campusId) {
      setClasses([]);
      return;
    }
    setIsLoadingClasses(true);
    try {
      const res = await classService.list({ campusId, limit: 100 });
      if (res?.success && Array.isArray(res.data)) {
        setClasses(res.data);
      }
    } catch {
      /* silent */
    } finally {
      setIsLoadingClasses(false);
    }
  }, [campusId]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  // ============== CALLBACK: mở dialog sửa phân công cho 1 lớp ==============
  const handleOpenEditAssignment = useCallback(async (klass: ClassInfo) => {
    setEditingClass(klass);
    setIsLoadingClassTeachers(true);
    try {
      const res = await classService.getTeachers(klass.id);
      if (res.success && res.data) {
        setCurrentClassTeachers(res.data.teachers);
      } else {
        setCurrentClassTeachers([]);
      }
    } catch {
      setCurrentClassTeachers([]);
    } finally {
      setIsLoadingClassTeachers(false);
    }
  }, []);

  const handleCloseAssignment = useCallback(() => {
    setEditingClass(null);
    setCurrentClassTeachers([]);
  }, []);

  const handleAssignmentSaved = useCallback(() => {
    // Reload classes (để lấy teacherNames mới) + teachers (để lấy taughtClasses mới)
    void loadClasses();
    void loadTeachers();
    router.refresh();
  }, [loadClasses, loadTeachers, router]);

  const handleTeacherCreated = useCallback(() => {
    void loadTeachers();
    router.refresh();
  }, [loadTeachers, router]);

  // ============== COMPUTED: map teacherId → teacher để tra cứu nhanh ==============
  const teacherById = useMemo(() => {
    const map = new Map<string, TeacherBrief>();
    for (const t of teachers) {
      map.set(String(t.id), t);
    }
    return map;
  }, [teachers]);

  return (
    <div className="space-y-6">
      {/* =============== HEADER =============== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Quản lý Giáo viên
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý tài khoản giáo viên + phân công đứng lớp theo từng cơ sở.
          </p>
        </div>
        {campusId && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo mới giáo viên
          </Button>
        )}
      </div>

      {/* =============== PHẦN 1: BẢNG GIÁO VIÊN + CỘT LỚP ĐANG DẠY =============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Users className="h-5 w-5 text-indigo-600" />
            Danh sách giáo viên
          </CardTitle>
          <CardDescription>
            {campusId
              ? `Tổng cộng ${teachers.length} giáo viên tại cơ sở đang chọn.`
              : 'Vui lòng chọn cơ sở để xem danh sách giáo viên.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8 text-slate-300" />}
              message="Vui lòng chọn cơ sở ở thanh trên."
            />
          ) : isLoadingTeachers ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={<UserCog className="h-8 w-8 text-slate-300" />}
              message="Chưa có giáo viên nào trong cơ sở này. Bấm Tạo mới giáo viên ở trên."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>Giáo viên</TableHead>
                    <TableHead className="w-36">Số điện thoại</TableHead>
                    <TableHead>Lớp đang dạy</TableHead>
                    <TableHead className="w-32">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((t, idx) => {
                    const taughtList = t.taughtClasses ?? [];
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-amber-100 text-amber-700">
                                {getInitials(t.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {t.fullName}
                              </p>
                              {t.email && (
                                <p className="truncate text-xs text-slate-500">{t.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.phoneNumber}</TableCell>
                        <TableCell>
                          {taughtList.length === 0 ? (
                            <span className="text-xs text-slate-400">Chưa phân công lớp</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {taughtList.map((c) => (
                                <Badge
                                  key={c.classId}
                                  variant={c.isMainTeacher ? 'default' : 'secondary'}
                                  className="gap-1"
                                >
                                  {c.isMainTeacher && <BadgeCheck className="h-3 w-3" />}
                                  {c.className}
                                  <span className="text-[10px] opacity-70">
                                    · {GRADE_LEVEL_LABELS[c.gradeLevel as GradeLevel] ?? c.gradeLevel}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.status === 'INACTIVE' ? (
                            <Badge variant="destructive">Ngưng hoạt động</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700">
                              Hoạt động
                            </Badge>
                          )}
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

      {/* =============== PHẦN 2: PHÂN CÔNG GIÁO VIÊN ĐỨNG LỚP =============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            Phân công giáo viên đứng lớp
          </CardTitle>
          <CardDescription>
            Mỗi lớp được phân công <strong>1–3 giáo viên</strong> (1 chủ nhiệm + tối đa 2 trợ giảng).
            Bấm <strong>Sửa phân công</strong> trên từng dòng để thay đổi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!campusId ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8 text-slate-300" />}
              message="Vui lòng chọn cơ sở ở thanh trên."
            />
          ) : isLoadingClasses ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-8 w-8 text-slate-300" />}
              message="Cơ sở này chưa có lớp nào. Tạo lớp ở /dashboard/classes trước."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>Giáo viên phụ trách</TableHead>
                    <TableHead className="w-44 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((c, idx) => {
                    const taughtNames = (c.teacherNames ?? []).filter(Boolean);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800">{c.name}</p>
                            <p className="text-xs text-slate-500">
                              {GRADE_LEVEL_LABELS[c.gradeLevel as GradeLevel] ?? c.gradeLevel}
                              {c.academicYear ? ` · ${c.academicYear}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {taughtNames.length === 0 ? (
                            <span className="text-xs italic text-amber-600">
                              ⚠ Chưa có giáo viên phụ trách
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {taughtNames.map((name, i) => {
                                // teacherNames không kèm mainTeacher → hiển thị thường.
                                // Nếu cần phân biệt, FE sẽ enrich bằng cách gọi classService.getTeachers
                                // (đã dùng trong dialog). Ở đây hiển thị tên đơn giản cho gọn.
                                return (
                                  <Badge key={`${name}-${i}`} variant="secondary" className="font-normal">
                                    {name}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenEditAssignment(c)}
                            disabled={isLoadingClassTeachers}
                          >
                            {isLoadingClassTeachers && editingClass?.id === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                            Sửa phân công
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

      {/* =============== DIALOGS =============== */}
      <CreateTeacherDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        campusId={campusId}
        onCreated={handleTeacherCreated}
      />

      {editingClass && (
        <AssignTeachersDialog
          open={!!editingClass}
          onOpenChange={(o) => {
            if (!o) handleCloseAssignment();
          }}
          classId={editingClass.id}
          className={editingClass.name}
          campusId={campusId}
          currentTeachers={currentClassTeachers}
          onSaved={handleAssignmentSaved}
        />
      )}
    </div>
  );
}

// =====================================================================================
// SUB-COMPONENT: EmptyState
// =====================================================================================
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
      {icon}
      <span>{message}</span>
    </div>
  );
}
