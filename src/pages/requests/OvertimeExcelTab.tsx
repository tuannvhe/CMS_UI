import { useMemo, useState } from 'react'
import { Alert, Button, Card, Col, DatePicker, Input, Row, Select, Space, Switch, Tag, TimePicker, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { apiError } from '../../api/healthLeave'
import { lookups, type ApproversInput } from '../../api/requests'
import { overtimeImport, type OvertimeImportPreview, type OvertimeImportResult, type OvertimePreviewRow } from '../../api/overtimeImport'
import { ApproverEmailWarning, approverOption, noEmailNames } from '../../components/ApproverEmailWarning'
import { ApproverChain, MIN_APPROVERS } from '../../components/ApproverChain'
import { DataTable } from '../../components/DataTable'
import { StatTiles } from '../../components/StatTiles'
import { useToast } from '../../hooks/useToast'
import { fmtDate } from '../../utils/format'

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

/** Ca ngày / ca đêm trong danh mục ca: ưu tiên mã S01 / S02 (như hệ thống cũ), nếu không có thì theo tên ca. */
function pickShift(options: { value: string; label: string }[] | undefined, night: boolean) {
  const list = options ?? []
  return (night
    ? list.find((o) => o.value.toUpperCase() === 'S02') ?? list.find((o) => plain(o.label).includes('dem'))
    : list.find((o) => o.value.toUpperCase() === 'S01') ?? list.find((o) => plain(o.label).includes('ngay')))?.value
}

/**
 * Đăng ký tăng ca hàng loạt bằng Excel cho ca ngày hoặc ca đêm: chọn file → xem lại (mã nhân viên không có trong hệ thống được tô đỏ, thiếu giờ / lý do tô vàng)
 * → chọn ngày, người duyệt, giờ và lý do mặc định cho ô trống → tạo đơn NHÁP, rồi gửi duyệt ở tab Đăng ký như bình thường.
 */
export default function OvertimeExcelTab({ night, onGoRegister }: { night: boolean; onGoRegister: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [preview, setPreview] = useState<OvertimeImportPreview | null>(null)
  const [result, setResult] = useState<OvertimeImportResult | null>(null)
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [date, setDate] = useState<Dayjs | null>(null)
  const [department, setDepartment] = useState<string>()
  const [apOne, setApOne] = useState<string>()
  const [apTwo, setApTwo] = useState<string>()
  const [apThree, setApThree] = useState<string>()
  const [defFrom, setDefFrom] = useState<Dayjs | null>(null)
  const [defTo, setDefTo] = useState<Dayjs | null>(null)
  const [defReason, setDefReason] = useState('')

  const staleLong = 10 * 60 * 1000
  const departments = useQuery({ queryKey: ['req', 'departments'], queryFn: lookups.departments, staleTime: staleLong })
  const shifts = useQuery({ queryKey: ['req', 'shifts'], queryFn: lookups.shifts, staleTime: staleLong })
  const approvers = useQuery({ queryKey: ['req', 'approvers', department], queryFn: () => lookups.approvers(department!), enabled: !!department, staleTime: 60_000 })
  const shift = pickShift(shifts.data, night)

  const errText = (e: unknown) => {
    const { code, detail } = apiError(e)
    if (code === 'too_large') return t('cls.err.too_large')
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'bad_file') return t(`oti.err.bad_${detail}`, { defaultValue: t('cls.err.bad_file') })
    if (code === 'no_approver') return t('req.err.no_approver')
    if (code === 'invalid_input') return `${t('req.err.invalid_input')}${detail ? ` (${detail})` : ''}`
    return t('cls.err.generic')
  }

  const doPreview = useMutation({
    mutationFn: overtimeImport.preview,
    onSuccess: (p) => { setResult(null); setPreview(p); setDate(p.titleDate ? dayjs(p.titleDate) : dayjs()) },
    onError: (e) => msg.error(errText(e)),
  })
  const approversInput: ApproversInput = useMemo(() => {
    const pick = (userId?: string) => (userId ? { userId, name: approvers.data?.find((a) => a.userId === userId)?.name } : undefined)
    return { one: pick(apOne), two: pick(apTwo), three: pick(apThree) }
  }, [apOne, apTwo, apThree, approvers.data])
  const commit = useMutation({
    mutationFn: () => overtimeImport.commit({
      token: preview!.token, date: fmtDate(date!), shift: shift!, approvers: approversInput,
      defaultFrom: defFrom?.format('HH:mm'), defaultTo: defTo?.format('HH:mm'), defaultReason: defReason.trim() || undefined,
    }),
    onSuccess: (r) => { setResult(r); setPreview(null); qc.invalidateQueries({ queryKey: ['req', 'drafts', 'overtime'] }); if (r.created > 0) msg.success(t('req.createdCount', { n: r.created })); else msg.warning(t('req.createdNone')) },
    onError: (e) => { msg.error(errText(e)); if (apiError(e).code === 'expired') setPreview(null) },
  })

  const problem = (r: OvertimePreviewRow) => !r.known || !!r.issue || !r.timeFrom || !r.timeTo || !r.reason
  const rows = useMemo(() => (preview?.rows ?? []).filter((r) => !onlyProblems || problem(r)), [preview, onlyProblems])
  const defaultsCover = (r: OvertimePreviewRow) => (!!r.timeFrom || !!defFrom) && (!!r.timeTo || !!defTo) && (!!r.reason || !!defReason.trim())
  const usable = (preview?.rows ?? []).filter((r) => r.known && !r.issue && defaultsCover(r)).length
  const approverOptions = (approvers.data ?? []).map(approverOption)
  const canCommit = !!preview && !!date && !!shift && usable > 0 && [apOne, apTwo, apThree].filter(Boolean).length >= MIN_APPROVERS

  const columns: ColumnsType<OvertimePreviewRow> = [
    { title: t('oti.row'), dataIndex: 'excelRow', width: 60, align: 'center' },
    { title: t('att.empId'), dataIndex: 'employeeId', width: 120 },
    { title: t('att.name'), dataIndex: 'fullName', width: 200, ellipsis: true },
    { title: 'Part', dataIndex: 'part', width: 90 },
    { title: 'Cell line', dataIndex: 'cellLine', width: 130, ellipsis: true },
    { title: t('oti.process'), dataIndex: 'process', width: 120, ellipsis: true },
    { title: t('req.otFrom'), dataIndex: 'timeFrom', width: 90, align: 'center', render: (v: string | null) => v ?? <Typography.Text type="secondary">{defFrom ? defFrom.format('HH:mm') : '—'}</Typography.Text> },
    { title: t('req.otTo'), dataIndex: 'timeTo', width: 90, align: 'center', render: (v: string | null) => v ?? <Typography.Text type="secondary">{defTo ? defTo.format('HH:mm') : '—'}</Typography.Text> },
    { title: t('req.reason'), dataIndex: 'reason', ellipsis: { showTitle: true }, render: (v: string | null) => v ?? <Typography.Text type="secondary">{defReason.trim() || '—'}</Typography.Text> },
    {
      title: t('aud.status'), width: 190,
      render: (_: unknown, r) => (
        <Space size={4} wrap>
          {!r.known && <Tag color="red">{t('oti.unknown')}</Tag>}
          {r.issue && <Tag color="red">{t('oti.timeInvalid')}</Tag>}
          {r.known && !r.issue && !defaultsCover(r) && <Tag color="orange">{t('oti.incomplete')}</Tag>}
          {r.known && !r.issue && defaultsCover(r) && <Tag color="green">OK</Tag>}
        </Space>
      ),
    },
  ]

  const skipText = (s: { employeeId: string; reason: string; detail?: string | null }) => `${s.employeeId}: ${t(`req.skip.${s.reason}`, { detail: s.detail ?? '', defaultValue: t(`oti.skip.${s.reason}`, { defaultValue: s.reason }) })}`

  if (result) {
    return (
      <Card>
        <Alert type={result.created > 0 ? 'success' : 'warning'} showIcon style={{ marginBottom: 12 }}
          title={t('oti.done', { n: result.created, g: result.groups })} description={result.created > 0 ? t('oti.doneHint') : undefined} />
        {result.skipped.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`${t('oti.skippedTitle')} (${result.skipped.length})`}
            description={<ul style={{ margin: 0, paddingLeft: 18 }}>{result.skipped.slice(0, 15).map((s, i) => <li key={i}>{skipText(s)}</li>)}{result.skipped.length > 15 && <li>…</li>}</ul>} />
        )}
        <Space>
          {result.created > 0 && <Button type="primary" onClick={onGoRegister}>{t('oti.goSubmit')}</Button>}
          <Button onClick={() => setResult(null)}>{t('oti.another')}</Button>
        </Space>
      </Card>
    )
  }

  if (!preview) {
    return (
      <Card>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t(night ? 'oti.noteNight' : 'oti.noteDay')} description={t('oti.note')} />
        <Space style={{ marginBottom: 12 }}>
          <Button icon={<DownloadOutlined />} onClick={() => overtimeImport.template(night).catch(() => msg.error(t('att.exportFailed')))}>{t('oti.template')}</Button>
        </Space>
        <Upload.Dragger accept=".xlsx" maxCount={1} showUploadList={false} disabled={doPreview.isPending}
          beforeUpload={(f) => { doPreview.mutate(f); return false }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>{t('oti.drop')}</p>
        </Upload.Dragger>
      </Card>
    )
  }

  return (
    <>
      <StatTiles items={[
        { label: t('oti.tileRows'), value: preview.totalRows, color: '#2F6FB0' },
        { label: t('oti.tileUnknown'), value: preview.unknown, color: preview.unknown ? '#D92D20' : '#2E9E4F' },
        { label: t('oti.tileMissingTime'), value: preview.missingTime, color: preview.missingTime ? '#D48806' : '#2E9E4F' },
        { label: t('oti.tileMissingReason'), value: preview.missingReason, color: preview.missingReason ? '#D48806' : '#2E9E4F' },
      ]} />
      {preview.errors.length > 0 && <Alert type="error" showIcon style={{ margin: '12px 0' }} title={`${t('oti.errors')} (${preview.errors.length})`}
        description={<ul style={{ margin: 0, paddingLeft: 18 }}>{preview.errors.slice(0, 8).map((e, i) => <li key={i}>{t('cls.row', { n: e.excelRow })}: {t(`oti.issue.${e.code}`, { defaultValue: e.code })}</li>)}</ul>} />}
      {preview.warnings.length > 0 && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title={`${t('oti.warnings')} (${preview.warnings.length})`}
        description={<ul style={{ margin: 0, paddingLeft: 18 }}>{preview.warnings.slice(0, 8).map((e, i) => <li key={i}>{t('cls.row', { n: e.excelRow })}: {t(`oti.issue.${e.code}`, { defaultValue: e.code })} ({e.detail})</li>)}</ul>} />}

      <Card style={{ margin: '12px 0' }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={8}>
            <div className="req-step"><span className="n">1</span>{t('req.sectionTime')}</div>
            <Space orientation="vertical" style={{ width: '100%' }} size={8}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={date} onChange={setDate} placeholder={t('req.date')} />
              {preview.titleDate && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('oti.titleDate', { d: dayjs(preview.titleDate).format('DD/MM/YYYY') })}</Typography.Text>}
              <Tag color={night ? 'geekblue' : 'gold'}>{shifts.data?.find((s) => s.value === shift)?.label ?? (night ? t('oti.shiftNight') : t('oti.shiftDay'))}</Tag>
              {!shift && !shifts.isLoading && <Alert type="error" showIcon title={t('oti.noShift')} />}
              <Space.Compact style={{ width: '100%' }}>
                <TimePicker style={{ width: '50%' }} format="HH:mm" value={defFrom} onChange={setDefFrom} placeholder={t('oti.defFrom')} minuteStep={5} needConfirm={false} />
                <TimePicker style={{ width: '50%' }} format="HH:mm" value={defTo} onChange={setDefTo} placeholder={t('oti.defTo')} minuteStep={5} needConfirm={false} />
              </Space.Compact>
              <Input value={defReason} onChange={(e) => setDefReason(e.target.value)} placeholder={t('oti.defReason')} maxLength={500} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('oti.defHint')}</Typography.Text>
            </Space>
          </Col>
          <Col xs={24} md={10}>
            <div className="req-step"><span className="n">2</span>{t('req.sectionApprovers')}</div>
            <Space orientation="vertical" style={{ width: '100%' }} size={8}>
              <Select showSearch allowClear style={{ width: '100%' }} placeholder={t('req.deptPlaceholder')} value={department} onChange={(v) => { setDepartment(v); setApOne(undefined); setApTwo(undefined); setApThree(undefined) }}
                loading={departments.isLoading} options={(departments.data ?? []).map((d) => ({ value: d, label: d }))} />
              <ApproverChain count={3} values={[apOne, apTwo, apThree]} disabled={!department}
                onChange={([a, b, c]) => { setApOne(a); setApTwo(b); setApThree(c) }} options={() => approverOptions} />
              <ApproverEmailWarning names={noEmailNames(approvers.data, [apOne, apTwo, apThree])} />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <div className="req-step"><span className="n">3</span>{t('req.submit')}</div>
            <Space orientation="vertical" style={{ width: '100%' }} size={8}>
              <Typography.Text>{t('oti.willCreate', { n: usable, total: preview.totalRows })}</Typography.Text>
              <Button type="primary" block disabled={!canCommit} loading={commit.isPending} onClick={() => commit.mutate()}>{t('oti.createDrafts', { n: usable })}</Button>
              <Button block onClick={() => setPreview(null)}>{t('oti.chooseAnother')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <DataTable<OvertimePreviewRow>
        rowKey="excelRow" size="small" sticky={false} columns={columns} dataSource={rows} scroll={{ x: 1250 }} pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
        rowClassName={(r) => (!r.known || r.issue ? 'row-st-rejected ot-row-bad' : !defaultsCover(r) ? 'row-st-waiting ot-row-warn' : '')}
        toolbar={<Space><Switch checked={onlyProblems} onChange={setOnlyProblems} /> {t('oti.onlyProblems')}</Space>}
      />
    </>
  )
}
