import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginationMeta } from '@/types';

/**
 * Một khoản chi tiêu nội bộ của cơ sở (tiền mặt).
 * Dùng cho sổ nhật ký chi tiêu: tiền đi chợ, mua đồ ăn sáng, sửa vòi nước, v.v.
 *
 * Theo CONTEXT_BACKEND.md mục 3: `date` luôn là chuỗi `YYYY-MM-DD` (VN).
 *
 * Endpoint BE dự kiến:
 *   GET    /api/v1/expenses?campusId=&month=&year=
 *   POST   /api/v1/expenses
 *   DELETE /api/v1/expenses/:id
 */
export interface Expense {
  id: string;
  campusId: string;
  /** Nội dung khoản chi (vd: "Tiền đi chợ mua rau"). */
  description: string;
  /** Số tiền chi (VND). */
  amount: number;
  /** Ngày chi (YYYY-MM-DD theo giờ VN). */
  date: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Response phân trang khi GET /expenses.
 * Theo CONTEXT mục 8: BE dùng shape `{ data: T[], meta: { page, limit, total, totalPages } }`.
 */
export interface ExpenseListResponse {
  data: Expense[];
  meta: PaginationMeta;
}

export interface CreateExpensePayload {
  campusId: string;
  description: string;
  amount: number;
  /** YYYY-MM-DD (VN) */
  date: string;
}

export const expenseService = {
  /**
   * Lấy danh sách khoản chi theo campus + tháng/năm.
   * GET /api/v1/expenses?campusId=&month=&year=
   *
   * `month`/`year` optional: nếu bỏ trống BE sẽ trả tất cả các khoản của campus.
   */
  async list(params: {
    campusId: string;
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ExpenseListResponse>> {
    return apiClient.get('/expenses', { params });
  },

  /**
   * Ghi nhận 1 khoản chi mới.
   * POST /api/v1/expenses
   */
  async create(payload: CreateExpensePayload): Promise<ApiResponse<Expense>> {
    return apiClient.post('/expenses', payload);
  },

  /**
   * Xoá 1 khoản chi.
   * DELETE /api/v1/expenses/:id
   */
  async remove(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/expenses/${id}`);
  },
};
