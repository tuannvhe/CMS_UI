/**
 * Tên trong hệ thống đang IN HOA: hiện dạng hoa đầu chữ cho dễ đọc ("NGUYỄN HẢI TRIỀU" → "Nguyễn Hải Triều");
 * phần sau dấu _ (vd. _V2) giữ nguyên.
 */
export const niceName = (s: string) => s.trim().split(/\s+/).map((w) => {
  const [head, ...rest] = w.split('_')
  const lw = head.toLocaleLowerCase('vi')
  return [lw.charAt(0).toLocaleUpperCase('vi') + lw.slice(1), ...rest].join('_')
}).join(' ')
