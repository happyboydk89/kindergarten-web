import apiClient from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export interface StudentBrief {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  classId?: string | null;
  campusId?: string | null;
  status: string;
}

export const studentService = {
  async list(params?: {
    classId?: string;
    campusId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<StudentBrief[]>> {
    return apiClient.get('/students', { params });
  },
};
