import { useState } from 'react'
import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Popconfirm, Select, Space, Tag, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { EDU_LEVELS, recruit, type CvDetail, type EduLevel, type RecruitApplication } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'
import { foldFilter } from '../../utils/search'

const useErr = () => {
  const { t } = useTranslation()
  return (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
}

/** Số năm kinh nghiệm, làm tròn 0,5 năm (vd 3,5). */
export const expYears = (months: number | null | undefined) => (months == null ? null : Math.round(months / 6) / 2)

/**
 * Thứ tự ưu tiên: nhiều kinh nghiệm trước; cùng kinh nghiệm thì tuổi cao hơn (năm sinh nhỏ hơn) trước; chưa có số liệu xếp cuối; cuối cùng hồ sơ mới trước.
 * So kinh nghiệm theo nửa năm để chênh vài tháng vẫn coi như bằng nhau.
 */
export function byExperienceThenAge(a: RecruitApplication, b: RecruitApplication) {
  const ea = expYears(a.expMonths), eb = expYears(b.expMonths)
  if (ea !== eb) return ea == null ? 1 : eb == null ? -1 : eb - ea
  const ya = a.birthYear ?? null, yb = b.birthYear ?? null
  if (ya !== yb) return ya == null ? 1 : yb == null ? -1 : ya - yb
  return b.createdAt.localeCompare(a.createdAt)
}

export function ExpCell({ app }: { app: RecruitApplication }) {
  const { t } = useTranslation()
  const y = expYears(app.expMonths)
  return y == null ? <span className="cell-muted">—</span> : <span>{t('rec.cvf.years', { n: y.toLocaleString() })}{app.factsSource === 'hr' && <Tooltip title={t('rec.cvf.byHr')}> ✎</Tooltip>}{app.factsSource === 'ai' && <Tooltip title={t('rec.cvf.byAi')}> ✦</Tooltip>}</span>
}

export function AgeCell({ app }: { app: RecruitApplication }) {
  const { t } = useTranslation()
  if (app.birthYear == null) return <span className="cell-muted">—</span>
  return <span>{app.birthYear}<div className="cell-muted">{t('rec.cvf.age', { n: new Date().getFullYear() - app.birthYear })}</div></span>
}

export function EduCell({ value }: { value?: EduLevel | null }) {
  const { t } = useTranslation()
  return value ? <span>{t(`rec.edu.${value}`)}</span> : <span className="cell-muted">—</span>
}

/** Ô thông tin trong hồ sơ: kinh nghiệm, năm sinh, học vấn + nút sửa tay và đọc lại CV. Dùng trong lưới .rec-info. */
export function CvFactsInfo({ app }: { app: RecruitApplication }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm<{ fullName?: string; phone?: string; email?: string; department?: string; birthYear?: number | null; expYears?: number | null; education?: EduLevel | null }>()
  const refresh = () => { qc.invalidateQueries({ queryKey: ['recruit'] }); qc.invalidateQueries({ queryKey: ['ojt-team'] }); qc.invalidateQueries({ queryKey: ['ojt-by-app', app.id] }) }
  const lookups = useQuery({ queryKey: ['recruit', 'lookups'], queryFn: recruit.lookups, staleTime: 5 * 60_000, retry: false, enabled: editing })
  const read = useMutation({ mutationFn: () => recruit.readCv(app.id), onSuccess: (f) => { msg.success(f.birthYear == null && f.expMonths == null && f.education == null ? t('rec.cvf.nothing') : t('rec.cvf.readOk')); refresh() }, onError: (e) => msg.error(err(e)) })
  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const txt = (s?: string) => (s?.trim() ? s.trim() : null)
      await recruit.setContact(app.id, { fullName: (v.fullName ?? '').trim(), phone: txt(v.phone), email: txt(v.email), department: txt(v.department) ?? app.department ?? null })
      return recruit.setCvFacts(app.id, { birthYear: v.birthYear ?? null, expYears: v.expYears ?? null, education: v.education ?? null })
    },
    onSuccess: () => { msg.success(t('usr.saved')); setEditing(false); refresh() },
    onError: (e) => { if (!(e && typeof e === 'object' && 'errorFields' in e)) msg.error(err(e)) },
  })
  const year = new Date().getFullYear()
  return (
    <>
      <div><label>{t('rec.cvf.exp')}</label><span><ExpCell app={app} /></span></div>
      <div><label>{t('rec.cvf.birth')}</label><span>{app.birthYear ? `${app.birthYear} (${t('rec.cvf.age', { n: year - app.birthYear })})` : '—'}</span></div>
      <div><label>{t('rec.cvf.edu')}</label><span><EduCell value={app.education} /></span></div>
      <div className="wide">
        <Space wrap size={6}>
          {app.factsSource === 'hr' ? <Tag>{t('rec.cvf.byHr')}</Tag> : app.factsSource === 'ai' ? <Tag color="purple">{t('rec.cvf.byAi')}</Tag> : app.factsSource === 'auto' ? <Tag color="blue">{t('rec.cvf.byCv')}</Tag> : <Tag>{t('rec.cvf.notRead')}</Tag>}
          <Button size="small" icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ fullName: app.fullName, phone: app.phone ?? '', email: app.email ?? '', department: app.department ?? undefined, birthYear: app.birthYear ?? null, expYears: expYears(app.expMonths), education: app.education ?? null }); setEditing(true) }}>{t('rec.cvf.edit')}</Button>
          {app.hasFile && <Button size="small" icon={<ReloadOutlined />} loading={read.isPending} onClick={() => read.mutate()}>{t('rec.cvf.read')}</Button>}
        </Space>
      </div>
      <AppModal open={editing} onClose={() => setEditing(false)} size="sm" icon={<EditOutlined />} title={t('rec.cvf.edit')} subtitle={t('rec.cvf.editHint')}
        okText={t('rec.ob.save')} okLoading={save.isPending} onOk={() => save.mutate()}>
        <Form form={form} layout="vertical">
          <Form.Item name="fullName" label={t('rec.cvf.fullName')} rules={[{ required: true, whitespace: true }, { max: 100 }]}><Input /></Form.Item>
          <Space wrap size={12} style={{ display: 'flex' }}>
            <Form.Item name="phone" label={t('rec.cvf.phone')} rules={[{ max: 30 }]}><Input style={{ width: 180 }} /></Form.Item>
            <Form.Item name="email" label={t('rec.cvf.email')} rules={[{ type: 'email' }, { max: 200 }]}><Input style={{ width: 260 }} /></Form.Item>
          </Space>
          <Form.Item name="department" label={t('rec.department')} extra={t('rec.cvf.deptHint')}>
            <Select showSearch filterOption={foldFilter('label')} loading={lookups.isLoading} style={{ width: 280 }}
              options={[...new Set([...(app.department ? [app.department] : []), ...(lookups.data?.departments ?? [])])].map((d) => ({ value: d, label: d }))} />
          </Form.Item>
          <Form.Item name="expYears" label={t('rec.cvf.expYears')}><InputNumber min={0} max={50} step={0.5} style={{ width: 160 }} /></Form.Item>
          <Form.Item name="birthYear" label={t('rec.cvf.birth')}><InputNumber min={1940} max={year - 14} style={{ width: 160 }} /></Form.Item>
          <Form.Item name="education" label={t('rec.cvf.edu')}><Select allowClear style={{ width: 220 }} options={EDU_LEVELS.map((v) => ({ value: v, label: t(`rec.edu.${v}`) }))} /></Form.Item>
        </Form>
      </AppModal>
    </>
  )
}

