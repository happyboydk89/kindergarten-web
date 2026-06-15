'use client';

/**
 * =====================================================================================
 * TAB 3 — QUẢN LÝ GIÁO VIÊN & PHÂN CÔNG
 * =====================================================================================
 *
 * Phạm vi:
 *   1. Bảng danh sách giáo viên (lọc theo campusId).
 *      - Gọi GET /api/v1/teachers
 *   2. Panel "Phân công đứng lớp":
 *      - Bước 1: Chọn 1 lớp (Select) → load danh sách lớp của campusId.
 *      - Bước 2: Hiển thị Checkbox list giáo viên (cùng campus).
 *      - Ràng buộc: chỉ cho phép tích từ 1 đến 3 checkbox (validate Zod).
 *      - Bước 3: Bấm "Lưu phân công" → PUT /api/v1/classes/:id/teachers.
 *
 * Ràng buộc:
 *   - Luôn check `res?.success && res.data` trước khi dùng.
 *   - Submit button có loading + disabled.
 * =====================================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  Save,
  UserCheck,
  UserCog,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { teacherService, type TeacherBrief } from '@/services/teacher.service';
import { classService, type ClassInfo } from '@/services/class.service';
import type { GradeLevel } from '@/types';
import { GRADE_LEVEL_LABELS } from '@/types';

const assignmentSchema = z.object({
  classId: z.string().min(1, 'Vui lòng chọn lớp'),
  teacherIds: z
    .array(z.string())
    .min(1, 'Phải chọn ít nhất 1 giáo viên')
    .max(3, 'Mỗi lớp chỉ được tối đa 3 giáo viên phụ trách'),
});

export function TeachersTab({ campusId }: { campusId: string }) {
  // ============== STATE: danh sách giáo viên ==============
  const [teachers, setTeachers] = useState<TeacherBrief[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

  // ============== STATE: phân công ==============
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [initialTeacherIds, setInitialTeacherIds] = useState<Set<string>>(new Set());
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // ============== EFFECT: load teachers theo campus ==============
  useEffect(() => {
    if (!campusId) {
      setTeachers([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoadingTeachers(true);
      try {
        const res = await teacherService.list({ campusId, limit: 100 });
        if (!cancelled && res?.success && res.data) {
          const payload = res.data as unknown;
          if (Array.isArray(payload)) {
            setTeachers(payload as TeacherBrief[]);
          } else {
            const p = payload as { data: TeacherBrief[] };
            setTeachers(p.data ?? []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách giáo viên');
        }
      } finally {
        if (!cancelled) setIsLoadingTeachers(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  // ============== EFFECT: load classes khi campusId thay đổi ==============
  useEffect(() => {
    if (!campusId) {
      setClasses([]);
      setSelectedClassId('');
      setSelectedTeacherIds(new Set());
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
  }, [campusId]);

  // ============== EFFECT: khi chọn lớp → load giáo viên hiện tại của lớp ==============
  useEffect(() => {
    if (!selectedClassId) {
      setSelectedTeacherIds(new Set());
      setInitialTeacherIds(new Set());
      return;
    }
    const target = classes.find((c) => c.id === selectedClassId);
    const current = new Set(target?.teacherIds ?? []);
    setSelectedTeacherIds(new Set(current));
    setInitialTeacherIds(current);
  }, [selectedClassId, classes]);

  // ============== COMPUTED: lớp đang chọn + số lượng giáo viên hiện tại ==============
  const currentClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId],
  );

  const isDirty = useMemo(() => {
    if (selectedTeacherIds.size !== initialTeacherIds.size) return true;
    for (const id of selectedTeacherIds) {
      if (!initialTeacherIds.has(id)) return true;
    }
    return false;
  }, [selectedTeacherIds, initialTeacherIds]);

  // ============== CALLBACK: toggle checkbox ==============
  const toggleTeacher = useCallback((teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        // Không cho phép vượt quá 3
        if (next.size >= 3) {
          toast.warning('Mỗi lớp chỉ được phân công tối đa 3 giáo viên');
          return prev;
        }
        next.add(teacherId);
      }
      return next;
    });
  }, []);

  // ============== CALLBACK: lưu phân công ==============
  const handleSaveAssignment = useCallback(async () => {
    const validation = assignmentSchema.safeParse({
      classId: selectedClassId,
      teacherIds: Array.from(selectedTeacherIds),
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? 'Vui lòng kiểm tra lại dữ liệu');
      return;
    }
    if (!isDirty) {
      toast.info('Không có thay đổi để lưu');
      return;
    }

    setIsSavingAssignment(true);
    try {
      const res = await classService.assignTeachers(selectedClassId, {
        teacherIds: Array.from(selectedTeacherIds),
      });
      if (res?.success && res.data) {
        toast.success('Đã lưu phân công giáo viên');
        // Cập nhật lại class trong state
        setClasses((prev) =>
          prev.map((c) => (c.id === res.data!.id ? res.data! : c)),
        );
        setInitialTeacherIds(new Set(res.data.teacherIds ?? []));
        setSelectedTeacherIds(new Set(res.data.teacherIds ?? []));
      } else {
        toast.error(res?.message ?? 'Lưu phân công thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setIsSavingAssignment(false);
    }
  }, [selectedClassId, selectedTeacherIds, isDirty]);

  return (
    <div className="space-y-4">
      {/* =============== PHẦN 1: BẢNG GIÁO VIÊN =============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <UserCog className="h-5 w-5 text-indigo-600" />
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
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : isLoadingTeachers ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <EmptyState message="Chưa có giáo viên nào trong cơ sở này." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Số điện thoại</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Khối dạy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-slate-800">{t.fullName}</TableCell>
                      <TableCell className="font-mono text-xs">{t.phoneNumber}</TableCell>
                      <TableCell className="text-slate-600">{t.email ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.teachingGradeLevels && t.teachingGradeLevels.length > 0 ? (
                            t.teachingGradeLevels.map((gl) => (
                              <Badge key={gl} variant="outline" className="font-normal">
                                {GRADE_LEVEL_LABELS[gl as GradeLevel]}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
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

      {/* =============== PHẦN 2: PHÂN CÔNG ĐỨNG LỚP =============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            Phân công giáo viên đứng lớp
          </CardTitle>
          <CardDescription>
            Chọn 1 lớp bên dưới, sau đó tích chọn từ <strong>1 đến 3</strong> giáo viên phụ trách
            chung. Bấm <strong>Lưu phân công</strong> để ghi nhận.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!campusId ? (
            <EmptyState message="Vui lòng chọn cơ sở ở thanh trên." />
          ) : (
            <>
              {/* Bước 1: chọn lớp */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Lớp học cần phân công</label>
                  <Select
                    value={selectedClassId}
                    onValueChange={setSelectedClassId}
                    disabled={loadingClasses}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingClasses ? 'Đang tải lớp...' : 'Chọn lớp'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {GRADE_LEVEL_LABELS[c.gradeLevel as GradeLevel]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hiển thị thông tin tóm tắt lớp đang chọn */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tóm tắt</label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {currentClass ? (
                      <>
                        Đang phân công cho lớp <strong>{currentClass.name}</strong> (
                        {GRADE_LEVEL_LABELS[currentClass.gradeLevel as GradeLevel]}) · Hiện có{' '}
                        <strong>{currentClass.teacherIds?.length ?? 0}</strong> giáo viên
                      </>
                    ) : (
                      <span className="text-slate-400">Chưa chọn lớp</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bước 2: danh sách checkbox giáo viên */}
              {selectedClassId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Chọn giáo viên phụ trách</p>
                    <Badge
                      variant={selectedTeacherIds.size > 3 ? 'destructive' : 'secondary'}
                      className="font-normal"
                    >
                      Đã chọn: {selectedTeacherIds.size} / 3
                    </Badge>
                  </div>

                  {teachers.length === 0 ? (
                    <EmptyState message="Cơ sở này chưa có giáo viên nào để phân công." />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {teachers.map((t) => {
                        const checked = selectedTeacherIds.has(t.id);
                        return (
                          <label
                            key={t.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50 has-[[data-state=checked]]:border-indigo-300 has-[[data-state=checked]]:bg-indigo-50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleTeacher(t.id)}
                              disabled={isSavingAssignment}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {t.fullName}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {t.phoneNumber}
                                {t.teachingGradeLevels && t.teachingGradeLevels.length > 0 && (
                                  <>
                                    {' · '}
                                    {t.teachingGradeLevels
                                      .map((gl) => GRADE_LEVEL_LABELS[gl as GradeLevel])
                                      .join(', ')}
                                  </>
                                )}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Bước 3: nút lưu */}
              {selectedClassId && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  {isDirty && (
                    <span className="text-xs text-amber-600">Có thay đổi chưa lưu</span>
                  )}
                  <Button
                    onClick={handleSaveAssignment}
                    disabled={isSavingAssignment || !isDirty}
                  >
                    {isSavingAssignment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : isDirty ? (
                      <>
                        <Save className="h-4 w-4" />
                        Lưu phân công
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Đã lưu
                      </>
                    )}
                  </Button>
                </div>
              )}
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
