import apiClient from '@/lib/api-client';
import type { ApiResponse } from '@/types';

/**
 * Cấu trúc 1 cơ sở (Campus) trả về từ Backend.
 * Dựa theo các trường đã dùng ở các service khác (class.service, student.service).
 * Backend có thể trả thêm các trường khác — ta chỉ ép kiểu những trường FE thật sự dùng.
 */
export interface Campus {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payload khi tạo mới một Campus qua POST /api/v1/campuses.
 * Hiện tại FE chỉ gửi 2 trường: name + address (theo yêu cầu Dialog form).
 */
export interface CreateCampusPayload {
  name: string;
  address: string;
}

export const campusService = {
  /**
   * Lấy danh sách toàn bộ Campus đang hoạt động.
   * Dùng để đổ vào Select Switcher ở Header Dashboard.
   *
   * Lưu ý: gọi qua `apiClient` (đã cấu hình `withCredentials: true` và
   * `baseURL = /api/v1` thông qua Next.js rewrite proxy) — không cần truyền
   * full URL.
   */
  async list(): Promise<ApiResponse<Campus[]>> {
    return apiClient.get('/campuses');
  },

  /**
   * Tạo mới một Campus.
   * Gọi POST /api/v1/campuses với body { name, address }.
   */
  async create(payload: CreateCampusPayload): Promise<ApiResponse<Campus>> {
    return apiClient.post('/campuses', payload);
  },
};
