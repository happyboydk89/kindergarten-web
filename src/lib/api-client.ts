import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, ValidationDetail } from '@/types';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const devToken = process.env.NEXT_PUBLIC_DEV_TOKEN;
  if (devToken && config.headers) {
    config.headers.Authorization = `Bearer ${devToken}`;
  }
  return config;
});

interface QueueItem {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  config: InternalAxiosRequestConfig & { _retry?: boolean };
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: unknown = null) {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      resolve(apiClient(config));
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response.data,

  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });

        apiClient
          .post('/auth/refresh')
          .then(() => {
            isRefreshing = false;
            processQueue(null);
          })
          .catch((refreshError) => {
            isRefreshing = false;
            processQueue(refreshError);
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login?expired=1';
            }
          });
      });
    }

    if (status === 401 && code === 'UNAUTHORIZED') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
      return Promise.reject(error.response?.data);
    }

    if (status === 403) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('app:toast', {
            detail: {
              type: 'error',
              message: error.response?.data?.message ?? 'Bạn không có quyền thực hiện hành động này',
            },
          }),
        );
      }
      return Promise.reject(error.response?.data);
    }

    if (status === 422) {
      const details: ValidationDetail[] = error.response?.data?.details ?? [];
      const fieldErrors: Record<string, string> = {};
      details.forEach((d) => {
        if (d.path) {
          fieldErrors[d.path] = d.message;
        }
      });
      return Promise.reject({
        ...error.response?.data,
        details,
        fieldErrors,
      });
    }

    return Promise.reject(error.response?.data ?? { success: false, message: 'Lỗi không xác định' });
  },
);

export default apiClient;
