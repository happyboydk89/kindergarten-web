import apiClient from '@/lib/api-client';
import type { ApiResponse, GradeLevel, PaginationMeta } from '@/types';

/**
 * Thông tin 1 giáo viên trả về từ Backend.
 */
export interface TeacherBrief {
  id: string;
  phoneNumber: string;
  fullName: string;
  email?: string;
  campusId?: string;
  campusName?: string;
  /**
   * Các khối giáo viên có thể đứng lớp (vd ['MAM', 'CHOI']).
   * Dùng để gợi ý lớp phù hợp khi phân công.
   */
  teachingGradeLevels?: GradeLevel[];
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

/**
 * Response phân trang khi GET /teachers.
 */
export interface TeacherListResponse {
  data: TeacherBrief[];
  meta: PaginationMeta;
}

export const teacherService = {
  /**
   * Lấy danh sách giáo viên, hỗ trợ filter theo campusId và phân trang.
   * GET /api/v1/teachers
   */
  async list(params?: {
    campusId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<TeacherListResponse>> {
    return apiClient.get('/teachers', { params });
  },

  /**
   * Lấy thông tin 1 giáo viên theo id.
   * GET /api/v1/teachers/:id
   */
  async getById(id: string): Promise<ApiResponse<TeacherBrief>> {
    return apiClient.get(`/teachers/${id}`);
  },
};
