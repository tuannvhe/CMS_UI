import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { BookOutlined, CheckOutlined, GlobalOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import 'dayjs/locale/ko'
import 'dayjs/locale/en'
import './ojt.css'

/** Ký tự chỉ có trong tiếng Việt (nguyên âm có dấu, ă â ê ô ơ ư, đ) */
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
export const looksVietnamese = (s: string) => VI_CHARS.test(s)
/** Khớp OjtLang.MostlyVietnamese phía máy chủ: từ có dấu tiếng Việt chiếm ≥30% và có ít nhất 2 từ. */
export function mostlyVietnamese(s: string): boolean {
  const words = s.split(/[\s,.;:!?()/-]+/).filter(Boolean)
  const vi = words.filter((w) => VI_CHARS.test(w)).length
  return vi >= 2 && vi >= words.length * 0.3
}

export interface NotebookValue { content: string; difficulty: string }

interface Props {
  open: boolean
  date: string
  /** Ngày làm việc thứ mấy của đợt OJT / tổng số ngày làm việc đã qua */
  dayNo: number
  dayTotal: number
  mentorName?: string | null
  initial: NotebookValue
  saving: boolean
  onClose: () => void
  onSave: (v: NotebookValue) => void
}

/** Form viết nhật ký OJT dạng trang vở: giấy kẻ dòng, lề đỏ, lỗ gáy, tiêu đề ngày lớn; hai phần "đã làm / học" và "khó khăn". */
export function OjtNotebook({ open, date, dayNo, dayTotal, mentorName, initial, saving, onClose, onSave }: Props) {
  const { t, i18n } = useTranslation()
  const [content, setContent] = useState('')
  const [difficulty, setDifficulty] = useState('')
  useEffect(() => { if (open) { setContent(initial.content); setDifficulty(initial.difficulty) } }, [open, initial.content, initial.difficulty])
  const d = dayjs(date).locale(i18n.language === 'ko' ? 'ko' : i18n.language === 'en' ? 'en' : 'vi')
  const empty = content.trim().length === 0
  const blocked = mostlyVietnamese(content) || mostlyVietnamese(difficulty)
  const viWarn = looksVietnamese(content) || looksVietnamese(difficulty)
  return (
    <Modal open={open} onCancel={onClose} footer={null} width="min(1120px, 96vw)" centered destroyOnHidden className="ojt-nb-modal" title={null} closable maskClosable={false}>
      <div className="ojt-nb">
        <header className="ojt-nb-head">
          <div className="ojt-nb-date">
            <b>{d.format('DD')}</b>
            <span>{d.format('MMMM YYYY')}</span>
          </div>
          <div className="ojt-nb-meta">
            <h2><BookOutlined /> {t('ojt.diaryTitle')}</h2>
            <p>{d.format('dddd, DD/MM/YYYY')}</p>
            <div className="ojt-nb-chips">
              <span>{t('ojt.dayNo', { n: dayNo, total: dayTotal })}</span>
              {mentorName && <span>{t('ojt.mentor')}: {mentorName}</span>}
            </div>
          </div>
        </header>

        <div className={`ojt-en-banner${viWarn ? ' warn' : ''}`} role="note"><GlobalOutlined /><b>{t('ojt.enBannerTitle')}</b><span>{viWarn ? t('ojt.enBannerWarn') : t('ojt.enBannerText')}</span></div>

        <div className="ojt-form">
          <aside className="ojt-tips">
            <h4>{t('ojt.tipsTitle')}</h4>
            <ul>
              <li>{t('ojt.tip1')}</li>
              <li>{t('ojt.tip2')}</li>
              <li>{t('ojt.tip3')}</li>
              <li>{t('ojt.tip4')}</li>
            </ul>
            <p>{t('ojt.nbHint')}</p>
          </aside>
          <section className="ojt-form-main">
            <label className="ojt-sec-title" htmlFor="ojt-content">{t('ojt.content')} <em>*</em></label>
            <textarea id="ojt-content" className="ojt-field ojt-field-main" maxLength={2000} autoFocus value={content}
              placeholder={t('ojt.contentPh')} onChange={(e) => setContent(e.target.value)} />
            {looksVietnamese(content) && <div className="ojt-vi-warn" role="alert">{t('ojt.viWarn')}</div>}
            <div className={`ojt-count${content.length > 1800 ? ' hot' : ''}`}>{content.length} / 2000</div>

            <label className="ojt-sec-title ojt-sec-2" htmlFor="ojt-diff">{t('ojt.difficultyAsk')}</label>
            <textarea id="ojt-diff" className="ojt-field ojt-field-sub" maxLength={1000} value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)} />
            {looksVietnamese(difficulty) && <div className="ojt-vi-warn" role="alert">{t('ojt.viWarn')}</div>}
            <div className={`ojt-count${difficulty.length > 900 ? ' hot' : ''}`}>{difficulty.length} / 1000</div>
          </section>
        </div>

        <footer className="ojt-nb-foot">
          <span className="ojt-nb-hint">{blocked && <span className="ojt-vi-block">{t('ojt.viBlocked')}</span>}</span>
          <Button size="large" onClick={onClose}>{t('ojt.cancel')}</Button>
          <Button size="large" type="primary" icon={<CheckOutlined />} loading={saving} disabled={empty || blocked} onClick={() => onSave({ content: content.trim(), difficulty: difficulty.trim() })}>{t('ojt.save')}</Button>
        </footer>
      </div>
    </Modal>
  )
}
