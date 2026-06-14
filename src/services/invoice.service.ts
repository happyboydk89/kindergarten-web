import apiClient from '@/lib/api-client';
import type { ApiResponse, PaginationMeta, InvoiceStatus } from '@/types';

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

export const invoiceService = {
  async list(params?: {
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
  }): Promise<ApiResponse<InvoiceItem[]>> {
    return apiClient.get('/invoices', { params });
  },

  async generate(month: number, year: number): Promise<ApiResponse<GenerateInvoiceResponse>> {
    return apiClient.post('/invoices/generate', { month, year });
  },

  async updatePaymentStatus(invoiceId: string): Promise<ApiResponse<InvoiceItem>> {
    return apiClient.put(`/invoices/${invoiceId}/payment-status`);
  },
};
