# KINDERGARTEN CRM - UI DESIGN SYSTEM GUIDELINES

## 1. Nguyên tắc cốt lõi (Core Principles)
- Minimalist & Corporate: Giao diện tối giản, tập trung vào số liệu, không lạm dụng màu sắc sặc sỡ (tránh cảm giác giống app đồ chơi trẻ em, đây là app quản lý cho người lớn).
- Data-Dense but Breathable: Hiển thị dữ liệu lớn một cách gọn gàng, sử dụng khoảng cách (padding/margin) hợp lý để không bị ngộp.
- Luôn có Trạng thái Chờ (Loading States): Mọi thao tác fetch data đều phải có Skeleton hoặc Loading Spinner.
- Chống Double-Click: Vô hiệu hóa (Disable) tất cả các nút submit ngay khi click để chặn gửi trùng data.

## 2. Bảng Màu Thống Nhất (Color Palette - Tailwind)
- Màu chủ đạo (Primary): `slate-900` (Text chính, Sidebar) kết hợp `indigo-600` hoặc `emerald-600` làm điểm nhấn hành động.
- Trạng thái Hóa đơn & Điểm danh (Badges/Status):
  + Thành công / Đã đóng tiền / Đi học: Dùng màu xanh lá (`bg-emerald-50`, `text-emerald-700`, `border-emerald-200`).
  + Cảnh báo / Nghỉ có phép: Dùng màu cam/vàng (`bg-amber-50`, `text-amber-700`, `border-amber-200`).
  + Nguy hiểm / Chưa đóng tiền / Nghỉ không phép: Dùng màu đỏ (`bg-rose-50`, `text-rose-700`, `border-rose-200`).

## 3. Quy tắc Thiết kế Bảng dữ liệu (DataTable)
- Độ cao dòng: Sử dụng kích thước vừa phải (Compact) để hiển thị được nhiều học sinh trên một màn hình mà không cần cuộn quá nhiều.
- Căn lề số liệu: Các cột số thứ tự (STT), Mã SV, Ngày tháng, Số tiền (VND) bắt buộc phải căn phải (`text-right`) hoặc căn giữa để thẳng hàng, dễ so sánh dòng.
- Định dạng tiền tệ: Luôn đi qua hàm helper `formatVND(value)` (Ví dụ: 3.500.000 đ), không hiển thị số thô (3500000).

## 4. Xử lý Trống (Empty State)
- Tuyệt đối không để màn hình trắng trơn khi mảng trả về rỗng `[]`.
- Sử dụng component `<EmptyState />` gồm: 1 icon mờ nhẹ + 1 câu hướng dẫn hành động (Vd: "Chưa có hóa đơn nào được tạo trong tháng này. Bấm 'Tạo hóa đơn' để bắt đầu.").

## 5. Cấu trúc dự án
web/
├── src/
│   ├── app/                  # Next.js App Router (Pages & Layouts)
│   │   ├── (auth)/           # Route group cho Login, Quên mật khẩu
│   │   ├── (dashboard)/      # Route group cho Admin/Principal/Teacher/Staff
│   │   └── (parent)/         # Route group giao diện tối giản cho Phụ huynh
│   ├── components/           # UI Components dùng chung (Button, Table, Form...)
│   │   ├── ui/               # shadcn/ui components tự động sinh ra ở đây
│   │   └── shared/           # Sidebar, Navbar, StatCard, DataTable chung
│   ├── config/               # Định nghĩa các hằng số, menu sidebar theo role
│   ├── hooks/                # Custom hooks (useAuth, useAttendance...)
│   ├── lib/                  # Axios instance, utils format date Việt Nam
│   ├── services/             # Lớp gọi API (auth.service, student.service...)
│   └── types/                # Mirror lại toàn bộ Type/Enum từ Backend