import { useState } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '../theme/ThemeProvider'
import { badgeOf, greetingOf } from '../theme/occasions'

/** Lời chúc của dịp lễ đang diễn ra (đầu trang chủ); bấm × để ẩn trong phiên này. */
export function OccasionBanner() {
  const { t, i18n } = useTranslation()
  const { occasion } = useThemeMode()
  const [hidden, setHidden] = useState<string | null>(() => { try { return sessionStorage.getItem('cmsvn_occ_hidden') } catch { return null } })
  if (!occasion || hidden === occasion.key) return null
  const badge = badgeOf(occasion)
  const g = greetingOf(occasion, i18n.language, t, new Date().getFullYear())
  return (
    <section className="occ-banner" role="note">
      {badge ? <span className="occ-badge">{badge}</span> : <span className="occ-emoji">{occasion.emoji[0]}</span>}
      <div className="occ-text">
        <b>{g.title}</b>
        {g.sub && <span>{g.sub}</span>}
      </div>
      <span className="occ-emoji r">{occasion.emoji[1] ?? occasion.emoji[0]}</span>
      <button type="button" className="occ-x" aria-label={t('req.cancel')} onClick={() => { setHidden(occasion.key); try { sessionStorage.setItem('cmsvn_occ_hidden', occasion.key) } catch { /* bỏ qua */ } }}><CloseOutlined /></button>
    </section>
  )
}
