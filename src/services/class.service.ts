import apiClient from '@/lib/api-client';
import type { ApiResponse, GradeLevel, PaginationMeta } from '@/types';

/**
 * Thông tin 1 lớp học trả về từ Backend.
 * Trường `teacherIds` (nếu có) là danh sách giáo viên phụ trách — phục vụ
 * cho Tab "Giáo viên & Phân công".
 */
export interface ClassInfo {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  academicYear?: string;
  campusId: string;
  campusName?: string;
  teacherIds?: string[];
  teacherNames?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Response phân trang khi GET /classes?page=&limit=.
 * Theo CONTEXT_BACKEND.md, các endpoint paginated dùng shape
 * `{ data: T[], meta: { page, limit, total, totalPages } }`.
 */
export interface ClassListResponse {
  data: ClassInfo[];
  meta: PaginationMeta;
}

/**
 * Payload khi tạo / cập nhật 1 lớp học.
 */
export interface ClassPayload {
  name: string;
  gradeLevel: GradeLevel;
  academicYear: string; // format YYYY-YYYY, vd "2025-2026"
  campusId: string;
  teacherIds?: string[]; // optional — dùng cho phân công
}

/**
 * Payload riêng cho API phân công giáo viên vào 1 lớp (1-3 cô).
 * Theo spec Tab 3, chỉ chấp nhận từ 1 đến 3 teacherIds.
 */
export interface AssignTeachersPayload {
  teacherIds: string[];
}

export const classService = {
  /**
   * Lấy danh sách lớp học, hỗ trợ filter theo campusId / gradeLevel
   * và phân trang (page, limit).
   * GET /api/v1/classes
   */
  async list(params?: {
    campusId?: string;
    gradeLevel?: GradeLevel;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ClassInfo[]>> {
    return apiClient.get('/classes', { params });
  },

  /**
   * Lấy thông tin 1 lớp theo id.
   * GET /api/v1/classes/:id
   */
  async getById(id: string): Promise<ApiResponse<ClassInfo>> {
    return apiClient.get(`/classes/${id}`);
  },

  /**
   * Tạo mới 1 lớp học.
   * POST /api/v1/classes
   */
  async create(payload: ClassPayload): Promise<ApiResponse<ClassInfo>> {
    return apiClient.post('/classes', payload);
  },

  /**
   * Cập nhật thông tin 1 lớp học.
   * PUT /api/v1/classes/:id
   */
  async update(id: string, payload: Partial<ClassPayload>): Promise<ApiResponse<ClassInfo>> {
    return apiClient.put(`/classes/${id}`, payload);
  },

  /**
   * Xóa 1 lớp học.
   * DELETE /api/v1/classes/:id
   */
  async remove(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/classes/${id}`);
  },

  /**
   * Phân công danh sách giáo viên (1-3) đứng lớp.
   * PUT /api/v1/classes/:id/teachers  (hoặc endpoint tương đương do BE quy định)
   */
  async assignTeachers(id: string, payload: AssignTeachersPayload): Promise<ApiResponse<ClassInfo>> {
    return apiClient.put(`/classes/${id}/teachers`, payload);
  },
};
