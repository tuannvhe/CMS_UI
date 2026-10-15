/**
 * Gộp lựa chọn của một danh sách đang bị lọc vào lựa chọn tổng.
 * Checkbox.Group chỉ trả về các ô đang hiển thị, nên phải giữ lại những người đã chọn nhưng đang bị lọc ẩn.
 * @param all     toàn bộ mã đã chọn trước thao tác
 * @param visible mã của các dòng đang hiển thị (sau khi lọc)
 * @param chosen  mã được chọn trong các dòng đang hiển thị (giá trị mới của Checkbox.Group)
 */
export function mergeVisible(all: string[], visible: string[], chosen: string[]): string[] {
  const shown = new Set(visible)
  return [...all.filter((id) => !shown.has(id)), ...chosen]
}
