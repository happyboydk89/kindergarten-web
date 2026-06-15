import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginationMeta, StudentStatus } from '@/types';

/**
 * Thông tin rút gọn của học sinh (dùng cho danh sách).
 */
export interface StudentBrief {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  classId?: string | null;
  className?: string | null;
  campusId?: string | null;
  campusName?: string | null;
  status: StudentStatus;
  createdAt?: string;
}

/**
 * Response phân trang khi GET /students.
 * Theo CONTEXT_BACKEND.md, các endpoint paginated dùng shape
 * `{ data: T[], meta: { page, limit, total, totalPages } }`.
 *
 * Tuy nhiên axios response interceptor chỉ trả về `response.data`,
 * nên thực tế sẽ là `ApiResponse<{ data: StudentBrief[], meta: PaginationMeta }>`.
 */
export interface StudentListResponse {
  data: StudentBrief[];
  meta: PaginationMeta;
}

/**
 * Payload "Tiếp nhận học sinh mới".
 * Theo CONTEXT_BACKEND.md, `dateOfBirth` chấp nhận cả ISO 8601 đầy đủ
 * (vd "2021-03-12T00:00:00Z") hoặc YYYY-MM-DD ("2021-03-12").
 */
export interface CreateStudentPayload {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  classId?: string;
  status?: StudentStatus;
}

/**
 * Đối tượng Student trả về khi tạo mới (có thêm các trường BE sinh ra).
 */
export interface StudentInfo extends StudentBrief {
  parentIds?: string[];
}

export const studentService = {
  /**
   * Lấy danh sách học sinh có phân trang.
   * GET /api/v1/students?campusId=&classId=&page=&limit=
   */
  async list(params?: {
    campusId?: string;
    classId?: string;
    status?: StudentStatus;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<StudentListResponse>> {
    return apiClient.get('/students', { params });
  },

  /**
   * Lấy thông tin 1 học sinh.
   * GET /api/v1/students/:id
   */
  async getById(id: string): Promise<ApiResponse<StudentInfo>> {
    return apiClient.get(`/students/${id}`);
  },

  /**
   * Tiếp nhận học sinh mới.
   * POST /api/v1/students
   */
  async create(payload: CreateStudentPayload): Promise<ApiResponse<StudentInfo>> {
    return apiClient.post('/students', payload);
  },

  /**
   * Cập nhật thông tin học sinh.
   * PUT /api/v1/students/:id
   */
  async update(id: string, payload: Partial<CreateStudentPayload>): Promise<ApiResponse<StudentInfo>> {
    return apiClient.put(`/students/${id}`, payload);
  },

  /**
   * Xóa (soft delete theo CONTEXT: status = GRADUATED).
   * DELETE /api/v1/students/:id
   */
  async remove(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/students/${id}`);
  },
};
