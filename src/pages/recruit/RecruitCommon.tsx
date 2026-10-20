/** Khung xem CV (PDF) cùng nguồn gốc: cookie phiên tự gửi kèm. Ẩn thanh công cụ tải / in cho người ngoài HR (chỉ hạn chế giao diện, quyền thật do máy chủ kiểm). */
export function CvViewer({ src, hideTools, height = '70vh' }: { src: string; hideTools?: boolean; height?: string }) {
  return <iframe title="cv" src={hideTools ? `${src}#toolbar=0&navpanes=0` : src} style={{ width: '100%', height, border: '1px solid var(--border, #d9d9d9)', borderRadius: 8 }} />
}
