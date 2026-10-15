import { useMemo, useState } from 'react'
import { Alert, Avatar, Button, DatePicker, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CopyOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, LockOutlined, PlusOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { payslip } from '../../api/payslip'
import { AppModal } from '../../components/AppModal'
import { PAY_KEY_COMMAND, PERSON_PAY_TABLE_SQL, payroll, payrollError, payrollPeople, type PersonPayEmployee, type PersonPayPreview, type PersonPayView } from '../../api/payroll'
import { IssueList } from '../../components/ImportWizard'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'

const PAGE_SIZE = 30
/** Các cột nhập thêm dạng cờ (1 = có): hiện bằng công tắc thay vì ô số. */
const FLAGS = new Set(['nu', 'khongBaoHiem', 'dongBaoHiem', 'khongDoanPhi', 'hyChuyenTroLanDau', 'hyMoc6', 'hyMoc12'])
const BASE_KEY = 'luongCoBanNV'
/** Khoản ổn định hiện trong biểu mẫu khi cấu hình đã lưu chưa có cờ "Lưu vào hồ sơ". */
const STABLE = new Set([BASE_KEY, 'nu', 'phuThuoc', 'khongBaoHiem', 'dongBaoHiem', 'khongDoanPhi', 'tcCongDoan', 'tcNgoaiQuan', 'tcDryroom', 'tcDienCuc', 'tcThamNien', 'tcNgonNguMuc'])
interface Editing { employeeId: string; effectiveFrom: string; values: Record<string, number>; isNew: boolean; name?: string }

/** Lương riêng từng người, lưu MÃ HÓA trong CSDL: lương hợp đồng, cờ (nữ, không đóng BH…), trợ cấp cố định. Nâng lương = thêm dòng mới với kỳ áp dụng mới. */
export default function PayrollPeoplePage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [found, setFound] = useState<PersonPayEmployee[]>([])
  const [period, setPeriod] = useState('')
  const [bootOpen, setBootOpen] = useState(false)
  const [prev, setPrev] = useState<PersonPayPreview | null>(null)
  const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : i18n.language, { maximumFractionDigits: 2 }))

  const state = useQuery({ queryKey: ['payroll-people', 'state'], queryFn: payrollPeople.state, retry: false })
  const ready = !!state.data?.tableReady && !!state.data?.keyReady
  const cfg = useQuery({ queryKey: ['payroll', 'config'], queryFn: payroll.config, retry: false })
  const inputs = useMemo(() => {
    const map = new Map<string, { key: string; label: string; header: string }>()
    for (const v of cfg.data?.versions ?? []) for (const i of v.config.inputs) if (!map.has(i.key)) map.set(i.key, i)
    return [...map.values()]
  }, [cfg.data])
  /** Biểu mẫu chỉ hiện khoản ổn định (lương, cờ, trợ cấp cố định); khoản chỉ của tháng nhập ở file Excel hằng tháng. */
  const formInputs = useMemo(() => {
    const stable = inputs.filter((i) => (cfg.data?.versions ?? []).some((v) => v.config.inputs.some((x) => x.key === i.key && x.persist)))
    return stable.length > 0 ? stable : inputs.filter((i) => STABLE.has(i.key))
  }, [inputs, cfg.data])
  const list = useQuery({ queryKey: ['payroll-people', 'list', search, page], queryFn: () => payrollPeople.list(search, page, PAGE_SIZE), enabled: ready, retry: false, staleTime: 0, gcTime: 0, placeholderData: (p) => p })
  // Kỳ đã có phiếu lương (để chọn kỳ nguồn khi lấy lương từ phiếu); người không có quyền xem danh sách này vẫn gõ tay được.
  const periods = useQuery({ queryKey: ['payslip', 'admin-periods'], queryFn: payslip.adminPeriods, retry: false, staleTime: 60_000 })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['payroll-people'] }) }

  const errText = (e: unknown) => {
    const { code, detail } = payrollError(e)
    if (code === 'table_missing') return t('prp.err.table')
    if (code === 'key_missing') return t('prp.err.key')
    if (code === 'too_large') return t('cls.err.too_large')
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'bad_file') return t(`prp.err.bad_${detail}`, { defaultValue: t('cls.err.bad_file') })
    if (code === 'invalid_input') { const d = (detail ?? '').split(':')[0]; return t(`prp.err.${d === 'key' ? 'key_' : d}`, { defaultValue: t('cls.err.generic') }) }
    return t('cls.err.generic')
  }
  const save = useMutation({
    mutationFn: () => payrollPeople.save({ employeeId: editing!.employeeId.trim(), effectiveFrom: editing!.effectiveFrom.trim(), values: editing!.values }),
    onSuccess: () => { msg.success(t('prp.saved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (r: PersonPayView) => payrollPeople.remove(r.pay.employeeId, r.pay.effectiveFrom),
    onSuccess: () => { msg.success(t('prp.deleted')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const doPreview = useMutation({ mutationFn: payrollPeople.importPreview, onSuccess: setPrev, onError: (e) => msg.error(errText(e)) })
  const doBootstrap = useMutation({ mutationFn: () => payrollPeople.bootstrapPreview(period.trim()), onSuccess: (p) => { setBootOpen(false); setPrev(p) }, onError: (e) => msg.error(errText(e)) })
  const commit = useMutation({
    mutationFn: () => payrollPeople.commit(prev!.token),
    onSuccess: (r) => { msg.success(t('prp.committed', { n: r.rows })); setPrev(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const money = (v: number | undefined) => (show ? fmt(v) : '••••••')
  const cols: ColumnsType<PersonPayView> = [
    { title: t('org.colEmp'), dataIndex: ['pay', 'employeeId'], width: 110 },
    { title: t('org.colName'), dataIndex: 'fullName', width: 180 },
    { title: t('org.department'), dataIndex: 'department', width: 150, ellipsis: true },
    { title: t('prp.from'), dataIndex: ['pay', 'effectiveFrom'], width: 110 },
    { title: t('prp.base'), width: 140, align: 'right', render: (_, r) => money(r.pay.values[BASE_KEY]) },
    {
      title: t('prp.others'),
      render: (_, r) => Object.entries(r.pay.values).filter(([k]) => k !== BASE_KEY).map(([k, v]) => (
        <Tag key={k}>{inputs.find((i) => i.key === k)?.header ?? k}{FLAGS.has(k) ? '' : `: ${money(v)}`}</Tag>
      )),
    },
    {
      title: '', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Tooltip title={t('prp.edit')}><Button type="text" icon={<EditOutlined />} onClick={() => setEditing({ employeeId: r.pay.employeeId, effectiveFrom: r.pay.effectiveFrom, values: { ...r.pay.values }, isNew: false, name: r.fullName })} /></Tooltip>
          <Tooltip title={t('prp.copyRow')}><Button type="text" icon={<CopyOutlined />} onClick={() => setEditing({ employeeId: r.pay.employeeId, effectiveFrom: dayjs().format('MM/YYYY'), values: { ...r.pay.values }, isNew: true, name: r.fullName })} /></Tooltip>
          <Popconfirm title={t('prp.deleteConfirm')} onConfirm={() => remove.mutate(r)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<LockOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payrollPeople')} subtitle={t('nav.payrollPeopleDesc')} />

      {state.data && !state.data.tableReady && <SqlNotReady title={t('prp.notReady')} sql={PERSON_PAY_TABLE_SQL} onRetry={() => state.refetch()} loading={state.isFetching} />}
      {state.data && state.data.tableReady && !state.data.keyReady && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('prp.keyTitle')}
          description={(
            <>
              <p style={{ margin: '4px 0' }}>{t('prp.keyText')}</p>
              <pre className="org-sql">{PAY_KEY_COMMAND}</pre>
              <p style={{ margin: 0 }}>{t('prp.keyHow')}</p>
              <p style={{ margin: '8px 0 0', color: '#8c6d1f' }}>{t('prp.keyDiag', { env: state.data.environment ?? '?', status: state.data.keyStatus ?? '?' })}</p>
            </>
          )} />
      )}

      {ready && (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('prp.noteTitle')} description={t('prp.note')} />
          <div className="pay-toolbar">
            <Space wrap>
              <Input.Search allowClear placeholder={t('prl.search')} style={{ width: 280 }} onSearch={(v) => { setSearch(v); setPage(1) }} />
              <span><Switch checked={show} onChange={setShow} checkedChildren={<EyeOutlined />} unCheckedChildren={<EyeInvisibleOutlined />} /> {t(show ? 'pay.hide' : 'pay.show')}</span>
            </Space>
            <Space wrap>
              <Button icon={<PlusOutlined />} type="primary" onClick={() => { setFound([]); setEditing({ employeeId: '', effectiveFrom: dayjs().format('MM/YYYY'), values: {}, isNew: true }) }}>{t('prp.add')}</Button>
              <Button onClick={() => { if (!period && periods.data?.length) setPeriod(periods.data[0].period); setBootOpen(true) }}>{t('prp.bootstrap')}</Button>
              <Upload accept=".xlsx" showUploadList={false} beforeUpload={(f) => { doPreview.mutate(f); return false }}><Button icon={<UploadOutlined />} loading={doPreview.isPending}>{t('prp.import')}</Button></Upload>
              <Button icon={<DownloadOutlined />} onClick={() => payrollPeople.template().catch(() => msg.error(t('cls.err.generic')))}>{t('prl.template')}</Button>
            </Space>
          </div>
          <Table<PersonPayView> rowKey={(r) => `${r.pay.employeeId}|${r.pay.effectiveFrom}`} size="small" loading={list.isFetching} columns={cols} dataSource={list.data?.rows ?? []} scroll={{ x: 'max-content' }}
            pagination={{ current: page, pageSize: PAGE_SIZE, total: list.data?.total ?? 0, showSizeChanger: false, onChange: setPage }} />
        </>
      )}

      <AppModal open={!!editing} onClose={() => setEditing(null)} size="lg" icon={<UserOutlined />}
        title={editing?.isNew ? t('prp.add') : t('prp.edit')}
        subtitle={editing?.name ? `${editing.name} · ${editing.employeeId}` : t('prp.modalHint')}
        okText={t('prp.save')} okLoading={save.isPending} okDisabled={!editing || !editing.employeeId.trim() || !/^\d{1,2}\/\d{4}$/.test(editing.effectiveFrom.trim())} onOk={() => save.mutate()}>
        {editing && (
          <div className="prp-form">
            <div className="prp-row">
              <div className="prp-field grow">
                <label>{t('org.colEmp')}</label>
                {editing.isNew && !editing.name ? (
                  <Select showSearch filterOption={false} placeholder={t('prp.pickEmployee')} notFoundContent={null} style={{ width: '100%' }} value={editing.employeeId || undefined}
                    onSearch={(v) => { if (v.trim().length >= 2) payrollPeople.employees(v.trim()).then(setFound).catch(() => setFound([])) }}
                    onChange={(v) => { const e = found.find((x) => x.employeeId === v); setEditing({ ...editing, employeeId: v, name: undefined }); if (e) setFound([e]) }}
                    options={found.map((e) => ({ value: e.employeeId, label: `${e.fullName} · ${e.employeeId}${e.department ? ' · ' + e.department : ''}${e.hasPay ? ' ✓' : ''}` }))} />
                ) : <Input value={`${editing.name ?? ''} · ${editing.employeeId}`} disabled />}
              </div>
              <div className="prp-field">
                <label>{t('prp.from')}</label>
                <DatePicker picker="month" format="MM/YYYY" allowClear={false} style={{ width: 160 }} disabled={!editing.isNew}
                  value={/^\d{1,2}\/\d{4}$/.test(editing.effectiveFrom) ? dayjs(editing.effectiveFrom, 'MM/YYYY') : null}
                  onChange={(d) => setEditing({ ...editing, effectiveFrom: d ? d.format('MM/YYYY') : '' })} />
              </div>
            </div>
            <Typography.Paragraph type="secondary" className="prp-help">{t('prp.fromHelp')} {t('prp.valuesHelp')}</Typography.Paragraph>

            <section className="prp-sec">
              <h4>{t('prp.secBase')}</h4>
              <div className="prp-field">
                <label>{formInputs.find((i) => i.key === BASE_KEY)?.header ?? t('prp.base')}</label>
                <InputNumber size="large" style={{ width: '100%' }} addonAfter="VND" value={editing.values[BASE_KEY] ?? undefined} placeholder={t('prp.basePlaceholder')}
                  onChange={(v) => setEditing({ ...editing, values: { ...editing.values, [BASE_KEY]: v ?? 0 } })}
                  formatter={(v) => (v == null ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','))} parser={(v) => Number((v ?? '').replace(/,/g, ''))} />
              </div>
            </section>

            {formInputs.some((i) => i.key !== BASE_KEY && !FLAGS.has(i.key)) && (
              <section className="prp-sec">
                <h4>{t('prp.secFixed')}</h4>
                <div className="prp-grid">
                  {formInputs.filter((i) => i.key !== BASE_KEY && !FLAGS.has(i.key)).map((i) => (
                    <div key={i.key} className="prp-field">
                      <label>{i.header}</label>
                      <InputNumber style={{ width: '100%' }} value={editing.values[i.key] ?? undefined} placeholder="0"
                        onChange={(v) => setEditing({ ...editing, values: { ...editing.values, [i.key]: v ?? 0 } })}
                        formatter={(v) => (v == null ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','))} parser={(v) => Number((v ?? '').replace(/,/g, ''))} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {formInputs.some((i) => FLAGS.has(i.key)) && (
              <section className="prp-sec">
                <h4>{t('prp.secFlags')}</h4>
                <div className="prp-flags">
                  {formInputs.filter((i) => FLAGS.has(i.key)).map((i) => (
                    <Tooltip key={i.key} title={i.label}>
                      <label className="prp-flag">
                        <Switch size="small" checked={(editing.values[i.key] ?? 0) !== 0} onChange={(v) => setEditing({ ...editing, values: { ...editing.values, [i.key]: v ? 1 : 0 } })} />
                        <span>{i.header}</span>
                      </label>
                    </Tooltip>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </AppModal>

      <Modal open={bootOpen} title={t('prp.bootstrap')} onCancel={() => setBootOpen(false)} okText={t('prp.bootstrapGo')} okButtonProps={{ loading: doBootstrap.isPending, disabled: period.trim().length < 6 }} onOk={() => doBootstrap.mutate()}>
        <Typography.Paragraph>{t('prp.bootstrapHelp')}</Typography.Paragraph>
        {periods.data && periods.data.length > 0
          ? <Select style={{ width: 200 }} value={period || undefined} placeholder={t('prp.pickPeriod')} onChange={setPeriod} options={periods.data.map((p) => ({ value: p.period, label: `${p.period} · ${p.rows} ${t('prp.slips')}` }))} />
          : <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="MM/yyyy" style={{ width: 160 }} />}
      </Modal>

      <Modal open={!!prev} title={t('prp.previewTitle')} onCancel={() => setPrev(null)} destroyOnHidden okText={t('prp.confirm', { n: prev?.rows ?? 0 })} okButtonProps={{ loading: commit.isPending, disabled: !prev || prev.rows === 0 }} onOk={() => commit.mutate()}>
        {prev && (
          <>
            {prev.rows === 0 && prev.errors.length === 0 && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('prp.noneTitle')} description={t('prp.noneText')} />}
            <Typography.Paragraph>{t('prp.previewText', { rows: prev.rows, added: prev.new, updated: prev.updated, unknown: prev.unknown })}</Typography.Paragraph>
            <IssueList title={t('pay.imp.errors')} type="error" items={prev.errors} issueKey="prl.issue" />
            <IssueList title={t('pay.imp.warnings')} type="warning" items={prev.warnings} issueKey="prl.issue" />
          </>
        )}
      </Modal>
    </div>
  )
}
