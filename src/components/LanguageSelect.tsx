import { Select } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '../i18n'
import { Flag } from './Flag'

/** Combo box chọn ngôn ngữ: cờ + tên bản ngữ (Tiếng Việt / English / 한국어). */
export function LanguageSelect({ className, width = 170 }: { className?: string; width?: number }) {
  const { i18n } = useTranslation()
  return (
    <Select
      className={`lang-select${className ? ` ${className}` : ''}`}
      value={i18n.language}
      onChange={setLanguage}
      style={{ width }}
      suffixIcon={<GlobalOutlined />}
      popupMatchSelectWidth={false}
      options={LANGUAGES.map((l) => ({
        value: l.code,
        label: <span className="lang-opt"><Flag code={l.code} width={22} /><span>{l.label}</span></span>,
      }))}
    />
  )
}
