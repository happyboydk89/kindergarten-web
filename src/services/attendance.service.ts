import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginationMeta, AttendanceStatus } from '@/types';

export interface StudentAttendanceRecord {
  studentId: string;
  studentCode: string;
  studentName: string;
  attendanceId?: string;
  status: AttendanceStatus;
  teacherNote?: string;
  date?: string; // YYYY-MM-DD — được thêm vào để khớp với các API trả về theo student
}

export interface ClassAttendanceDay {
  date: string;
  records: StudentAttendanceRecord[];
}

export interface ClassAttendanceResponse {
  data: ClassAttendanceDay[];
  meta: PaginationMeta;
}

/**
 * Response khi lấy điểm danh theo 1 học sinh trong khoảng ngày.
 * Theo CONTEXT_BACKEND.md: GET /attendance/student/:id trả về phân trang theo NGÀY.
 */
export interface StudentAttendanceRangeResponse {
  data: ClassAttendanceDay[];
  meta: PaginationMeta;
}

export interface MarkAttendancePayload {
  records: Array<{
    studentId: string;
    date: string;
    status: AttendanceStatus;
    teacherNote?: string;
  }>;
}

export const attendanceService = {
  /**
   * Lấy điểm danh của 1 lớp theo 1 ngày.
   * GET /api/v1/attendance/class/:classId?date=YYYY-MM-DD
   */
  async getClassAttendance(
    classId: string,
    date: string,
    page?: number,
    limit?: number,
  ): Promise<ApiResponse<ClassAttendanceDay[]>> {
    const params: Record<string, string | number> = { date };
    if (page) params.page = page;
    if (limit) params.limit = limit;
    return apiClient.get(`/attendance/class/${classId}`, { params });
  },

  /**
   * Lấy điểm danh của 1 học sinh trong khoảng ngày [fromDate, toDate] (YYYY-MM-DD).
   * GET /api/v1/attendance/student/:studentId?fromDate=&toDate=&page=&limit=
   * (Phân trang theo NGÀY theo CONTEXT mục 4).
   */
  async getStudentAttendance(
    studentId: string,
    params: { fromDate: string; toDate: string; page?: number; limit?: number },
  ): Promise<ApiResponse<StudentAttendanceRangeResponse>> {
    return apiClient.get(`/attendance/student/${studentId}`, { params });
  },

  /**
   * Ghi nhận điểm danh.
   * POST /api/v1/attendance
   */
  async markAttendance(payload: MarkAttendancePayload): Promise<ApiResponse<null>> {
    return apiClient.post('/attendance', payload);
  },
};
