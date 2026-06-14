export type UserRole = 'PRINCIPAL' | 'TEACHER' | 'PARENT' | 'STAFF';

export type StudentStatus = 'STUDYING' | 'RESERVED' | 'GRADUATED';

export type AttendanceStatus = 'PRESENT' | 'ABSENT_PLANNED' | 'ABSENT_UNPLANNED';

export type GradeLevel = 'NHA_TRE' | 'MAM' | 'CHOI' | 'LA';

export type InvoiceStatus = 'UNPAID' | 'PAID';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  PRINCIPAL: 'Hiệu trưởng',
  TEACHER: 'Giáo viên',
  PARENT: 'Phụ huynh',
  STAFF: 'Nhân viên',
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  STUDYING: 'Đang học',
  RESERVED: 'Đã đặt chỗ',
  GRADUATED: 'Tốt nghiệp',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Đi học',
  ABSENT_PLANNED: 'Nghỉ có phép',
  ABSENT_UNPLANNED: 'Nghỉ không phép',
};

export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  NHA_TRE: 'Nhà trẻ',
  MAM: 'Mầm',
  CHOI: 'Chồi',
  LA: 'Lá',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
};

export const USER_ROLES: Array<{ value: UserRole; label: string }> = [
  { value: 'PRINCIPAL', label: 'Hiệu trưởng' },
  { value: 'TEACHER', label: 'Giáo viên' },
  { value: 'PARENT', label: 'Phụ huynh' },
  { value: 'STAFF', label: 'Nhân viên' },
];

export const STUDENT_STATUSES: Array<{ value: StudentStatus; label: string }> = [
  { value: 'STUDYING', label: 'Đang học' },
  { value: 'RESERVED', label: 'Đã đặt chỗ' },
  { value: 'GRADUATED', label: 'Tốt nghiệp' },
];

export const ATTENDANCE_STATUSES: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'PRESENT', label: 'Đi học' },
  { value: 'ABSENT_PLANNED', label: 'Nghỉ có phép' },
  { value: 'ABSENT_UNPLANNED', label: 'Nghỉ không phép' },
];

export const GRADE_LEVELS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'NHA_TRE', label: 'Nhà trẻ' },
  { value: 'MAM', label: 'Mầm' },
  { value: 'CHOI', label: 'Chồi' },
  { value: 'LA', label: 'Lá' },
];

export const INVOICE_STATUSES: Array<{ value: InvoiceStatus; label: string }> = [
  { value: 'UNPAID', label: 'Chưa thanh toán' },
  { value: 'PAID', label: 'Đã thanh toán' },
];
