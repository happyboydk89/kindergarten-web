
  1. Chuẩn Response & Error (bắt buộc xử lý trước tiên)

  Mọi endpoint đều trả về cùng 1 shape (@utils/response.ts + errorHandler.ts):

  Success (200/201/204):

    { success: true, message: string, data?: T, meta?: { page, limit, total, totalPages } }

  Error (mọi status 4xx/5xx):

    { success: false, message: string, code?: string, details?: unknown }

  - Luôn check response.data.success trước, sau đó dùng message cho toast. KHÔNG dựa vào HTTP status
  duy nhất.
  - Endpoint paginated dùng apiResponse.paginated → kết quả nằm ở data (mảng) + meta (phân trang). Vd:
   GET /attendance/class/:classId, GET /attendance/student/:studentId, GET /students.
  - details (khi validation fail) là Array<{ path: string, message: string }> — map vào field tương
  ứng trên form để highlight lỗi.

  Mã lỗi quan trọng cần switch ở FE:

  ┌────────────────────┬────────┬─────────────────────────────────┬────────────────────────────────┐
  │ code               │ Status │ Ý nghĩa                         │ Hành động gợi ý                │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ VALIDATION_ERROR   │ 422    │ Body/query sai schema           │ Highlight field qua            │
  │                    │        │                                 │ details[].path                 │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ UNAUTHORIZED       │ 401    │ Thiếu/sai token                 │ Redirect về /login             │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ TOKEN_EXPIRED      │ 401    │ Access token hết hạn            │ Auto gọi /auth/refresh rồi     │
  │                    │        │                                 │ retry                          │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ FORBIDDEN          │ 403    │ Không đủ quyền                  │ Ẩn nút + toast "Bạn không có   │
  │                    │        │                                 │ quyền"                         │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ NOT_FOUND          │ 404    │ Record/route không tồn tại      │ Empty state                    │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ DUPLICATE_ENTRY    │ 409    │ Trùng unique (vd: invoice tháng │ Disable nút hoặc hiển thị cảnh │
  │                    │        │ đã tồn tại)                     │ báo                            │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ FK_CONSTRAINT      │ 400    │ Xóa record còn ràng buộc        │ Hiển thị details.field_name    │
  ├────────────────────┼────────┼─────────────────────────────────┼────────────────────────────────┤
  │ INTERNAL_ERROR     │ 500    │ Lỗi server                      │ Toast lỗi chung                │
  └────────────────────┴────────┴─────────────────────────────────┴────────────────────────────────┘

  ───
  2. Authentication & Cookies (cực quan trọng)

  - Login: POST /api/v1/auth/login body { phoneNumber, password }. Server set 2 HttpOnly cookies:
  accessToken + refreshToken (xem @utils/cookie.ts).
  - Mọi request kèm credentials: 'include' (fetch) hoặc withCredentials: true (axios). KHÔNG đọc token
   từ localStorage — cookies là httpOnly.
  - Authorization: Bearer <token> là fallback nếu FE không gửi được cookie (vd app native). Middleware
   ưu tiên Bearer trước, fallback cookie.
  - Auto refresh: Khi nhận TOKEN_EXPIRED → gọi POST /api/v1/auth/refresh (cookie tự gửi) → retry
  request gốc. Set 1 axios interceptor duy nhất.
  - Logout: POST /api/v1/auth/logout xóa cả 2 cookies phía server.
  - Đổi mật khẩu: PUT /api/v1/auth/change-password body { oldPassword, newPassword, confirmPassword }.
   Validate FE: newPassword ≥ 8 ký tự, có chữ hoa, chữ thường, số (đúng regex backend).

  ───
  3. Múi giờ Việt Nam (bắt buộc thống nhất)

  Mọi field date kiểu Date (attendance, dailySchedule, kitchenLog, healthRecord.measuredAt) đều lưu
  theo ngày VN (Asia/Ho_Chi_Minh).

  - Input date từ FE: luôn gửi YYYY-MM-DD (string) khi API yêu cầu (vd: startDate, fromDate, toDate,
  date trong bulk attendance, date trong schedules[]).
  - Input datetime (vd: dateOfBirth trong tạo SV): gửi ISO 8601 đầy đủ (2021-03-12T00:00:00Z) hoặc
  YYYY-MM-DD — backend chấp nhận cả 2.
  - Output date: backend trả về string YYYY-MM-DD cho các trường date (xem formatVnDate trong
  service). KHÔNG parse sang new Date() rồi format lại — sẽ lệch 1 ngày do UTC.
  - Trường DateTime (paidAt, createdAt): trả về ISO 8601 — format trực tiếp bằng new Date() là OK.

  ───
  4. Phân quyền theo Role (ẩn/hiện UI theo req.user.role)

  Lấy role qua GET /api/v1/auth/me sau login. Mapping vai trò:

  ┌───────────────────────────┬───────────┬────────────────┬─────────────────┬─────────────────────┐
  │ Endpoint                  │ PRINCIPAL │ TEACHER        │ STAFF           │ PARENT              │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ POST /schedules/bulk      │ ✓         │ ✗              │ ✗               │ ✗                 │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET /schedules/weekly     │ ✓         │ ✓ (lớp mình)   │ ✗               │ ✓ (lớp có con mình) │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ POST /attendance          │ ✗         │ ✓              │ ✗               │ ✗                   │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET /attendance/class/:id │ ✓         │ ✓ (lớp mình)   │ ✗               │ ✗                   │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET                       │ ✓         │ ✓ (lớp của SV) │ ✗               │ ✓ (con mình)        │
  │ /attendance/student/:id   │           │                │                 │                     │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET /invoices/unpaid      │ ✓         │ ✗              │ ✗               │ ✗                   │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ POST /invoices/generate   │ ✓         │ ✗              │ ✓               │ ✗                   │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ PUT                       │ ✓         │ ✗              │ ✓               │ ✗                   │
  │ /invoices/:id/payment-st… │           │                │                 │                     │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET /students (list all)  │ ✓         │ ✗              │ ✗               │ ✗                   │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ POST/PUT/DELETE           │ ✓         │ ✗              │ ✗               │ ✗                   │
  │ /students/*               │           │                │                 │                     │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET                       │ ✓         │ ✗              │ ✗               │ ✗                   │
  │ /campuses/.../fee-configs │           │                │                 │                     │
  │ (POST)                    │           │                │                 │                     │
  ├───────────────────────────┼───────────┼────────────────┼─────────────────┼─────────────────────┤
  │ GET /kitchen/...          │ ✓         │ ✗              │ ✓ (cùng campus) │ ✗                   │
  └───────────────────────────┴───────────┴────────────────┴─────────────────┴─────────────────────┘

  Quy tắc UI:

  - Ẩn nút/tab theo role. Nhưng vẫn bắt lỗi FORBIDDEN ở response interceptor (đề phòng gọi nhầm).
  - Một số endpoint kiểm tra ownership ở server (vd: PARENT chỉ xem lịch lớp có con mình — 403 nếu
  khác lớp). FE không cần filter trước, nhưng nên ẩn nút để UX mượt hơn.

  ───
  5. Cấu trúc URL & Mount Points (từ app.ts)

    /api/v1/auth                    → auth.routes
    /api/v1/campuses                → campus.routes
    /api/v1/campuses/:campusId      → campusScoped.routes
    /api/v1/campuses/:campusId/fee-configs → feeConfig.routes
    /api/v1/classes                 → class.routes
    /api/v1/students                → student.routes
    /api/v1/students/:studentId/health   → health.routes (nested, public-for-parent)
    /api/v1/students/:studentId/invoices → studentInvoicesRouter (nested)
    /api/v1/attendance              → attendance.routes
    /api/v1/invoices                → invoice.routes
    /api/v1/kitchen                 → kitchen.routes
    /api/v1/teachers                → teacher.routes
    /api/v1/parents                 → parent.routes
    /api/v1/health/class            → healthClass.routes
    /api/v1/schedules               → schedule.routes

  Nested routes quan trọng cần lưu ý:

  - GET /api/v1/students/:studentId/health (mount qua student.routes.ts, không phải /api/v1/health/...
   chính).
  - GET /api/v1/students/:studentId/invoices (cũng mount qua student.routes.ts).

  ───
  6. Enum & Constants cứng (validate FE khớp BE)

  ┌────────────────────────────────────────────────┬───────────────────────────────────────────────┐
  │ Trường                                         │ Giá trị hợp lệ                                │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ UserRole                                       │ 'PRINCIPAL' | 'TEACHER' | 'PARENT' | 'STAFF'  │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ StudentStatus                                  │ 'STUDYING' | 'RESERVED' | 'GRADUATED'         │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ AttendanceStatus                               │ 'PRESENT' | 'ABSENT_PLANNED' |                │
  │                                                │ 'ABSENT_UNPLANNED'                            │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ gradeLevel (Class, FeeConfig, DailySchedule)   │ 'NHA_TRE' | 'MAM' | 'CHOI' | 'LA'             │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ InvoiceStatus                                  │ 'UNPAID' | 'PAID'                             │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ gender (Student)                               │ String — không enum cứng, free text           │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ relationship (ParentStudent)                   │ String — "Bố", "Mẹ", "Ông", "Bà", ...         │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ academicYear (Class)                           │ Format YYYY-YYYY regex (vd: 2025-2026)        │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ month                                          │ 1..12                                         │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ year                                           │ 2000..2100                                    │
  ├────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ status DailySchedule date                      │ YYYY-MM-DD (VN)                               │
  └────────────────────────────────────────────────┴───────────────────────────────────────────────┘

  Khuyến nghị: Tạo file constants.ts ở FE mirror từ schema này để dùng cho <Select>/<Radio>.

  ───
  7. Idempotency & Edge Cases quan trọng

  - POST /api/v1/invoices/generate:
    - SV đã có hóa đơn (UNPAID/PAID) cùng (month, year) → bị skip, không tạo trùng (idempotent).
    - 2 request đồng thời → 1 thắng, 1 nhận 409 DUPLICATE_ENTRY (Prisma P2002).
    - SV chưa xếp lớp → trả về noClassStudentIds[] trong response (không lỗi).
    - Thiếu FeeConfig cho (campusId, gradeLevel) → fail-fast 400, không tạo hóa đơn nào.
    - UX: Disable nút "Generate" sau khi click 1 lần cho cùng tháng, hoặc hiển thị cảnh báo.
  - POST /api/v1/attendance: Dùng upsert theo (studentId, date) → gọi lại sẽ ghi đè, không lỗi 409.
  - POST /api/v1/schedules/bulk: Dùng upsert theo (campusId, gradeLevel, date) → gọi lại ghi đè, không
   lỗi 409. Nhưng nếu gửi 2 entry cùng date trong 1 payload → 400 VALIDATION_ERROR (dedupe ở service).

  ───
  8. Phân trang (Pagination)

  Các endpoint dùng apiResponse.paginated trả về:

    {
      data: T[],
      meta: { page: number, limit: number, total: number, totalPages: number }
    }

  - Query params: page (mặc định 1), limit (mặc định 20, max 100).
  - Áp dụng cho: GET /students, GET /attendance/class/:id, GET /attendance/student/:id.
  - Lưu ý: GET /attendance/class/:id phân trang theo NGÀY (mỗi item = 1 ngày có dữ liệu + danh sách
  bản ghi của ngày đó), không phải theo từng bản ghi attendance.

  ───
  9. CORS

  CORS_ORIGIN mặc định *. Production nên set domain cụ thể. FE cần:

  - Gửi credentials: 'include' (đã nói ở mục 2).
  - Cho phép cookie cross-site nếu FE/BE khác domain (BE có thể set COOKIE_SAME_SITE=lax|none).

  ───
  10. Tài khoản test mẫu (sau khi chạy npx prisma db seed)

  Mật khẩu chung: password123

  ┌──────────────────┬────────────┐
  │ Role             │ SĐT        │
  ├──────────────────┼────────────┤
  │ PRINCIPAL        │ 0900000001 │
  ├──────────────────┼────────────┤
  │ TEACHER (Hoa)    │ 0900000011 │
  ├──────────────────┼────────────┤
  │ TEACHER (Lan)    │ 0900000012 │
  ├──────────────────┼────────────┤
  │ STAFF (Bếp)      │ 0900000020 │
  ├──────────────────┼────────────┤
  │ STAFF (Kế toán)  │ 0900000021 │
  ├──────────────────┼────────────┤
  │ PARENT (Ba)      │ 0910000001 │
  ├──────────────────┼────────────┤
  │ PARENT (Mẹ An)   │ 0910000002 │
  ├──────────────────┼────────────┤
  │ PARENT (Ông nội) │ 0910000003 │
  └──────────────────┴────────────┘

  ───
  11. Những "bẫy" hay gặp (ghi nhớ khi code FE)

  1. Ngày âm lịch vs dương lịch — Hệ thống chỉ dùng dương lịch YYYY-MM-DD (VN).
  2. Date trong JSON — JS new Date("2026-06-13") hiểu là UTC midnight, hiển thị có thể lệch 1 ngày tùy
   timezone máy. Luôn dùng string trực tiếp từ response cho date field.
  3. Pagination total — là tổng số item (ngày / record), không phải tổng số SV. Đọc kỹ comment service
   để hiểu total đếm cái gì.
  4. campusId rỗng — SV STUDYING chưa xếp lớp (classId = null) sẽ không có campusId/gradeLevel → các
  flow liên quan (invoice, schedule) sẽ skip. UX: nhắc nhở Hiệu trưởng xếp lớp trước.
  5. feeConfig chưa cấu hình — POST /invoices/generate sẽ fail 400. FE nên check trước khi cho click.
  6. Token rotation — Refresh token cũ bị revoke khi rotate. Nếu mở nhiều tab cùng login, chỉ tab mới 
  nhất hoạt động — các tab cũ sẽ bị 401 khi refresh.
  7. Soft delete — DELETE /students/:id chuyển status = GRADUATED chứ không xóa cứng. SV đã GRADUATED
  không xuất hiện trong danh sách generate invoice.
  8. bulkMark attendance — Validate toàn bộ records trước khi insert (1 record sai → fail cả batch).
  FE nên validate kỹ trước khi gửi.