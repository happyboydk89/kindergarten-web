import apiClient from '@/lib/api-client';
import type { ApiResponse } from '@/types';

/**
 * Cấu hình tiền ăn (meal fee) cho 1 cơ sở.
 * Lưu ý: endpoint này được dùng để cấu hình "tiền ăn mặc định / ngày"
 * cho từng campus. BE dự kiến expose:
 *   GET  /api/v1/campuses/:campusId/meal-fee
 *   PUT  /api/v1/campuses/:campusId/meal-fee
 *
 * (Convention giống /campuses/:id/fee-configs đã có trong CONTEXT)
 */
export interface MealFeeConfig {
  campusId: string;
  /** Số tiền ăn mặc định / ngày (VND). */
  defaultAmountPerDay: number;
  updatedAt?: string;
}

export interface MealFeePayload {
  defaultAmountPerDay: number;
}

export const mealFeeService = {
  /**
   * Lấy cấu hình tiền ăn hiện tại của 1 cơ sở.
   * GET /api/v1/campuses/:campusId/meal-fee
   */
  async get(campusId: string): Promise<ApiResponse<MealFeeConfig>> {
    return apiClient.get(`/campuses/${campusId}/meal-fee`);
  },

  /**
   * Cập nhật cấu hình tiền ăn của 1 cơ sở.
   * PUT /api/v1/campuses/:campusId/meal-fee
   */
  async update(campusId: string, payload: MealFeePayload): Promise<ApiResponse<MealFeeConfig>> {
    return apiClient.put(`/campuses/${campusId}/meal-fee`, payload);
  },
};
