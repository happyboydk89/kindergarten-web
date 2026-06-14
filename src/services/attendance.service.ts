import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginationMeta, AttendanceStatus } from '@/types';

export interface StudentAttendanceRecord {
  studentId: string;
  studentCode: string;
  studentName: string;
  attendanceId?: string;
  status: AttendanceStatus;
  teacherNote?: string;
}

export interface ClassAttendanceDay {
  date: string;
  records: StudentAttendanceRecord[];
}

export interface ClassAttendanceResponse {
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

  async markAttendance(payload: MarkAttendancePayload): Promise<ApiResponse<null>> {
    return apiClient.post('/attendance', payload);
  },
};
