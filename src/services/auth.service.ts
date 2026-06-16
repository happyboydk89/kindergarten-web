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
  rememberMe?: boolean;
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
  /**
   * Đăng nhập. Nếu `rememberMe=true` → BE set cookie refresh 30 ngày (mặc định 7d).
   * Access token luôn short-lived (15m) — FE tự gọi `/auth/refresh` khi cần.
   */
  async login(
    phoneNumber: string,
    password: string,
    rememberMe = false,
  ): Promise<ApiResponse<LoginResponseData>> {
    return apiClient.post('/auth/login', {
      phoneNumber,
      password,
      rememberMe,
    } as LoginPayload);
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
