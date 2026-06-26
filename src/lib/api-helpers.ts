/**
 * Helpers để hiển thị thông báo lỗi từ `apiClient` (đã qua interceptor).
 *
 * Vấn đề: khi BE trả 422 (validation error), axios interceptor `reject` với plain object
 * `{success, message, code, details, fieldErrors}` — KHÔNG phải Error instance. Nên
 * `err instanceof Error` trả false → fallback message chung chung, mất thông tin chi tiết
 * (vd "name: Tên món quá dài", "dishId: Required").
 *
 * 422 payload shape:
 *   {
 *     success: false,
 *     message: "Validation failed",
 *     code: "VALIDATION_ERROR",
 *     details: [{ path: "days.0.date", message: "date must be YYYY-MM-DD" }, ...],
 *     fieldErrors: { "days.0.date": "date must be YYYY-MM-DD", ... }
 *   }
 *
 * 4xx/5xx khác:
 *   { success: false, message: "...", code: "NOT_FOUND" | "FORBIDDEN" | ... }
 *
 * Network error: `Error` instance bình thường.
 */
export function extractApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string;
      details?: Array<{ path?: string; message?: string }>;
      fieldErrors?: Record<string, string>;
    };
    if (e.message && typeof e.message === 'string') {
      const detailParts: string[] = [];

      if (e.details && e.details.length > 0) {
        for (const d of e.details) {
          if (d.path && d.message) detailParts.push(`${d.path}: ${d.message}`);
          else if (d.message) detailParts.push(d.message);
        }
      }

      if (!detailParts.length && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        for (const [k, v] of Object.entries(e.fieldErrors)) {
          detailParts.push(`${k}: ${v}`);
        }
      }

      if (detailParts.length > 0) {
        return `${e.message} — ${detailParts.join('; ')}`;
      }
      return e.message;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
