import apiClient from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export type DishMealType = 'BREAKFAST' | 'LUNCH' | 'SNACK';

export const DISH_MEAL_TYPE_LABELS: Record<DishMealType, string> = {
  BREAKFAST: 'Sáng',
  LUNCH: 'Trưa',
  SNACK: 'Xế',
};

export const DISH_MEAL_TYPE_ORDER: DishMealType[] = ['BREAKFAST', 'LUNCH', 'SNACK'];

/**
 * Một món ăn trong catalog của 1 campus. Tất cả trường dinh dưỡng + ingredients
 * là OPTIONAL. Chỉ `name` + `mealType` là bắt buộc.
 */
export interface Dish {
  id: number;
  campusId: number;
  name: string;
  mealType: DishMealType;
  ingredients: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDishPayload {
  campusId: number;
  name: string;
  mealType: DishMealType;
  ingredients?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface UpdateDishPayload {
  name?: string;
  mealType?: DishMealType;
  ingredients?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  isActive?: boolean;
}

export const dishService = {
  /**
   * Danh sách món ăn theo campus. Có thể filter mealType / search.
   * GET /api/v1/dishes?campusId=&mealType=&search=&isActive=&page=&limit=
   */
  async list(params: {
    campusId?: string;
    mealType?: DishMealType;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Dish[]>> {
    return apiClient.get('/dishes', { params });
  },

  /**
   * Tạo món ăn mới.
   * POST /api/v1/dishes
   */
  async create(payload: CreateDishPayload): Promise<ApiResponse<Dish>> {
    return apiClient.post('/dishes', payload);
  },

  /**
   * Cập nhật món ăn.
   * PUT /api/v1/dishes/:id
   */
  async update(id: number, payload: UpdateDishPayload): Promise<ApiResponse<Dish>> {
    return apiClient.put(`/dishes/${id}`, payload);
  },

  /**
   * Xoá mềm (archive) món ăn.
   * DELETE /api/v1/dishes/:id
   */
  async remove(id: number): Promise<ApiResponse<Dish>> {
    return apiClient.delete(`/dishes/${id}`);
  },
};
