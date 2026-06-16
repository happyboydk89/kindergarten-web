import apiClient from '@/lib/api-client';
import type { ApiResponse, GradeLevel } from '@/types';

/**
 * Một lớp mà giáo viên đang phụ trách (dùng để hiển thị "Lớp đang dạy" trong danh sách GV).
 */
export interface TaughtClassBrief {
  classId: number;
  className: string;
  gradeLevel: string;
  academicYear: string;
  isMainTeacher: boolean;
}

/**
 * Thông tin 1 giáo viên trả về từ Backend.
 *
 * Trường `taughtClasses` được tính từ bảng `class_teachers` (BE join kèm theo
 * khi list). Cho phép FE hiển thị cột "Lớp đang dạy" trong bảng danh sách GV
 * mà không cần gọi thêm API.
 */
export interface TeacherBrief {
  id: number;
  phoneNumber: string;
  fullName: string;
  email?: string;
  role: string;
  avatarUrl?: string | null;
  /**
   * Danh sách khối GV có thể dạy (derived từ `taughtClasses.class.gradeLevel`,
   * unique + sort). Rỗng nếu GV chưa được phân công lớp nào.
   */
  teachingGradeLevels?: GradeLevel[];
  /** Danh sách lớp GV đang dạy (từ bảng class_teachers). */
  taughtClasses?: TaughtClassBrief[];
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
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
  }): Promise<ApiResponse<TeacherBrief[]>> {
    return apiClient.get('/teachers', { params });
  },

  /**
   * Lấy thông tin 1 giáo viên theo id.
   * GET /api/v1/teachers/:id
   */
  async getById(id: string): Promise<ApiResponse<TeacherBrief>> {
    return apiClient.get(`/teachers/${id}`);
  },

  /**
   * Tạo mới 1 giáo viên.
   * POST /api/v1/teachers
   * Body: { phoneNumber, fullName, email?, password?, campusId? }
   *
   * - `campusId` (optional): nếu truyền → tự động gán GV vào `user_campuses`,
   *   giúp GV xuất hiện trong danh sách filter theo campus.
   * - `password` (optional): nếu không truyền → BE tự sinh random 8 ký tự,
   *   trả về trong `response.data.generatedPassword` (chỉ hiển thị 1 lần duy nhất).
   *   PRINCIPAL cần copy mật khẩu này đưa cho giáo viên (sau này GV tự đổi).
   */
  async create(payload: {
    phoneNumber: string;
    fullName: string;
    email?: string;
    password?: string;
    campusId?: string;
  }): Promise<
    ApiResponse<TeacherBrief & { generatedPassword?: string }>
  > {
    return apiClient.post('/teachers', payload);
  },
};

