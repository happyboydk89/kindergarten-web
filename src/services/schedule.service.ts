import apiClient from '@/lib/api-client';
import type { ApiResponse } from '@/types';

/**
 * Lịch thực đơn theo ngày (DailySchedule) — MENU THỐNG NHẤT theo campus.
 * BE lưu `breakfast`/`lunch`/`snack` (chuỗi legacy) + FK dishId (mới).
 * FE ưu tiên hiển thị `breakfastDish.name` khi có.
 */
export interface DailySchedule {
  date: string; // YYYY-MM-DD (VN)
  /** Món ăn sáng (chuỗi tự do, fallback khi không có FK). */
  breakfast: string | null;
  /** Món ăn trưa. */
  lunch: string | null;
  /** Món xế chiều. */
  snack: string | null;
  breakfastDishId: number | null;
  lunchDishId: number | null;
  snackDishId: number | null;
  breakfastDish: DishSummary | null;
  lunchDish: DishSummary | null;
  snackDish: DishSummary | null;
  activities: string | null;
  campusId: number;
  id?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Tóm tắt Dish được nhúng vào response (id + name + mealType + calories). */
export interface DishSummary {
  id: number;
  name: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'SNACK';
  calories: number | null;
}

/** Response khi GET /schedules/weekly-by-campus — endpoint chính cho trang /dashboard/menu. */
export interface WeeklyScheduleByCampusResponse {
  campus: { id: number; name: string };
  startDate: string;
  endDate: string;
  totalFound: number;
  days: DailySchedule[];
}

/** Response khi GET /schedules/weekly (classId-based, giữ tương thích cũ). */
export interface WeeklyScheduleResponse {
  class: { id: number; name: string; gradeLevel: string; campusId: number; academicYear: string };
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

export const scheduleService = {
  /**
   * Lấy thực đơn cả tuần (T2..CN) theo campus — MENU THỐNG NHẤT (1 campus / 1 ngày).
   * GET /api/v1/schedules/weekly-by-campus?campusId=&weekStart=YYYY-MM-DD
   */
  async getWeeklyByCampus(params: {
    campusId: string;
    weekStart: string;
  }): Promise<ApiResponse<WeeklyScheduleByCampusResponse>> {
    return apiClient.get('/schedules/weekly-by-campus', { params });
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
   * Set thực đơn cả tuần qua Dish catalog — calendar table ở FE.
   * POST /api/v1/schedules/menu-week
   * Body: { campusId, days: [{ date, breakfastDishId?, lunchDishId?, snackDishId? }] }
   * (không còn gradeLevel — menu unified).
   */
  async setMenuForWeek(
    payload: SetMenuForWeekPayload,
  ): Promise<ApiResponse<SetMenuForWeekResponse>> {
    return apiClient.post('/schedules/menu-week', payload);
  },
};

export interface SetMenuForWeekPayload {
  campusId: number;
  days: Array<{
    date: string;
    breakfastDishId?: number | null;
    lunchDishId?: number | null;
    snackDishId?: number | null;
  }>;
}

export interface SetMenuForWeekResponse {
  campusId: number;
  saved: Array<{
    date: string;
    breakfastDishId: number | null;
    breakfastDish: DishSummary | null;
    lunchDishId: number | null;
    lunchDish: DishSummary | null;
    snackDishId: number | null;
    snackDish: DishSummary | null;
  }>;
}
