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

/**
 * Tổng quan điểm danh của 1 campus trong 1 ngày (cho PRINCIPAL/STAFF/TEACHER).
 * Trả về danh sách lớp + sĩ số + số HS có mặt/nghỉ phép/nghỉ KP.
 */
export interface CampusAttendanceOverview {
  campus: { id: number; name: string };
  date: string;
  classes: Array<{
    classId: number;
    className: string;
    gradeLevel: string;
    teacherNames: string[];
    totalStudents: number;
    present: number;
    absentPlanned: number;
    absentUnplanned: number;
    attendanceMarked: boolean;
  }>;
  totals: {
    totalStudents: number;
    present: number;
    absentPlanned: number;
    absentUnplanned: number;
    classesMarked: number;
    totalClasses: number;
  };
}

export interface MarkAttendancePayload {
  classId: string;
  date?: string;
  records: Array<{
    studentId: string;
    date?: string;
    status: AttendanceStatus;
    hasBreakfast?: boolean;
    hasLunch?: boolean;
    teacherNote?: string;
  }>;
}

/**
 * Một record vắng mặt trong danh sách "DS vắng".
 * Trả về từ GET /attendance/absent — đã join sẵn tên HS + lớp + lý do nghỉ.
 */
export interface AbsentListItem {
  attendanceId: number;
  /** YYYY-MM-DD theo giờ VN. */
  date: string;
  status: 'ABSENT_PLANNED' | 'ABSENT_UNPLANNED';
  teacherNote: string | null;
  student: {
    id: number;
    fullName: string;
    classId: number | null;
    className: string | null;
    gradeLevel: string | null;
    campusId: number | null;
  };
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
   * Tổng quan điểm danh của 1 campus trong 1 ngày.
   * GET /api/v1/campuses/:campusId/attendance/overview?date=YYYY-MM-DD
   * - PRINCIPAL/STAFF: thấy tất cả lớp trong campus.
   * - TEACHER: chỉ lớp mình phụ trách.
   * Dùng cho trang /dashboard/attendance overview (nếu cần sau này).
   */
  async getCampusOverview(
    campusId: string,
    date: string,
  ): Promise<ApiResponse<CampusAttendanceOverview>> {
    return apiClient.get(`/campuses/${campusId}/attendance/overview`, {
      params: { date },
    });
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
   * Danh sách điểm danh vắng (ABSENT_PLANNED + ABSENT_UNPLANNED) phân trang.
   * GET /api/v1/attendance/absent?campusId=&status=&fromDate=&toDate=&page=&limit=
   * - PRINCIPAL: thấy mọi HS vắng trong campus (filter `campusId`).
   * - TEACHER: chỉ thấy HS vắng thuộc lớp mình phụ trách.
   * - Sort: date DESC (ngày vắng gần nhất lên đầu), studentId ASC.
   */
  async getAbsentList(params: {
    campusId?: string;
    status?: 'ABSENT_PLANNED' | 'ABSENT_UNPLANNED';
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AbsentListItem[]>> {
    return apiClient.get('/attendance/absent', { params });
  },

  /**
   * Ghi nhận điểm danh hàng loạt cho 1 lớp.
   * POST /api/v1/attendance
   * Body: { classId, date?, records: [{ studentId, status, hasBreakfast?, hasLunch?, teacherNote? }] }
   */
  async markAttendance(payload: MarkAttendancePayload): Promise<ApiResponse<null>> {
    return apiClient.post('/attendance', payload);
  },
};