type ExpForm = { from?: Dayjs | null; to?: Dayjs | null; current?: boolean; company?: string; position?: string }
type EduForm = { school?: string; major?: string; degree?: EduLevel | null; fromYear?: number | null; toYear?: number | null }

const mmyy = (v: string | null) => (v ? dayjs(v).format('MM/YYYY') : '?')
/** Số tháng của một dòng (tính cả tháng đầu và tháng cuối), null nếu thiếu ngày bắt đầu. */
const spanMonths = (from: string | null, to: string | null, current: boolean) => {
  if (!from) return null
  const end = current || !to ? dayjs() : dayjs(to)
  const n = end.diff(dayjs(from), 'month') + 1
  return n > 0 ? n : null
}

/** Chữ tiếng Anh của một ô (công ty, chức danh, trường, chuyên ngành) nếu CV đã được dịch; rê chuột thấy chữ gốc. */
function EnText({ cv, value }: { cv?: CvDetail | null; value: string | null }) {
  if (!value) return null
  const en = cv?.en?.[value.trim()]
  return en && en !== value ? <Tooltip title={value}><span>{en}</span></Tooltip> : <>{value}</>
}

/** Khi CV đã dịch: các chữ cố định trong dòng (hiện nay, bậc học, số năm) cũng hiện tiếng Anh. */
function useRowT(cv?: CvDetail | null) {
  const { t, i18n } = useTranslation()
  return cv?.en && Object.keys(cv.en).length > 0 ? i18n.getFixedT('en') : t
}

