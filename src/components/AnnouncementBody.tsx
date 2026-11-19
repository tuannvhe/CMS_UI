import type { CSSProperties } from 'react'
import { ExportOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

// Dấu tệp HTML đính kèm trong nội dung thông báo (máy chủ chỉ giữ thuộc tính này khi mã đúng 32 ký tự hex)
const MARK = /<div data-html-page="([0-9a-f]{32})"><\/div>/g

/** Đường dẫn phát tệp HTML đính kèm thông báo. */
export const htmlPageUrl = (key: string) => `/api/announcements/page/${key}`

/** Tách nội dung thông báo thành phần soạn bằng trình soạn và mã tệp HTML đính kèm (nếu có). */
export function splitHtmlPage(html: string): { rest: string; page: string | null } {
  let page: string | null = null
  const rest = (html ?? '').replace(MARK, (_m, k: string) => { page ??= k; return '' })
  return { rest, page }
}

/** Ghép lại để lưu: dấu tệp HTML luôn ở cuối nội dung. */
export const joinHtmlPage = (rest: string, page: string | null) => (page ? `${rest}<div data-html-page="${page}"></div>` : rest)

/**
 * Tệp HTML đính kèm hiện trong iframe sandbox (không allow-scripts, không allow-same-origin): không chạy script, không đọc được phiên đăng nhập.
 * Máy chủ còn phát tệp kèm CSP sandbox nên mở thẳng ở tab mới cũng an toàn.
 */
export function HtmlPageFrame({ pageKey, height = 420 }: { pageKey: string; height?: number | string }) {
  const { t } = useTranslation()
  const url = htmlPageUrl(pageKey)
  return (
    <div className="hn-page">
      <iframe src={url} title={t('ann.htmlFile')} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" loading="lazy" style={{ height }} />
      <a className="hn-page-open" href={url} target="_blank" rel="noopener noreferrer"><ExportOutlined /> {t('ann.htmlOpen')}</a>
    </div>
  )
}

/** Nội dung thông báo: phần HTML đã được máy chủ lọc, rồi tệp HTML đính kèm (nếu có). */
export function AnnouncementBody({ html, frameHeight, style }: { html: string; frameHeight?: number | string; style?: CSSProperties }) {
  const { rest, page } = splitHtmlPage(html)
  return (
    <>
      {/* html đã được máy chủ lọc (thẻ định dạng cơ bản, không script / sự kiện) */}
      {(rest.trim() || !page) && <div className="hn-body" style={style} dangerouslySetInnerHTML={{ __html: rest }} />}
      {page && <HtmlPageFrame pageKey={page} height={frameHeight} />}
    </>
  )
}
