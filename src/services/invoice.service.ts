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
   * Lấy danh sách hóa đơn có filter (status, month, year) và phân trang.
   * GET /api/v1/invoices?status=&month=&year=&page=&limit=
   */
  async list(params?: {
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
  }): Promise<ApiResponse<InvoiceItem[]>> {
    return apiClient.get('/invoices', { params });
  },

  /**
   * Lấy danh sách hóa đơn có phân trang đầy đủ (khi BE trả `{data, meta}`).
   * GET /api/v1/invoices?status=&month=&year=&page=&limit=
   */
  async listPaginated(params?: {
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
  }): Promise<ApiResponse<InvoiceListResponse>> {
    return apiClient.get('/invoices', { params });
  },

  /**
   * Sinh hóa đơn hàng loạt cho 1 tháng.
   * POST /api/v1/invoices/generate
   */
  async generate(month: number, year: number): Promise<ApiResponse<GenerateInvoiceResponse>> {
    return apiClient.post('/invoices/generate', { month, year });
  },

  /**
   * Cập nhật trạng thái thanh toán (PAID).
   * PUT /api/v1/invoices/:id/payment-status
   */
  async updatePaymentStatus(invoiceId: string): Promise<ApiResponse<InvoiceItem>> {
    return apiClient.put(`/invoices/${invoiceId}/payment-status`);
  },

  /**
   * Lấy danh sách phụ huynh của 1 học sinh (dùng khi invoice không include parent phone).
   * GET /api/v1/parents?studentId=...
   *
   * Theo CONTEXT mục 5: có route /api/v1/parents — chi tiết query tùy BE.
   */
  async getParentsByStudent(studentId: string): Promise<ApiResponse<ParentContact[]>> {
    return apiClient.get('/parents', { params: { studentId } });
  },
};
