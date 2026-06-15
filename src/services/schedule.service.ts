import apiClient from '@/lib/api-client';
import type { ApiResponse, GradeLevel } from '@/types';

/**
 * Lịch thực đơn theo ngày (DailySchedule) — 1 record cho (campusId, gradeLevel, date).
 * `dishIds` là danh sách món ăn được gán cho ngày đó (theo khối).
 *
 * Theo CONTEXT_BACKEND.md mục 11.8: POST /schedules/bulk dùng upsert theo
 * (campusId, gradeLevel, date) → gọi lại sẽ ghi đè.
 */
export interface DailySchedule {
  date: string; // YYYY-MM-DD (VN)
  dishIds: string[];
  gradeLevel: GradeLevel;
  campusId: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Response khi GET /schedules/weekly — 1 mảng DailySchedule của cả tuần. */
export type WeeklyScheduleResponse = DailySchedule[];

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
    dishIds: string[];
  }>;
}

export const scheduleService = {
  /**
   * Lấy lịch thực đơn cả tuần (T2..CN) theo campus + khối.
   * GET /api/v1/schedules/weekly?campusId=&gradeLevel=&weekStart=YYYY-MM-DD
   */
  async getWeekly(params: {
    campusId: string;
    gradeLevel: GradeLevel;
    weekStart: string;
  }): Promise<ApiResponse<WeeklyScheduleResponse>> {
    return apiClient.get('/schedules/weekly', { params });
  },

  /**
   * Upsert hàng loạt lịch tuần.
   * POST /api/v1/schedules/bulk
   */
  async bulkUpsert(payload: BulkSchedulesPayload): Promise<ApiResponse<DailySchedule[]>> {
    return apiClient.post('/schedules/bulk', payload);
  },
};
