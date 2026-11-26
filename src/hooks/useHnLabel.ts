import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/* 2026-11-24 [Truong] - HN: label of a source column (hn.col.*), shared by the timework list and the timework sheet */
/** Nhãn cột của nguồn HN theo ngôn ngữ đang chọn; khoá có dấu chấm giữ nguyên. */
export function useHnLabel() {
  const { t } = useTranslation()
  return useCallback((k: string) => (k.includes('.') ? k : t(`hn.col.${k.toLowerCase()}`, { defaultValue: k })), [t])
}
