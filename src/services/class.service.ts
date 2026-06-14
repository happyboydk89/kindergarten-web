import apiClient from '@/lib/api-client';
import type { ApiResponse, GradeLevel } from '@/types';

export interface ClassInfo {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  campusId: string;
  campusName?: string;
  academicYear?: string;
}

export const classService = {
  async list(params?: {
    campusId?: string;
    gradeLevel?: GradeLevel;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ClassInfo[]>> {
    return apiClient.get('/classes', { params });
  },
};
