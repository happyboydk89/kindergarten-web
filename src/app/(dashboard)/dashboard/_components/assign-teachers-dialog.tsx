'use client';

/**
 * =====================================================================================
 * DIALOG: Phân công giáo viên cho lớp
 * =====================================================================================
 *
 * Lấy DS giáo viên thuộc campus hiện tại (qua `teacherService.list`),
 * cho phép chọn 1-3 giáo viên + chỉ định 1 người làm chủ nhiệm.
 * Submit → PUT /api/v1/classes/:id/teachers.
 * =====================================================================================
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserCog } from 'lucide-react';
import { extractApiError } from '@/lib/api-helpers';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { classService, type ClassTeacher } from '@/services/class.service';
import { teacherService, type TeacherBrief } from '@/services/teacher.service';

export function AssignTeachersDialog({
  open,
  onOpenChange,
  classId,
  className,
  campusId,
  currentTeachers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  className: string;
  campusId: string;
  currentTeachers: ClassTeacher[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTeachers, setAllTeachers] = useState<TeacherBrief[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mainTeacherId, setMainTeacherId] = useState<string | null>(null);

  // Load teachers khi mở dialog
  useEffect(() => {
    if (!open || !campusId) return;
    let cancelled = false;
      (async () => {
        setIsLoading(true);
        try {
          const res = await teacherService.list({ campusId, limit: 100 });
          if (cancelled) return;
          if (res.success) {
            const rawData: unknown = res.data;
            const items: TeacherBrief[] =
              rawData && typeof rawData === 'object' && 'data' in rawData
                ? ((rawData as { data: TeacherBrief[] }).data ?? [])
                : Array.isArray(rawData)
                  ? (rawData as TeacherBrief[])
                  : [];
            setAllTeachers(items);
          }
        } catch {
          if (!cancelled) toast.error('Không thể tải danh sách giáo viên');
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
    return () => {
      cancelled = true;
    };
  }, [open, campusId]);

  // Pre-fill từ currentTeachers khi mở
  useEffect(() => {
    if (open) {
      setSelectedIds(currentTeachers.map((t) => String(t.teacherId)));
      const main = currentTeachers.find((t) => t.isMainTeacher);
      setMainTeacherId(main ? String(main.teacherId) : null);
    }
  }, [open, currentTeachers]);

  const selectedCount = selectedIds.length;
  const canSubmit = selectedCount >= 1 && selectedCount <= 3 && !isSubmitting;

  const toggleTeacher = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        // Nếu vừa bỏ chủ nhiệm → reset
        if (mainTeacherId === id) setMainTeacherId(null);
        return next;
      }
      if (prev.length >= 3) {
        toast.warning('Mỗi lớp chỉ phân công tối đa 3 giáo viên');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const payload: { teacherIds: string[]; mainTeacherId?: string } = {
        teacherIds: selectedIds,
      };
      if (mainTeacherId) payload.mainTeacherId = mainTeacherId;

      const res = await classService.assignTeachers(classId, payload);
      if (res.success) {
        toast.success(`Đã phân công ${res.data?.totalAssigned ?? selectedIds.length} giáo viên`);
        onSaved();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.message ?? 'Phân công thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Phân công thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-indigo-600" />
            Phân công giáo viên — Lớp {className}
          </DialogTitle>
          <DialogDescription>
            Chọn 1-3 giáo viên cho lớp này. Tick vào ô "Chủ nhiệm" để chỉ định giáo viên chủ nhiệm.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : allTeachers.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Cơ sở chưa có giáo viên nào. Vui lòng tạo giáo viên trước.
            </p>
          ) : (
            <ul className="divide-y">
              {allTeachers.map((t) => {
                const tid = String(t.id);
                const isSelected = selectedIds.includes(tid);
                const isMain = mainTeacherId === tid;
                return (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between gap-3 p-3 transition-colors ${
                      isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTeacher(tid)}
                        disabled={isSubmitting}
                        aria-label={`Chọn giáo viên ${t.fullName}`}
                      />
                      <div className="min-w-0 flex-1">
                        {/*
                          Dùng <div> + <span> thay vì <p> vì <Badge> render thành <div>,
                          mà HTML spec không cho phép <div> lồng trong <p> → React hydration error.
                          Bug chỉ trigger khi `isMain === true` (sau khi click "Chỉ định chủ nhiệm").
                        */}
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">
                            {t.fullName}
                          </span>
                          {isMain && (
                            <Badge variant="default" className="shrink-0">
                              Chủ nhiệm
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.phoneNumber}
                          {t.email ? ` · ${t.email}` : ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={isMain ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (!isSelected) toggleTeacher(tid);
                        setMainTeacherId(isMain ? null : tid);
                      }}
                      disabled={isSubmitting || !isSelected}
                      className="shrink-0"
                    >
                      {isMain ? 'Bỏ chủ nhiệm' : 'Chỉ định chủ nhiệm'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Đã chọn: <strong>{selectedCount}/3</strong>
          {selectedCount === 0 && ' — Vui lòng chọn ít nhất 1 giáo viên'}
        </p>

        <DialogFooter className="gap-2 pt-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              'Lưu phân công'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
