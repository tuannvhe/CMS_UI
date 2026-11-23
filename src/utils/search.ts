import { isValidElement, type ReactNode } from 'react'

/**
 * Bỏ dấu tiếng Việt + chữ thường để so khớp: "Nguyễn Đức" → "nguyen duc".
 * Gõ có dấu hay không dấu đều ra cùng kết quả ("nguyễn" tìm được "Nguyen" và ngược lại).
 */
export const foldText = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()

/** `haystack` có chứa `needle` không, không phân biệt hoa thường / dấu. Ô tìm rỗng = khớp hết. */
export function matchText(needle: string | null | undefined, ...haystack: unknown[]): boolean {
  const n = foldText(needle).trim()
  if (!n) return true
  return foldText(haystack.filter((x) => x != null && x !== '').join(' ')).includes(n)
}

/** Lấy chữ thuần từ label / children của option (chuỗi, số, mảng hoặc phần tử React lồng nhau). */
export function nodeText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children)
  return ''
}

/**
 * filterOption cho Select / AutoComplete có showSearch: như mặc định của antd (so theo `prop`)
 * nhưng không phân biệt dấu. Mặc định so cả label lẫn value.
 *   <Select showSearch filterOption={foldFilter('label')} ... />
 */
export function foldFilter(prop: string | string[] = ['label', 'value']) {
  const props = Array.isArray(prop) ? prop : [prop]
  return (input: string, option?: object): boolean => {
    if (!option) return false
    const o = option as Record<string, unknown>
    return matchText(input, ...props.map((p) => nodeText(o[p])))
  }
}
