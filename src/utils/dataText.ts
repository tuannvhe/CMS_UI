import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { dataTranslations } from '../api/dataTranslations'

/**
 * Từ điển dịch dữ liệu danh mục (Tbl_DataTranslations): tên bộ phận / part / chức vụ / line lưu tiếng Việt trong CSDL
 * → tiếng Anh / tiếng Hàn theo ngôn ngữ đang chọn. Chỉ dùng khi HIỂN THỊ; lọc / so sánh / xuất Excel vẫn dùng chữ gốc.
 */
let dict: Record<string, string> = {}
let dictLang = 'vi'
let version = 0
let loading: string | null = null
const listeners = new Set<() => void>()

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
const baseLang = (l?: string) => (l ?? 'vi').slice(0, 2).toLowerCase()

/** Dịch một giá trị dữ liệu; tiếng Việt hoặc chưa có trong từ điển thì trả nguyên văn. */
export function trData<T extends string | null | undefined>(value: T): T | string {
  if (!value || dictLang === 'vi') return value
  return dict[norm(value)] ?? value
}

function publish() { version++; listeners.forEach((l) => l()) }

/** Tải từ điển cho ngôn ngữ lang (en | ko); vi = xoá. Gọi lại sau khi HR sửa từ điển. */
export async function loadDataDictionary(lang: string, force = false) {
  const l = baseLang(lang)
  if (l !== 'en' && l !== 'ko') { if (dictLang !== 'vi') { dict = {}; dictLang = 'vi'; publish() } return }
  if (!force && (dictLang === l || loading === l)) return
  loading = l
  try {
    const map = await dataTranslations.dictionary(l)
    if (loading !== l) return   // đã đổi sang ngôn ngữ khác trong lúc tải
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(map ?? {})) if (v) next[norm(k)] = v
    dict = next
    dictLang = l
    publish()
  } catch {
    // không tải được (chưa tạo bảng / mất mạng): giữ chữ gốc
  } finally {
    if (loading === l) loading = null
  }
}

/** Tải lại từ điển của ngôn ngữ đang dùng (sau khi sửa ở màn Dịch dữ liệu). */
export function refreshDataDictionary() { if (dictLang !== 'vi') void loadDataDictionary(dictLang, true) }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => version

/** Số phiên bản từ điển (tăng mỗi lần tải xong) để component tự vẽ lại / tính lại cột. */
export function useDataDictVersion() { return useSyncExternalStore(subscribe, snapshot, snapshot) }

/** Tên trường dữ liệu (dataIndex) của bảng được tự dịch khi cột không có render riêng. */
export const DATA_TEXT_FIELDS = new Set(['department', 'departmentName', 'dept', 'deptName', 'position', 'positionName', 'part', 'partName', 'lineName', 'unitName', 'team', 'teamName'])

/** Hàm dịch dữ liệu cho component: vẽ lại khi từ điển tải xong. */
export function useTrData() {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  return trData
}

/** Đặt một lần trong khung ứng dụng (sau đăng nhập): tải từ điển mỗi khi đổi ngôn ngữ. */
export function useDataDictionaryLoader(enabled: boolean) {
  const { i18n } = useTranslation()
  useEffect(() => { if (enabled) void loadDataDictionary(i18n.language) }, [enabled, i18n.language])
}
