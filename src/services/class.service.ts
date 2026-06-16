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
  /**
   * Học phí riêng của lớp (VND / tháng). Nếu null → dùng FeeConfig theo khối.
   * Lưu ý: backend Prisma cần được `prisma generate` lại sau khi thêm field này.
   */
  baseFee?: number | null;
  teacherIds?: string[];
  teacherNames?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Response khi GET /classes/:id — chi tiết 1 lớp (kèm counts + effective fee).
 */
export interface ClassDetail extends ClassInfo {
  campus: { id: number; name: string };
  _count: { students: number; teachers: number };
  /**
   * Fee thực tế áp dụng cho lớp (sau khi fallback FeeConfig nếu baseFee null).
   * Null nếu cả baseFee và FeeConfig đều chưa được cấu hình.
   */
  effectiveBaseFee: number | null;
}

/** Giáo viên phụ trách 1 lớp. */
export interface ClassTeacher {
  linkId: number;
  teacherId: number;
  isMainTeacher: boolean;
  assignedAt: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
}

/** Response khi GET /classes/:id/teachers. */
export interface ClassTeachersResponse {
  class: { id: number; name: string; gradeLevel: GradeLevel };
  total: number;
  teachers: ClassTeacher[];
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
  async getById(id: string): Promise<ApiResponse<ClassDetail>> {
    return apiClient.get(`/classes/${id}`);
  },

  /**
   * Lấy DS giáo viên phụ trách 1 lớp.
   * GET /api/v1/classes/:id/teachers
   */
  async getTeachers(id: string): Promise<ApiResponse<ClassTeachersResponse>> {
    return apiClient.get(`/classes/${id}/teachers`);
  },

  /**
   * Thay thế toàn bộ giáo viên phụ trách lớp.
   * PUT /api/v1/classes/:id/teachers
   * Body: { teacherIds: string[], mainTeacherId?: string }
   */
  async assignTeachers(
    id: string,
    payload: { teacherIds: string[]; mainTeacherId?: string },
  ): Promise<ApiResponse<{ classId: number; totalAssigned: number }>> {
    return apiClient.put(`/classes/${id}/teachers`, payload);
  },

  /**
   * Cập nhật học phí riêng của lớp.
   * PUT /api/v1/classes/:id/fee
   * Body: { baseFee: number | null } — truyền null để reset về FeeConfig.
   */
  async updateFee(
    id: string,
    baseFee: number | null,
  ): Promise<ApiResponse<{ id: number; name: string; baseFee: number | null }>> {
    return apiClient.put(`/classes/${id}/fee`, { baseFee });
  },

  /**
   * Thêm nhiều học sinh vào lớp.
   * POST /api/v1/classes/:id/students
   * Body: { studentIds: string[] }
   */
  async addStudents(
    id: string,
    studentIds: string[],
  ): Promise<
    ApiResponse<{
      classId: number;
      totalRequested: number;
      totalAdded: number;
      totalSkipped: number;
      addedStudentIds: number[];
    }>
  > {
    return apiClient.post(`/classes/${id}/students`, { studentIds });
  },

  /**
   * Xóa 1 học sinh khỏi lớp.
   * DELETE /api/v1/classes/:id/students/:studentId
   */
  async removeStudent(
    id: string,
    studentId: string,
  ): Promise<ApiResponse<{ classId: number; studentId: number; removed: boolean }>> {
    return apiClient.delete(`/classes/${id}/students/${studentId}`);
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
};
