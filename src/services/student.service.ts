import apiClient from '@/lib/api-client';
import type { ApiResponse, StudentStatus } from '@/types';

/**
 * Thông tin rút gọn của học sinh (dùng cho danh sách).
 * BE trả về `fullName`, FE tự tách `firstName` / `lastName` cho form nếu cần.
 */
export interface StudentBrief {
  id: number;
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  nickname?: string | null;
  classId?: number | null;
  className?: string | null;
  campusId?: number | null;
  campusName?: string | null;
  status: StudentStatus;
  createdAt?: string;
}

/**
 * Payload "Tiếp nhận học sinh mới".
 * BE schema yêu cầu: `fullName` (string), `classId` (number), `dateOfBirth` (YYYY-MM-DD hoặc ISO 8601).
 * FE sẽ tự concat `firstName + lastName` thành `fullName` trước khi gọi create().
 */
export interface CreateStudentPayload {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  classId: number;
  status?: StudentStatus;
}

/**
 * Đối tượng Student trả về khi tạo mới (có thêm các trường BE sinh ra).
 */
export interface StudentInfo extends StudentBrief {
  parentIds?: number[];
  class?: { id: number; name: string; gradeLevel: string; academicYear: string; campusId: number };
  _count?: { parents: number };
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
  }): Promise<ApiResponse<StudentBrief[]>> {
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
   * Body: { fullName, dateOfBirth, gender?, classId, status? }
   */
  async create(payload: CreateStudentPayload): Promise<ApiResponse<StudentInfo>> {
    const fullName = `${payload.lastName.trim()} ${payload.firstName.trim()}`.trim();
    return apiClient.post('/students', {
      fullName,
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender,
      classId: payload.classId,
      status: payload.status,
    });
  },

  /**
   * Cập nhật thông tin học sinh.
   * PUT /api/v1/students/:id
   */
  async update(id: string, payload: Partial<CreateStudentPayload>): Promise<ApiResponse<StudentInfo>> {
    const body: Record<string, unknown> = { ...payload };
    if (payload.firstName !== undefined || payload.lastName !== undefined) {
      const lastName = payload.lastName ?? '';
      const firstName = payload.firstName ?? '';
      body.fullName = `${lastName.trim()} ${firstName.trim()}`.trim();
      delete body.firstName;
      delete body.lastName;
    }
    if (payload.classId !== undefined) {
      body.classId = Number(payload.classId);
    }
    return apiClient.put(`/students/${id}`, body);
  },

  /**
   * Xóa (soft delete theo CONTEXT: status = GRADUATED).
   * DELETE /api/v1/students/:id
   */
  async remove(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/students/${id}`);
  },
};
