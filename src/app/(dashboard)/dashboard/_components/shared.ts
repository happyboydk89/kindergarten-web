/**
 * =====================================================================================
 * SHARED CONSTANTS — Dùng chung cho 3 Tab Lớp học / Học sinh / Giáo viên
 * =====================================================================================
 */

import { type GradeLevel, GRADE_LEVEL_LABELS } from '@/types';

/**
 * Mức học phí cứng theo từng khối lớp (đơn vị: VND / tháng).
 * Theo yêu cầu cứng: Lá 3M, Chồi 3.2M, Mầm 3.4M, Nhà trẻ 3.6M.
 *
 * Hiển thị trong Tab "Lớp học" dưới dạng bảng cấu hình cứng (read-only,
 * không gọi API) — phục vụ Hiệu trưởng nắm nhanh biểu phí đang áp dụng.
 */
export const GRADE_LEVEL_FEE: Record<GradeLevel, number> = {
  LA: 3_000_000,
  CHOI: 3_200_000,
  MAM: 3_400_000,
  NHA_TRE: 3_600_000,
};

export const GRADE_LEVELS_ORDERED: GradeLevel[] = ['NHA_TRE', 'MAM', 'CHOI', 'LA'];

export const ACADEMIC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * Gợi ý năm học hiện tại dựa theo tháng.
 * Nếu tháng >= 8 (VN thường bắt đầu năm học tháng 9) thì năm học = yyyy-yyyy+1.
 * Nếu tháng < 8 thì năm học vẫn là (yyyy-1)-yyyy.
 */
export function getSuggestedAcademicYear(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Validate năm học: phải đúng format YYYY-YYYY và năm sau = năm trước + 1.
 */
export function isValidAcademicYear(value: string): boolean {
  if (!ACADEMIC_YEAR_PATTERN.test(value)) return false;
  const [start, end] = value.split('-').map(Number);
  return end === start + 1;
}

export { GRADE_LEVEL_LABELS };
