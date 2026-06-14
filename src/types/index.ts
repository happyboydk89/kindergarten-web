export type {
  UserRole,
  StudentStatus,
  AttendanceStatus,
  GradeLevel,
  InvoiceStatus,
} from './constants';

export {
  USER_ROLE_LABELS,
  STUDENT_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
  GRADE_LEVEL_LABELS,
  INVOICE_STATUS_LABELS,
  USER_ROLES,
  STUDENT_STATUSES,
  ATTENDANCE_STATUSES,
  GRADE_LEVELS,
  INVOICE_STATUSES,
} from './constants';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_ENTRY'
  | 'FK_CONSTRAINT'
  | 'INTERNAL_ERROR';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  details?: ValidationDetail[];
  code?: ApiErrorCode;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ValidationDetail {
  path: string;
  message: string;
}
