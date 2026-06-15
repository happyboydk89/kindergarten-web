'use client';

/**
 * =====================================================================================
 * HOOK: useDashboardStats
 * =====================================================================================
 *
 * Custom hook chịu trách nhiệm kéo 4 chỉ số tổng quan (Học sinh, Lớp, Giáo viên, Doanh thu)
 * cho trang Dashboard.
 *
 * Lý do tách riêng khỏi page.tsx:
 *   1. Tách biệt "data layer" với "view layer" — page chỉ lo render, hook lo fetch.
 *   2. Dễ unit-test (mock services, kiểm tra Promise.allSettled).
 *   3. Tái sử dụng được cho các trang con (vd: sidebar widget, mobile app) nếu cần.
 *
 * Đặc tính kỹ thuật:
 *   - Auto re-fetch mỗi khi `campusId` thay đổi (qua dependency array).
 *   - Dùng `Promise.allSettled` thay cho `Promise.all` — 1 service fail KHÔNG chặn
 *     2 service còn lại. Quan trọng cho dashboard vì user vẫn muốn thấy partial data.
 *   - Dùng `tokenRef` để chống race condition: nếu user đổi campus liên tục, response
 *     của campus cũ sẽ bị bỏ qua khi về sau (tránh hiển thị data cũ sau khi đã đổi).
 *   - 403 (FORBIDDEN) bị bỏ qua im lặng — toast đã được api-client interceptor xử lý.
 *   - 2 chỉ số (Teachers theo campus, Revenue) trả về `null` cho đến khi Backend
 *     bổ sung endpoint; UI page sẽ tự hiển thị "—" + tooltip giải thích.
 *
 * Lưu ý về kiểu dữ liệu:
 *   - studentService.list  → ApiResponse<{ data: StudentBrief[], meta: PaginationMeta }>
 *   - classService.list    → ApiResponse<ClassInfo[]>  (KHÔNG paginated — array thuần)
 *   - teacherService.list  → ApiResponse<{ data: TeacherBrief[], meta: PaginationMeta }>
 * =====================================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { studentService } from '@/services/student.service';
import { classService } from '@/services/class.service';
import { teacherService } from '@/services/teacher.service';
import type { UserRole } from '@/types';

export interface DashboardStats {
  studentCount: number | null;
  classCount: number | null;
  teacherCount: number | null;
  revenue: number | null;
}

export interface UseDashboardStatsResult {
  stats: DashboardStats;
  isLoading: boolean;
  error: string | null;
  /** Trigger fetch lại bằng tay (vd: sau khi tạo lớp/học sinh mới). */
  refetch: () => void;
}

const INITIAL_STATS: DashboardStats = {
  studentCount: null,
  classCount: null,
  teacherCount: null,
  revenue: null,
};

/** Đọc tổng số record từ response dạng paginated `{ data, meta }`. */
function readPaginatedTotal(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const meta = (data as { meta?: { total?: number } }).meta;
  return typeof meta?.total === 'number' ? meta.total : null;
}

/** Đọc length từ response dạng array thuần. */
function readArrayLength(data: unknown): number | null {
  return Array.isArray(data) ? data.length : null;
}

/**
 * Lấy message lỗi từ rejection. Trả về `null` nếu là 403 (đã có toast ở interceptor).
 */
function extractRejectionMessage(reason: unknown): string | null {
  if (!reason || typeof reason !== 'object') return null;
  const r = reason as { code?: string; message?: string };
  if (r.code === 'FORBIDDEN') return null;
  return r.message ?? 'Lỗi không xác định';
}

export function useDashboardStats(
  campusId: string,
  _role: UserRole | null,
): UseDashboardStatsResult {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);
  const tokenRef = useRef(0);

  useEffect(() => {
    // Guard 1: chưa chọn campus → reset về rỗng, KHÔNG loading
    if (!campusId) {
      setStats(INITIAL_STATS);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Guard 2: đánh token để hủy response cũ nếu campusId đổi giữa chừng
    const myToken = ++tokenRef.current;
    setIsLoading(true);
    setError(null);

    (async () => {
      const settled = await Promise.allSettled([
        studentService.list({ campusId, limit: 1 }),
        classService.list({ campusId, limit: 100 }),
        teacherService.list({ campusId, limit: 1 }),
      ]);

      // Nếu token đã đổi (user đã chuyển campus khác) → bỏ qua, không set state
      if (tokenRef.current !== myToken) return;

      const next: DashboardStats = { ...INITIAL_STATS };
      const [students, classes, teachers] = settled;

      if (students.status === 'fulfilled' && students.value?.success) {
        next.studentCount = readPaginatedTotal(students.value.data);
      }
      if (classes.status === 'fulfilled' && classes.value?.success) {
        // Backend trả paginated với meta.total — ưu tiên đọc để có số chính xác
        // (không phụ thuộc limit). Fallback về array.length nếu endpoint cũ
        // không trả meta (chỉ trả array thuần).
        const total = classes.value.meta?.total;
        if (typeof total === 'number') {
          next.classCount = total;
        } else {
          next.classCount = readArrayLength(classes.value.data);
        }
      }
      if (teachers.status === 'fulfilled' && teachers.value?.success) {
        next.teacherCount = readPaginatedTotal(teachers.value.data);
      }

      const messages = settled
        .map((s) => (s.status === 'rejected' ? extractRejectionMessage(s.reason) : null))
        .filter((m): m is string => m !== null);

      setStats(next);
      setError(messages.length > 0 ? messages.join('; ') : null);
      setIsLoading(false);
    })();
  }, [campusId, refetchToken]);

  const refetch = useCallback(() => {
    setRefetchToken((t) => t + 1);
  }, []);

  return { stats, isLoading, error, refetch };
}
