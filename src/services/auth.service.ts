import apiClient from '@/lib/api-client';
import type { ApiResponse, UserRole } from '@/types';

export interface AuthUser {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  campusId?: string | null;
  classId?: string | null;
  campusName?: string;
  className?: string;
}

interface LoginPayload {
  phoneNumber: string;
  password: string;
}

interface LoginResponseData {
  user: AuthUser;
}

interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const authService = {
  async login(phoneNumber: string, password: string): Promise<ApiResponse<LoginResponseData>> {
    return apiClient.post('/auth/login', { phoneNumber, password } as LoginPayload);
  },

  async logout(): Promise<ApiResponse<null>> {
    return apiClient.post('/auth/logout');
  },

  async getMe(): Promise<ApiResponse<LoginResponseData>> {
    return apiClient.get('/auth/me');
  },

  async changePassword(
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<ApiResponse<null>> {
    return apiClient.put('/auth/change-password', {
      oldPassword,
      newPassword,
      confirmPassword,
    } as ChangePasswordPayload);
  },
};
