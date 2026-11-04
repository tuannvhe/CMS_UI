import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { BookOutlined, CheckOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import 'dayjs/locale/ko'
import 'dayjs/locale/en'
import './ojt.css'

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
  return (
    <Modal open={open} onCancel={onClose} footer={null} width="min(960px, 94vw)" centered destroyOnHidden className="ojt-nb-modal" title={null} closable maskClosable={false}>
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

        <section className="ojt-sheet">
          <div className="ojt-holes" aria-hidden><i /><i /><i /><i /></div>
          <label className="ojt-sec-title" htmlFor="ojt-content">{t('ojt.content')} <em>*</em></label>
          <textarea id="ojt-content" className="ojt-lines ojt-lines-main" rows={10} maxLength={2000} autoFocus value={content}
            placeholder={t('ojt.contentPh')} onChange={(e) => setContent(e.target.value)} />
          <div className="ojt-count">{content.length} / 2000</div>

          <label className="ojt-sec-title ojt-sec-2" htmlFor="ojt-diff">{t('ojt.difficultyAsk')}</label>
          <textarea id="ojt-diff" className="ojt-lines ojt-lines-sub" rows={5} maxLength={1000} value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)} />
          <div className="ojt-count">{difficulty.length} / 1000</div>
        </section>

        <footer className="ojt-nb-foot">
          <span className="ojt-nb-hint">{t('ojt.nbHint')}</span>
          <Button size="large" onClick={onClose}>{t('ojt.cancel')}</Button>
          <Button size="large" type="primary" icon={<CheckOutlined />} loading={saving} disabled={empty} onClick={() => onSave({ content: content.trim(), difficulty: difficulty.trim() })}>{t('ojt.save')}</Button>
        </footer>
      </div>
    </Modal>
  )
}
