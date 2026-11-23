/**
 * HTML của hệ thống cũ -> văn bản thuần, an toàn để hiển thị (không bao giờ chèn HTML vào trang).
 * Dùng DOMParser (tài liệu rời: script không chạy, ảnh không tải), bỏ script/style, giữ xuống dòng theo thẻ khối và <br>.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  let doc: Document
  try { doc = new DOMParser().parseFromString(String(html), 'text/html') } catch { return String(html).replace(/<[^>]*>/g, '') }
  doc.querySelectorAll('script,style,template,noscript').forEach((n) => n.remove())
  doc.querySelectorAll('br').forEach((n) => n.replaceWith(doc.createTextNode('\n')))
  doc.querySelectorAll('li').forEach((n) => n.insertBefore(doc.createTextNode('• '), n.firstChild))
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr,ul,ol,table,blockquote').forEach((n) => n.append(doc.createTextNode('\n')))
  return (doc.body?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
