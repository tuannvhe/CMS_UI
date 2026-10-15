/**
 * Tạm ẩn mọi giao diện lưu lương từng người (màn "Lương từng người", nút lưu từ file tính lương, gợi ý cập nhật từ phiếu lương).
 * Mã phía máy chủ vẫn giữ nguyên: OP có thể lưu lương, Staff không lưu (bắt buộc nhập ở cột Excel mỗi tháng). Bật lại khi cần.
 */
export const PERSON_PAY_UI = false

/** Đồng bộ lương OP: nút lưu từ file tính lương và gợi ý cập nhật từ phiếu lương (chỉ cho nhóm OP). */
export const PERSON_PAY_SYNC = true

/**
 * Màn Chốt công tự động: false = chỉ tổng hợp, sửa và xuất file Excel (rồi tải file đó lên màn Tính lương). true = thêm nút Tính lương ngay,
 * Khóa tháng (ghi vào bảng chốt công), nhập khoản riêng của tháng và ghi đè dòng lương trong màn sửa.
 */
export const CLOSING_AUTO_DIRECT = false