/** Danh sách gọn các dòng kinh nghiệm (thời gian, công ty, vị trí) cho bảng; tối đa `max` dòng, còn lại gộp "+n". */
export function ExpRows({ cv, max = 4 }: { cv?: CvDetail | null; max?: number }) {
  const t = useRowT(cv)
  const rows = cv?.experience ?? []
  if (rows.length === 0) return null
  return (
    <div className="rec-rows">
      {rows.slice(0, max).map((x, i) => (
        <div key={i}><span className="when">{mmyy(x.from)} – {x.current ? t('rec.cvf.now') : mmyy(x.to)}</span> <b>{x.company ? <EnText cv={cv} value={x.company} /> : '—'}</b>{x.position && <span className="cell-muted"> · <EnText cv={cv} value={x.position} /></span>}</div>
      ))}
      {rows.length > max && <div className="cell-muted">+{rows.length - max}</div>}
    </div>
  )
}

/** Danh sách gọn các dòng học vấn (năm, trường, chuyên ngành, bậc) cho bảng. */
export function EduRows({ cv, max = 3 }: { cv?: CvDetail | null; max?: number }) {
  const t = useRowT(cv)
  const rows = cv?.education ?? []
  if (rows.length === 0) return null
  return (
    <div className="rec-rows">
      {rows.slice(0, max).map((x, i) => (
        <div key={i}><span className="when">{x.fromYear ?? '?'} – {x.toYear ?? '?'}</span> <b>{x.school ? <EnText cv={cv} value={x.school} /> : '—'}</b>{x.major && <span className="cell-muted"> · <EnText cv={cv} value={x.major} /></span>}{x.degree && <> <Tag color="blue" style={{ marginInlineEnd: 0 }}>{t(`rec.edu.${x.degree}`)}</Tag></>}</div>
      ))}
      {rows.length > max && <div className="cell-muted">+{rows.length - max}</div>}
    </div>
  )
}

