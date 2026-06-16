'use client';

/**
 * =====================================================================================
 * DIALOG: Thêm học sinh vào lớp
 * =====================================================================================
 *
 * Lấy DS học sinh thuộc cùng campus (qua `studentService.list({ campusId })`),
 * LOẠI TRỪ những SV đã có trong lớp hiện tại. Hỗ trợ search theo tên.
 * Multi-select → POST /api/v1/classes/:id/students.
 * =====================================================================================
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Search, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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

import { classService } from '@/services/class.service';
import { studentService, type StudentBrief } from '@/services/student.service';

export function AddStudentsDialog({
  open,
  onOpenChange,
  classId,
  className,
  campusId,
  currentStudentIds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  className: string;
  campusId: string;
  currentStudentIds: string[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentBrief[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // Lấy DS học sinh của campus (lọc ra SV đã ở lớp này rồi)
  useEffect(() => {
    if (!open || !campusId) return;
    let cancelled = false;
      (async () => {
        setIsLoading(true);
        try {
          const res = await studentService.list({ campusId, limit: 200 });
          if (cancelled) return;
          if (res.success) {
            const rawData: unknown = res.data;
            const items: StudentBrief[] =
              rawData && typeof rawData === 'object' && 'data' in rawData
                ? ((rawData as { data: StudentBrief[] }).data ?? [])
                : Array.isArray(rawData)
                  ? (rawData as StudentBrief[])
                  : [];
            setAllStudents(items);
          }
        } catch {
          if (!cancelled) toast.error('Không thể tải danh sách học sinh');
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
    return () => {
      cancelled = true;
    };
  }, [open, campusId]);

  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setSearch('');
    }
  }, [open]);

  // Lọc SV: loại trừ currentStudentIds + filter theo search
  const availableStudents = useMemo(() => {
    const currentSet = new Set(currentStudentIds);
    const keyword = search.trim().toLowerCase();
    return allStudents.filter((s) => {
      if (currentSet.has(String(s.id))) return false;
      if (keyword === '') return true;
      return (
        s.fullName.toLowerCase().includes(keyword) ||
        (s.nickname?.toLowerCase().includes(keyword) ?? false)
      );
    });
  }, [allStudents, currentStudentIds, search]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await classService.addStudents(classId, selectedIds);
      if (res.success) {
        const { totalAdded, totalSkipped } = res.data ?? { totalAdded: 0, totalSkipped: 0 };
        toast.success(
          `Đã thêm ${totalAdded} học sinh${totalSkipped > 0 ? `, bỏ qua ${totalSkipped}` : ''}`,
        );
        onSaved();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.message ?? 'Thêm học sinh thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thêm học sinh thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" />
            Thêm học sinh — Lớp {className}
          </DialogTitle>
          <DialogDescription>
            Chọn từ danh sách học sinh thuộc cơ sở. SV đã ở lớp khác sẽ tự động chuyển sang.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc biệt danh..."
            className="pl-9"
            disabled={isLoading}
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const s = allStudents.find((x) => String(x.id) === id);
              return (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {s?.fullName ?? `ID ${id}`}
                  <button
                    type="button"
                    onClick={() => toggleStudent(id)}
                    className="ml-1 rounded-sm p-0.5 hover:bg-slate-200"
                    aria-label="Bỏ chọn"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <div className="max-h-[360px] overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : availableStudents.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {search
                ? `Không tìm thấy học sinh nào khớp với "${search}"`
                : 'Tất cả học sinh của cơ sở đã ở trong lớp này.'}
            </p>
          ) : (
            <ul className="divide-y">
              {availableStudents.map((s) => {
                const sid = String(s.id);
                const isSelected = selectedIds.includes(sid);
                return (
                  <li
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-3 p-3 transition-colors ${
                      isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => toggleStudent(sid)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleStudent(sid)}
                      disabled={isSubmitting}
                      aria-label={`Chọn học sinh ${s.fullName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {s.fullName}
                        {s.nickname && (
                          <span className="ml-2 text-xs text-slate-500">({s.nickname})</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.className
                          ? `Đang ở lớp ${s.className}`
                          : 'Chưa xếp lớp'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Đã chọn: <strong>{selectedIds.length}</strong> học sinh
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
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={selectedIds.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang thêm...
              </>
            ) : (
              `Thêm ${selectedIds.length} học sinh`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
