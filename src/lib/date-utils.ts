/**
 * =====================================================================================
 * DATE UTILS — Xử lý chuỗi ngày `YYYY-MM-DD` theo múi giờ Việt Nam (VN)
 * =====================================================================================
 *
 * QUY TẮC CỨNG (CONTEXT_BACKEND.md mục 3):
 *   - KHÔNG dùng `new Date('2026-06-13')` rồi format lại — sẽ bị lệch 1 ngày do
 *     JS hiểu là UTC midnight, máy client ở timezone khác sẽ hiển thị sai.
 *   - Mọi date field đi từ BE đều là string `YYYY-MM-DD` (đã format theo VN).
 *   - Khi cần tính toán ngày: parse string YYYY-MM-DD thành 3 số
 *     [year, month, day] rồi dùng `new Date(y, m-1, d)` (local time, không UTC).
 *
 * Toàn bộ helper trong file này TUÂN THỦ quy tắc trên.
 * =====================================================================================
 */

/** Tên các ngày trong tuần theo tiếng Việt (T2..T6 cho tuần làm việc). */
export const WEEKDAY_LABELS_VN = [
  { iso: 1, short: 'T2', full: 'Thứ 2' },
  { iso: 2, short: 'T3', full: 'Thứ 3' },
  { iso: 3, short: 'T4', full: 'Thứ 4' },
  { iso: 4, short: 'T5', full: 'Thứ 5' },
  { iso: 5, short: 'T6', full: 'Thứ 6' },
  { iso: 6, short: 'T7', full: 'Thứ 7' },
  { iso: 7, short: 'CN', full: 'Chủ nhật' },
] as const;

/** Tên các tháng tiếng Việt. */
export const MONTH_LABELS_VN = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
] as const;

/** Validate 1 chuỗi có đúng format `YYYY-MM-DD` không. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  // Dùng Date constructor an toàn (local) để check ngày hợp lệ
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

/** Lấy năm, tháng, ngày từ chuỗi `YYYY-MM-DD` (KHÔNG dùng `new Date(s)`). */
export function parseISODate(value: string): { year: number; month: number; day: number } {
  if (!isValidISODate(value)) {
    throw new Error(`Invalid ISO date string: ${value}`);
  }
  const [y, m, d] = value.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** Format lại date thành `YYYY-MM-DD` (dùng local time, an toàn với mọi timezone). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Lấy ngày hôm nay theo timezone Việt Nam, trả về `YYYY-MM-DD`. */
export function getVietnamToday(): string {
  const now = new Date();
  // Chuyển sang giờ VN rồi lấy ngày
  const vnString = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vn = new Date(vnString);
  return toISODate(vn);
}

/** Cộng/trừ N ngày vào chuỗi `YYYY-MM-DD`, trả về `YYYY-MM-DD`. */
export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseISODate(iso);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Lấy ISO weekday (1 = T2 ... 7 = CN) của 1 chuỗi `YYYY-MM-DD`. */
export function getISODayOfWeek(iso: string): number {
  const { year, month, day } = parseISODate(iso);
  const d = new Date(year, month - 1, day);
  // JS getDay(): 0=CN, 1=T2, ..., 6=T7. Quy đổi sang ISO 1..7
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Trả về ngày thứ 2 của tuần chứa ngày `iso` (định dạng `YYYY-MM-DD`). */
export function startOfWeek(iso: string): string {
  const dow = getISODayOfWeek(iso); // 1..7
  return addDays(iso, -(dow - 1));
}

/** Trả về mảng 7 ngày của tuần bắt đầu từ `weekStartISO` (T2..CN). */
export function getWeekDates(weekStartISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));
}

/** So sánh 2 chuỗi `YYYY-MM-DD` theo thứ tự thời gian. Trả về -1 | 0 | 1. */
export function compareISODate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lấy chuỗi tháng hiện tại theo VN, dạng `YYYY-MM` (vd: "2026-06"). */
export function getCurrentMonthISO(): string {
  const today = getVietnamToday();
  return today.slice(0, 7);
}

/** Lấy danh sách các ngày trong 1 tháng `YYYY-MM`, trả về mảng `YYYY-MM-DD`. */
export function getDatesInMonth(monthISO: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(monthISO)) {
    throw new Error(`Invalid month ISO: ${monthISO}`);
  }
  const [y, m] = monthISO.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // m-1 + 1 tháng = tháng `m`, ngày 0 = ngày cuối tháng trước; trick này cho ra ngày cuối của tháng `m`
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }
  return dates;
}

/**
 * Format 1 chuỗi `YYYY-MM-DD` thành dạng hiển thị `dd/MM/yyyy` (KHÔNG qua `new Date`
 * để tránh lệch ngày).
 */
export function formatVNDate(iso: string): string {
  const { year, month, day } = parseISODate(iso);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** Tính số ngày giữa 2 chuỗi `YYYY-MM-DD` (b - a). */
export function diffDays(aISO: string, bISO: string): number {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  const ms = new Date(b.year, b.month - 1, b.day).getTime()
           - new Date(a.year, a.month - 1, a.day).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