/** Từng dòng kinh nghiệm (công ty, vị trí, thời gian) và học vấn (trường, chuyên ngành, bậc, năm) đọc từ CV; HR sửa được. */
export function CvDetailBlock({ app, cv, ai }: { app: RecruitApplication; cv: CvDetail; ai?: boolean }) {
  const { t } = useTranslation()
  const rt = useRowT(cv)
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm<{ exp: ExpForm[]; edu: EduForm[] }>()
  const year = new Date().getFullYear()
  const open = () => {
    form.setFieldsValue({
      exp: cv.experience.map((x) => ({ from: x.from ? dayjs(x.from) : null, to: x.to ? dayjs(x.to) : null, current: x.current, company: x.company ?? '', position: x.position ?? '' })),
      edu: cv.education.map((x) => ({ school: x.school ?? '', major: x.major ?? '', degree: x.degree, fromYear: x.fromYear, toYear: x.toYear })),
    })
    setEditing(true)
  }
  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const ym = (d?: Dayjs | null) => (d ? d.startOf('month').format('YYYY-MM-DD') : null)
      const txt = (s?: string) => (s?.trim() ? s.trim() : null)
      return recruit.setCvDetail(app.id, {
        experience: (v.exp ?? []).map((x) => ({ from: ym(x.from), to: x.current ? null : ym(x.to), current: !!x.current, company: txt(x.company), position: txt(x.position) })),
        education: (v.edu ?? []).map((x) => ({ school: txt(x.school), major: txt(x.major), degree: x.degree ?? null, fromYear: x.fromYear ?? null, toYear: x.toYear ?? null })),
      })
    },
    onSuccess: () => { msg.success(t('usr.saved')); setEditing(false); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => { if (!(e && typeof e === 'object' && 'errorFields' in e)) msg.error(err(e)) },
  })
  return (
    <div>
      <div className="rec-section" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{t('rec.cvf.detail')}</span>
        <span className="rec-round-gap" />
        <Button size="small" icon={<EditOutlined />} onClick={open}>{t('rec.cvf.editDetail')}</Button>
      </div>
      {ai && app.factsSource === 'auto' && <div className="cell-muted" style={{ marginBottom: 6 }}>{t('rec.cvf.aiOn')}</div>}
      {/* Kinh nghiệm và học vấn tách thành hai khối riêng */}
      <div style={{ fontWeight: 600, margin: '8px 0 2px' }}>{t('rec.cvf.expRows')}</div>
      {cv.experience.length === 0 ? <div className="cell-muted">{t('rec.cvf.noRows')}</div> : cv.experience.map((x, i) => {
        const n = spanMonths(x.from, x.to, x.current)
        return (
          <div key={`e${i}`} className="rec-panel-row">
            <div className="rec-panel-who">
              <span style={{ minWidth: 150 }}>{mmyy(x.from)} – {x.current ? rt('rec.cvf.now') : mmyy(x.to)}</span>
              <b>{x.company ? <EnText cv={cv} value={x.company} /> : '—'}</b>
              {x.position && <span className="cell-muted">· <EnText cv={cv} value={x.position} /></span>}
              {x.current && <Tag color="green">{rt('rec.cvf.current')}</Tag>}
              {n != null && <span className="cell-muted">({n >= 12 ? rt('rec.cvf.years', { n: (Math.round(n / 6) / 2).toLocaleString('en') }) : rt('rec.cvf.months', { n })})</span>}
            </div>
          </div>
        )
      })}
      <div style={{ fontWeight: 600, margin: '12px 0 2px' }}>{t('rec.cvf.eduRows')}</div>
      {cv.education.length === 0 ? <div className="cell-muted">{t('rec.cvf.noRows')}</div> : cv.education.map((x, i) => (
        <div key={`d${i}`} className="rec-panel-row">
          <div className="rec-panel-who">
            <span style={{ minWidth: 150 }}>{x.fromYear ?? '?'} – {x.toYear ?? '?'}</span>
            <b>{x.school ? <EnText cv={cv} value={x.school} /> : '—'}</b>
            {x.major && <span className="cell-muted">· <EnText cv={cv} value={x.major} /></span>}
            {x.degree && <Tag color="blue">{rt(`rec.edu.${x.degree}`)}</Tag>}
          </div>
        </div>
      ))}
      <AppModal open={editing} onClose={() => setEditing(false)} size="xl" icon={<EditOutlined />} title={t('rec.cvf.editDetail')} subtitle={t('rec.cvf.detailHint')}
        okText={t('rec.ob.save')} okLoading={save.isPending} onOk={() => save.mutate()}>
        <Form form={form} layout="vertical">
          <div className="rec-section">{t('rec.cvf.expRows')}</div>
          <Form.List name="exp">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} wrap align="end" size={8} style={{ marginBottom: 4 }}>
                    <Form.Item name={[f.name, 'from']} label={t('rec.cvf.from')}><DatePicker picker="month" format="MM/YYYY" style={{ width: 120 }} disabledDate={(d) => d.isAfter(dayjs(), 'month')} /></Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {() => <Form.Item name={[f.name, 'to']} label={t('rec.cvf.to')}><DatePicker picker="month" format="MM/YYYY" style={{ width: 120 }} disabled={!!form.getFieldValue(['exp', f.name, 'current'])} /></Form.Item>}
                    </Form.Item>
                    <Form.Item name={[f.name, 'current']} valuePropName="checked" label=" "><Checkbox>{t('rec.cvf.current')}</Checkbox></Form.Item>
                    <Form.Item name={[f.name, 'company']} label={t('rec.cvf.company')} rules={[{ max: 200 }]}><Input style={{ width: 260 }} /></Form.Item>
                    <Form.Item name={[f.name, 'position']} label={t('rec.cvf.position')} rules={[{ max: 200 }]}><Input style={{ width: 200 }} /></Form.Item>
                    <Form.Item label=" "><Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(f.name)} /></Form.Item>
                  </Space>
                ))}
                {fields.length < 30 && <Button icon={<PlusOutlined />} onClick={() => add({ current: false })} style={{ marginBottom: 16 }}>{t('rec.cvf.addExp')}</Button>}
              </>
            )}
          </Form.List>
          <div className="rec-section">{t('rec.cvf.eduRows')}</div>
          <Form.List name="edu">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} wrap align="end" size={8} style={{ marginBottom: 4 }}>
                    <Form.Item name={[f.name, 'school']} label={t('rec.cvf.school')} rules={[{ max: 200 }]}><Input style={{ width: 260 }} /></Form.Item>
                    <Form.Item name={[f.name, 'major']} label={t('rec.cvf.major')} rules={[{ max: 200 }]}><Input style={{ width: 200 }} /></Form.Item>
                    <Form.Item name={[f.name, 'degree']} label={t('rec.cvf.degree')}><Select allowClear style={{ width: 140 }} options={EDU_LEVELS.map((v) => ({ value: v, label: t(`rec.edu.${v}`) }))} /></Form.Item>
                    <Form.Item name={[f.name, 'fromYear']} label={t('rec.cvf.fromYear')}><InputNumber min={1950} max={year} style={{ width: 100 }} /></Form.Item>
                    <Form.Item name={[f.name, 'toYear']} label={t('rec.cvf.toYear')}><InputNumber min={1950} max={year + 6} style={{ width: 100 }} /></Form.Item>
                    <Form.Item label=" "><Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(f.name)} /></Form.Item>
                  </Space>
                ))}
                {fields.length < 30 && <Button icon={<PlusOutlined />} onClick={() => add({})}>{t('rec.cvf.addEdu')}</Button>}
              </>
            )}
          </Form.List>
        </Form>
      </AppModal>
    </div>
  )
}

