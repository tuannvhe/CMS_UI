import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { landingFor } from '../config/landing.i18n'

/** Nội dung trang chủ landing theo ngôn ngữ đang chọn (đổi ngôn ngữ là đổi theo, không cần tải lại trang). */
export function useLanding() {
  const { i18n } = useTranslation()
  return useMemo(() => landingFor(i18n.language), [i18n.language])
}
