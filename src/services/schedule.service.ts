import apiClient from '@/lib/api-client';
import type { ApiResponse, GradeLevel } from '@/types';

/**
 * Lịch thực đơn theo ngày (DailySchedule).
 *
 * Lưu ý về schema: BE hiện tại lưu `breakfast`/`lunch`/`snack`/`activities`
 * dưới dạng chuỗi tự do (xem `schedule.service.ts` trong BE). Khi có bảng
 * `Dish` riêng, service này sẽ được mở rộng để include `dishIds: string[]`.
 */
export interface DailySchedule {
  date: string; // YYYY-MM-DD (VN)
  /** Món ăn sáng (chuỗi tự do, vd "Cháo gà"). */
  breakfast: string | null;
  /** Món ăn trưa. */
  lunch: string | null;
  /** Món ăn xế chiều. */
  snack: string | null;
  /** Lịch sinh hoạt trong ngày (Markdown / JSON). */
  activities: string | null;
  gradeLevel: GradeLevel;
  campusId: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Response khi GET /schedules/weekly-by-grade. */
export interface WeeklyScheduleByGradeResponse {
  campus: { id: number; name: string };
  gradeLevel: GradeLevel;
  startDate: string;
  endDate: string;
  totalFound: number;
  days: Array<{
    date: string;
    breakfast: string | null;
    lunch: string | null;
    snack: string | null;
    activities: string | null;
  }>;
}

/** Response khi GET /schedules/weekly (classId-based, giữ tương thích cũ). */
export interface WeeklyScheduleResponse {
  class: { id: number; name: string; gradeLevel: GradeLevel; campusId: number; academicYear: string };
  startDate: string;
  endDate: string;
  totalFound: number;
  days: Array<{
    date: string;
    breakfast: string | null;
    lunch: string | null;
    snack: string | null;
    activities: string | null;
  }>;
}

/**
 * Payload cho POST /schedules/bulk.
 * Theo CONTEXT: upsert theo (campusId, gradeLevel, date), nên gửi nguyên tuần.
 */
export interface BulkSchedulesPayload {
  campusId: string;
  gradeLevel: GradeLevel;
  weekStart: string; // YYYY-MM-DD (T2 của tuần)
  schedules: Array<{
    date: string; // YYYY-MM-DD
    breakfast?: string | null;
    lunch?: string | null;
    snack?: string | null;
    activities?: string | null;
  }>;
}

export const scheduleService = {
  /**
   * Lấy lịch thực đơn cả tuần (T2..CN) theo (campusId, gradeLevel).
   * GET /api/v1/schedules/weekly-by-grade?campusId=&gradeLevel=&weekStart=YYYY-MM-DD
   * — Endpoint này phục vụ Campus Switcher ở Dashboard.
   */
  async getWeekly(params: {
    campusId: string;
    gradeLevel: GradeLevel;
    weekStart: string;
  }): Promise<ApiResponse<WeeklyScheduleByGradeResponse>> {
    return apiClient.get('/schedules/weekly-by-grade', { params });
  },

  /**
   * Lấy lịch thực đơn cả tuần theo classId (route cũ, giữ tương thích).
   * GET /api/v1/schedules/weekly?classId=&startDate=YYYY-MM-DD
   */
  async getWeeklyByClass(params: {
    classId: string;
    startDate: string;
  }): Promise<ApiResponse<WeeklyScheduleResponse>> {
    return apiClient.get('/schedules/weekly', { params });
  },

  /**
   * Upsert hàng loạt lịch tuần.
   * POST /api/v1/schedules/bulk
   */
  async bulkUpsert(payload: BulkSchedulesPayload): Promise<ApiResponse<{ totalSaved: number; schedules: DailySchedule[] }>> {
    return apiClient.post('/schedules/bulk', payload);
  },
};