/** Đọc CV cho hồ sơ cũ chưa đọc lần nào (mỗi lần tối đa 100 hồ sơ). */
export function BackfillButton({ count }: { count: number }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const run = useMutation({
    mutationFn: recruit.backfillCvFacts,
    onSuccess: (r) => { msg.success(r.left > 0 ? t('rec.cvf.backfillMore', { n: r.done, left: r.left }) : t('rec.cvf.backfillOk', { n: r.done })); qc.invalidateQueries({ queryKey: ['recruit'] }) },
    onError: (e) => msg.error(err(e)),
  })
  if (count === 0) return null
  return <Button icon={<FileSearchOutlined />} loading={run.isPending} onClick={() => run.mutate()}>{t('rec.cvf.backfill', { n: count })}</Button>
}

/** HR cho AI xử lý lại mọi CV của hồ sơ đang mở (đọc lại, che lương, dịch); chạy nền từng CV. */
export function AiAllButton({ count }: { count: number }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const run = useMutation({
    mutationFn: recruit.queueAiAll,
    onSuccess: (n) => msg.success(t('rec.cvx.aiQueued', { n })),
    onError: (e) => msg.error(err(e)),
  })
  if (count === 0) return null
  return <Popconfirm title={t('rec.cvx.aiAsk', { n: count })} onConfirm={() => run.mutate()}><Button icon={<RobotOutlined />} loading={run.isPending}>{t('rec.cvx.aiAll', { n: count })}</Button></Popconfirm>
}

/** Đọc lại CV của mọi hồ sơ đang mở (trừ hồ sơ HR đã sửa tay) sau khi nâng cấp bộ đọc: chạy từng lượt 40 hồ sơ cho đến hết. */
export function RereadPickedButton({ ids, skipped, onDone }: { ids: number[]; skipped: number; onDone?: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const err = useErr()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    let done = 0
    try {
      for (const id of ids) { await recruit.readCv(id); done++ }
      msg.success(t('rec.rereadOk', { n: done }))
    } catch (e) { msg.error(`${err(e)} (${done}/${ids.length})`) } finally { setBusy(false); qc.invalidateQueries({ queryKey: ['recruit'] }); onDone?.() }
  }
  if (ids.length === 0) return null
  return <Popconfirm title={t('rec.rereadAsk', { n: ids.length }) + (skipped > 0 ? ' ' + t('rec.rereadSkip', { n: skipped }) : '')} onConfirm={run}><Button icon={<ReloadOutlined />} loading={busy}>{t('rec.rereadAll', { n: ids.length })}</Button></Popconfirm>
}
