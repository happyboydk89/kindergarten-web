import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginationMeta, InvoiceStatus } from '@/types';

/**
 * Một dòng hóa đơn trả về từ Backend.
 *
 * Các trường `parentPhone` / `parentName` có thể được BE include trực tiếp
 * trong payload hóa đơn (tiết kiệm request), HOẶC FE sẽ phải lookup qua
 * /parents endpoint. Ở đây ta khai báo optional để chấp nhận cả 2 cách.
 */
export interface InvoiceItem {
  id: string;
  invoiceCode?: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  className?: string;
  classId?: string;
  campusId?: string;
  totalAmount: number;
  month: number;
  year: number;
  status: InvoiceStatus;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
  /** SĐT phụ huynh (nếu BE include). */
  parentPhone?: string;
  /** Tên phụ huynh (nếu BE include). */
  parentName?: string;
}

export interface InvoiceListResponse {
  data: InvoiceItem[];
  meta: PaginationMeta;
}

export interface InvoiceStats {
  total: number;
  paid: number;
  unpaid: number;
}

export interface GenerateInvoiceResponse {
  generatedCount: number;
  skippedCount: number;
  noClassStudentIds: string[];
  errors?: Array<{ studentId: string; reason: string }>;
}

/**
 * Phụ huynh của 1 học sinh (dùng để lookup SĐT nếu invoice không include sẵn).
 */
export interface ParentContact {
  id: string;
  fullName: string;
  phoneNumber: string;
  relationship?: string;
}

export const invoiceService = {
  /**
   * Lấy danh sách hóa đơn có filter (status, month, year, campusId) và phân trang.
   * GET /api/v1/invoices?campusId=&status=&month=&year=&page=&limit=
   *
   * - `campusId` (optional): lọc theo cơ sở.
   *   Truyền campusId để data chỉ thuộc về campus đang chọn ở Header.
   */
  async list(params?: {
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
    campusId?: string;
  }): Promise<ApiResponse<InvoiceListResponse>> {
    return apiClient.get('/invoices', { params });
  },

  /**
   * Legacy alias cho code cũ — trả về raw array (không có meta).
   * Endpoint BE hiện tại (sau refactor) đều trả paginated wrapper,
   * nên alias này giờ trả về `{ data: InvoiceItem[], meta: ... }` luôn.
   */
  async listPaginated(params?: {
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
    campusId?: string;
  }): Promise<ApiResponse<InvoiceListResponse>> {
    return apiClient.get('/invoices', { params });
  },

  /**
   * Sinh hóa đơn hàng loạt cho 1 tháng.
   * POST /api/v1/invoices/generate
   * Body: { month, year, campusId? }
   * - `campusId` (optional): nếu truyền → chỉ tạo cho SV của campus đó.
   *   Nếu KHÔNG truyền → tạo cho toàn trường (giữ tương thích cũ).
   */
  async generate(
    month: number,
    year: number,
    options: { campusId?: string } = {},
  ): Promise<ApiResponse<GenerateInvoiceResponse>> {
    return apiClient.post('/invoices/generate', { month, year, ...options });
  },

  /**
   * Cập nhật trạng thái thanh toán (PAID).
   * PUT /api/v1/invoices/:id/payment-status
   */
  async updatePaymentStatus(invoiceId: string): Promise<ApiResponse<InvoiceItem>> {
    return apiClient.put(`/invoices/${invoiceId}/payment-status`);
  },

  /**
   * Lấy danh sách hóa đơn UNPAID của tháng/năm.
   * GET /api/v1/invoices/unpaid?campusId=&month=&year=
   * - `campusId` (optional): lọc theo cơ sở.
   */
  async listUnpaid(params?: {
    month?: number;
    year?: number;
    campusId?: string;
  }): Promise<ApiResponse<{
    filter: { month: number; year: number; campusId?: number };
    totalUnpaidCount: number;
    totalUnpaidAmount: number;
    invoices: InvoiceItem[];
  }>> {
    return apiClient.get('/invoices/unpaid', { params });
  },

  /**
   * Lấy danh sách phụ huynh của 1 học sinh (dùng khi invoice không include parent phone).
   * GET /api/v1/parents?studentId=...
   */
  async getParentsByStudent(studentId: string): Promise<ApiResponse<ParentContact[]>> {
    return apiClient.get('/parents', { params: { studentId } });
  },
};
