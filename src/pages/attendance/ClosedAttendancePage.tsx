import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Card, Empty, Skeleton, Typography } from 'antd'
import { FileDoneOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { CLOSED_FIELDS, closedAttendance, closedValue, type ClosedRecord, type FieldGroup } from '../../api/closedAttendance'
import { PageBanner } from '../../components/PageBanner'
import { UserAvatar } from '../../components/UserAvatar'

const SECTIONS: { group: FieldGroup; color: string }[] = [
  { group: 'official', color: '#0F6B3E' },
  { group: 'probation', color: '#D48806' },
  { group: 'summary', color: '#2F6FB0' },
  { group: 'allowance', color: '#7C3AED' },
]

/** Giá trị hiển thị: bảng cũ lưu "-" hoặc rỗng khi không có. */
const show = (v: string | undefined) => (v && v.trim() ? v.trim() : '-')
const isZero = (v: string | undefined) => !v || v.trim() === '' || v.trim() === '-' || Number(v.replace(',', '.')) === 0

/** Bốn chỉ số nổi bật ở đầu trang. */
const HIGHLIGHTS: { key: string; color: string }[] = [
  { key: 'tongCongHuongLuong', color: '#0F6B3E' },
  { key: 'nghiPhep', color: '#2F6FB0' },
  { key: 'thuongChuyenCan', color: '#D48806' },
  { key: 'quenChamVanTay', color: '#D92D20' },
]

function Section({ group, color, rec }: { group: FieldGroup; color: string; rec: ClosedRecord }) {
  const { t } = useTranslation()
  const fields = CLOSED_FIELDS.filter((f) => f.group === group)
  const nonZero = fields.filter((f) => !isZero(closedValue(rec, f.key))).length
  // Thử việc: ẩn cả mục khi mọi số liệu đều trống / 0 (đa số nhân viên không ở diện thử việc).
  if (group === 'probation' && nonZero === 0) return null   // mục trợ cấp Hưng Yên luôn hiện (trống thì hiện '-')
  return (
    <section className="cl-section">
      <header style={{ ['--dot' as string]: color }}>
        <span className="cl-dot" />{t(`cls.sec.${group}`)}
        <small>{t('cls.nonZeroN', { n: nonZero, total: fields.length })}</small>
      </header>
      <div className="cl-grid">
        {fields.map((f) => (
          <div key={f.key} className={`cl-row${isZero(closedValue(rec, f.key)) ? ' zero' : ''}${f.key === 'tongCongHuongLuong' ? ' strong' : ''}`}>
            <span className="cl-label">{t(`cls.f.${f.label}`)}</span>
            <span className="cl-val">{show(closedValue(rec, f.key))}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Bảng chốt công tháng của chính người dùng (dữ liệu quản trị nhập từ Excel, dùng chung với hệ thống cũ). */
export default function ClosedAttendancePage() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['closed', 'mine'], queryFn: closedAttendance.mine, retry: false })
  const [period, setPeriod] = useState<string>()
  const rows = useMemo(() => q.data ?? [], [q.data])
  useEffect(() => { if (!period && rows.length) setPeriod(rows[0].period) }, [rows, period])
  const rec = rows.find((r) => r.period === period)

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<FileDoneOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.closedAttendance')} subtitle={t('nav.closedAttendanceDesc')} chips={rec ? [`${t('cls.period')} ${rec.period}`] : []} />
      {q.isLoading ? <Skeleton active /> : q.isError ? <Alert type="error" showIcon title={t('cls.err.generic')} /> : !rec ? (
        <Card><Empty description={t('cls.none')} /></Card>
      ) : (
        <>
          <div className="cl-person">
            <div className="cl-who">
              <UserAvatar name={rec.fullName} size={44} />
              <div style={{ minWidth: 0 }}>
                <div className="cl-name">{rec.fullName}</div>
                <div className="cl-meta">{[rec.employeeId, rec.department, rec.position, rec.title].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div className="cl-periods" role="tablist" aria-label={t('cls.period')}>
              {rows.map((r) => (
                <button key={r.id} type="button" role="tab" aria-selected={r.period === period} className={`cl-pill${r.period === period ? ' on' : ''}`} onClick={() => setPeriod(r.period)}>{r.period}</button>
              ))}
            </div>
          </div>

          <div className="stat-grid">
            {HIGHLIGHTS.map((h) => (
              <div key={h.key} className="stat-tile" style={{ ['--tile' as string]: h.color }}>
                <div className="st-label">{t(`cls.f.${h.key}`)}</div>
                <div className="st-value">{show(rec.values[h.key])}</div>
              </div>
            ))}
          </div>

          {SECTIONS.map((s) => <Section key={s.group} group={s.group} color={s.color} rec={rec} />)}
          {(rec.changedAt ?? rec.createdAt) && <Typography.Text className="cl-foot">{t('cls.updatedAt', { d: dayjs(rec.changedAt ?? rec.createdAt).format('DD/MM/YYYY HH:mm') })}</Typography.Text>}
        </>
      )}
    </div>
  )
}
