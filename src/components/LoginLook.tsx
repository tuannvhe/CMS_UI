import { useEffect, useState } from 'react'
import { Popover, Segmented, Switch } from 'antd'
import { BgColorsOutlined, CheckOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '../theme/ThemeProvider'
import { PALETTES, type PaletteKey } from '../theme/tokens'
import { occasionByKey, occasionName, occasionOn } from '../theme/occasions'

export type LoginBg = 'brand' | 'soft' | 'mesh'
export type LoginLayout = 'center' | 'left' | 'right'
const BG_KEY = 'cmsvn_login_bg', LAYOUT_KEY = 'cmsvn_login_layout'
const BGS: LoginBg[] = ['brand', 'soft', 'mesh']
const LAYOUTS: LoginLayout[] = ['center', 'left', 'right']

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key); if (v && (allowed as readonly string[]).includes(v)) return v as T } catch { /* bỏ qua */ }
  return fallback
}

/** Kiểu nền và bố cục màn đăng nhập, nhớ theo từng máy (cùng cách lưu như chế độ sáng / tối). */
export function useLoginLook() {
  const [bg, setBg] = useState<LoginBg>(() => read(BG_KEY, BGS, 'brand'))
  const [layout, setLayout] = useState<LoginLayout>(() => read(LAYOUT_KEY, LAYOUTS, 'center'))
  useEffect(() => { try { localStorage.setItem(BG_KEY, bg) } catch { /* bỏ qua */ } }, [bg])
  useEffect(() => { try { localStorage.setItem(LAYOUT_KEY, layout) } catch { /* bỏ qua */ } }, [layout])
  return { bg, setBg, layout, setLayout }
}

/** Nút tuỳ chỉnh giao diện ở màn đăng nhập: sáng / tối, màu chủ đạo, kiểu nền, bố cục. */
export function LoginLook({ bg, setBg, layout, setLayout }: ReturnType<typeof useLoginLook>) {
  const { t } = useTranslation()
  const { mode, toggle, palette, setPalette } = useThemeMode()
  const [open, setOpen] = useState(false)
  const content = (
    <div className="ll-panel">
      <div className="ll-row">
        <span>{t('settings.theme')}</span>
        <Switch checked={mode === 'dark'} onChange={toggle} checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} aria-label={t('settings.theme')} />
      </div>
      <div className="ll-row col">
        <span>{t('settings.palette')}</span>
        <div className="ll-swatches" role="radiogroup" aria-label={t('settings.palette')}>
          {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={palette === k} title={t(`settings.palettes.${k}`)} className={`ll-sw${palette === k ? ' on' : ''}`}
              style={{ background: `linear-gradient(135deg, ${PALETTES[k].deep}, ${PALETTES[k].primary} 55%, ${PALETTES[k].accent})` }} onClick={() => setPalette(k)} />
          ))}
        </div>
      </div>
      <div className="ll-row col">
        <span>{t('login.look.bg')}</span>
        <Segmented block size="small" value={bg} onChange={(v) => setBg(v as LoginBg)} options={BGS.map((b) => ({ value: b, label: t(`login.look.bgs.${b}`) }))} />
      </div>
      <div className="ll-row col">
        <span>{t('login.look.layout')}</span>
        <Segmented block size="small" value={layout} onChange={(v) => setLayout(v as LoginLayout)} options={LAYOUTS.map((l) => ({ value: l, label: t(`login.look.layouts.${l}`) }))} />
      </div>
    </div>
  )
  return (
    <Popover content={content} trigger="click" placement="topRight" open={open} onOpenChange={setOpen} arrow={false}>
      <button type="button" className="login-look-btn" aria-label={t('login.look.title')} title={t('login.look.title')}><BgColorsOutlined /></button>
    </Popover>
  )
}

/** Chọn giao diện ngay dưới nút Đăng nhập: 4 màu chủ đạo (chấm tròn, có dấu chọn) và chế độ sáng / tối. */
export function LoginLookBar() {
  const { t } = useTranslation()
  const { mode, setMode, palette, setPalette, occasion, setAutoOccasion, preview, setPreview, occasions } = useThemeMode()
  const avail = preview ? occasionByKey(preview, occasions) : occasionOn(new Date(), occasions)   // có dịp lễ hôm nay (hoặc đang xem thử) thì có thêm ô "dịp lễ"
  const pick = (k: PaletteKey) => { setPalette(k); if (avail) { setPreview(null); setAutoOccasion(false) } }   // tự chọn màu thì thôi giao diện dịp lễ
  return (
    <div className="login-lookbar" role="group" aria-label={t('login.look.title')}>
      <div className="ll-swatches" role="radiogroup" aria-label={t('settings.palette')}>
        {avail && (
          <button type="button" role="radio" aria-checked={!!occasion} title={occasionName(avail, t)} aria-label={occasionName(avail, t)}
            className={`ll-dot occ${occasion ? ' on' : ''}`} style={{ ['--dot' as string]: avail.palette.primary, background: `linear-gradient(135deg, ${avail.palette.accent}, ${avail.palette.primary} 60%, ${avail.palette.deep})` }}
            onClick={() => { setPreview(null); setAutoOccasion(true) }}>{avail.emoji[0]}</button>
        )}
        {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={!occasion && palette === k} title={t(`settings.palettes.${k}`)} aria-label={t(`settings.palettes.${k}`)}
            className={`ll-dot${!occasion && palette === k ? ' on' : ''}`} style={{ ['--dot' as string]: PALETTES[k].primary, background: `linear-gradient(135deg, ${PALETTES[k].accent}, ${PALETTES[k].primary} 60%, ${PALETTES[k].deep})` }} onClick={() => pick(k)}>
            {!occasion && palette === k && <CheckOutlined />}
          </button>
        ))}
      </div>
      <div className="ll-mode" role="radiogroup" aria-label={t('settings.theme')}>
        <button type="button" role="radio" aria-checked={mode === 'light'} className={mode === 'light' ? 'on' : ''} title={t('common.lightMode')} aria-label={t('common.lightMode')} onClick={() => setMode('light')}><SunOutlined /></button>
        <button type="button" role="radio" aria-checked={mode === 'dark'} className={mode === 'dark' ? 'on' : ''} title={t('common.darkMode')} aria-label={t('common.darkMode')} onClick={() => setMode('dark')}><MoonOutlined /></button>
      </div>
    </div>
  )
}
