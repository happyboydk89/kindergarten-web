import apiClient from '@/lib/api-client';
import type { ApiResponse } from '@/types';

/**
 * Món ăn trong danh mục dinh dưỡng.
 * Trường `nutrients` là thành phần dưỡng chất (chuỗi tự do, vd "Đạm 12g, Béo 8g").
 */
export interface Dish {
  id: string;
  name: string;
  nutrients?: string;
  campusId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDishPayload {
  name: string;
  nutrients?: string;
  campusId?: string;
}

export const dishService = {
  /**
   * Lấy danh mục món ăn.
   * GET /api/v1/dishes?campusId=...
   */
  async list(params?: { campusId?: string }): Promise<ApiResponse<Dish[]>> {
    return apiClient.get('/dishes', { params });
  },

  /**
   * Thêm 1 món ăn vào danh mục.
   * POST /api/v1/dishes
   */
  async create(payload: CreateDishPayload): Promise<ApiResponse<Dish>> {
    return apiClient.post('/dishes', payload);
  },

  /**
   * Cập nhật món ăn.
   * PUT /api/v1/dishes/:id
   */
  async update(id: string, payload: Partial<CreateDishPayload>): Promise<ApiResponse<Dish>> {
    return apiClient.put(`/dishes/${id}`, payload);
  },

  /**
   * Xóa món ăn.
   * DELETE /api/v1/dishes/:id
   */
  async remove(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/dishes/${id}`);
  },
};
