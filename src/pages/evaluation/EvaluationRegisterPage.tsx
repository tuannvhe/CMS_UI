import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Checkbox, DatePicker, Input, Select, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FormOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { evaluations, type EvaluationCandidate, type LineRound } from '../../api/evaluations'
import { EvaluationLineModal } from './EvaluationLineModal'
import { EvaluationReviewModal } from './EvaluationReviewModal'
import { apiErrorCode } from '../../api/requests'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

const key = (c: EvaluationCandidate) => `${c.employeeId}|${c.dateRate.slice(0, 10)}`

/** HR đăng ký đánh giá hợp đồng: tìm nhân viên đến hạn → chọn → hệ thống tạo các vòng đánh giá và bảng điểm như màn cũ (RegisterPeopleNeedRate). */
export default function EvaluationRegisterPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [department, setDepartment] = useState<string>()
  const [employeeId, setEmployeeId] = useState('')
  const [dateRate, setDateRate] = useState<Dayjs | null>(null)
  // "Quá hạn lâu": mốc đã quá hạn hơn 60 ngày mà chưa có đơn (bị bỏ sót nên không hiện ở danh sách thường)
  const [overdue, setOverdue] = useState(!!searchParams.get('overdue'))
  // Mở từ thông báo (?auto=1): tự tìm sẵn toàn bộ nhân viên đến hạn để HR thấy ngay danh sách cần tạo đơn
  const [params, setParams] = useState<{ department?: string; employeeId?: string; dateRate?: string; overdue?: boolean } | null>(searchParams.get('auto') || searchParams.get('overdue') ? { overdue: !!searchParams.get('overdue') || undefined } : null)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [custom, setCustom] = useState<Record<string, LineRound[]>>({})
  const [dates, setDates] = useState<Record<string, string>>({})   // ngày đánh giá chỉnh tay theo từng nhân viên
  const [editing, setEditing] = useState<EvaluationCandidate | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  // Nhớ các nhân viên đã từng hiện ra để lựa chọn không mất khi lọc/tìm lại (chọn xuyên nhiều lần tìm kiếm)
  const [known, setKnown] = useState<Record<string, EvaluationCandidate>>({})

  const parts = useQuery({ queryKey: ['evaluations', 'parts'], queryFn: evaluations.parts, staleTime: 30_000, refetchOnMount: 'always' })
  const list = useQuery({ queryKey: ['evaluations', 'candidates', params], queryFn: () => evaluations.candidates(params!), enabled: !!params })

  useEffect(() => {
    if (list.data?.length) setKnown((p) => { const n = { ...p }; list.data!.forEach((c) => { n[key(c)] = c }); return n })
  }, [list.data])

  const search = (od: boolean = overdue) => {
    setError('')
    setParams({ department: department || undefined, employeeId: employeeId.trim() || undefined, dateRate: dateRate?.format('YYYY-MM-DD'), overdue: od || undefined })
  }

  const toast = useToast()
  const register = useMutation({
    mutationFn: () => evaluations.register(selected.map((k) => { const [employeeId, dateRate] = k.split('|'); return { employeeId, dateRate, line: custom[k], newDateRate: dates[k] } })),
    onSuccess: (r) => {
      setReviewOpen(false); setSelected([]); setCustom({}); setDates({}); setKnown({}); setError(''); qc.invalidateQueries({ queryKey: ['evaluations'] })
      if (r.skipped.length > 0) toast.warning(t('eva.regPartial', { n: r.created, skipped: r.skipped.length }))
      else toast.success(t('eva.regResult', { n: r.created, rounds: r.rounds }))
    },
    onError: (e) => {
      const { code, detail } = apiErrorCode(e)
      const text = code === 'forbidden' ? t('eva.err.forbidden') : code === 'invalid_input' ? t(`eva.regErr.${detail}`, { defaultValue: t('req.err.invalid_input') }) : t('req.err.generic')
      setError(text); toast.error(text)
    },
  })
  const result = register.data

  const columns: ColumnsType<EvaluationCandidate> = [
    { title: t('eva.employeeId'), dataIndex: 'employeeId', width: 110 },
    { title: t('eva.fullName'), dataIndex: 'fullName', width: 200 },
    { title: t('eva.department'), dataIndex: 'department', width: 220 },
    { title: t('eva.position'), dataIndex: 'position', width: 100 },
    { title: t('eva.startWork'), dataIndex: 'startWork', width: 120, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '') },
    { title: t('eva.typeRate'), dataIndex: 'typeRate', width: 260, render: (v: string) => <Tag color="green" variant="filled">{v}</Tag> },
    {
      title: t('eva.dateRate'), dataIndex: 'dateRate', width: 150,
      render: (v: string, c: EvaluationCandidate) => (dates[key(c)]
        ? <Space size={4} orientation="vertical" style={{ lineHeight: 1.2 }}><b>{dayjs(dates[key(c)]).format('DD/MM/YYYY')}</b><span style={{ fontSize: 11, color: 'var(--c-muted)', textDecoration: 'line-through' }}>{dayjs(v).format('DD/MM/YYYY')}</span></Space>
        : dayjs(v).format('DD/MM/YYYY')),
    },
    {
      title: t('eva.daysLeft'), dataIndex: 'daysLeft', width: 130, align: 'right',
      render: (v: number | null) => (v == null ? '' : v < 0 ? <Tag color="error" variant="filled">{t('eva.overdueDays', { n: -v })}</Tag> : v),
    },
    {
      title: t('eva.lineCol'), width: 190,
      render: (_: unknown, c: EvaluationCandidate) => (
        <Space size={6}>
          <Button size="small" onClick={() => setEditing(c)}>{t('eva.lineEdit')}</Button>
          {(custom[key(c)] || dates[key(c)]) && <Tag color="orange" variant="filled">{t('eva.lineCustom')}</Tag>}
        </Space>
      ),
    },
  ]

  const skipText = (s: { employeeId: string; reason: string }) => `${s.employeeId}: ${t(`eva.regSkip.${s.reason}`, { defaultValue: s.reason })}`

  return (
    <div className="page wide">
      <PageBanner
        avatar={<Avatar size={56} icon={<FormOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.evaluationRegister')}
        subtitle={t('nav.evaluationRegisterDesc')}
        chips={[`1 · ${t('eva.regStep1')}`, `2 · ${t('eva.regStep2')}`, `3 · ${t('eva.regStep3')}`]}
      />
      <Alert type="info" showIcon title={t('eva.regNote')} style={{ marginBottom: 16 }} />

      {result && (
        <Alert
          style={{ marginBottom: 16 }} showIcon closable onClose={() => register.reset()}
          type={result.created > 0 ? (result.skipped.length ? 'warning' : 'success') : 'error'}
          title={t('eva.regResult', { n: result.created, rounds: result.rounds })}
          description={result.skipped.length > 0 ? result.skipped.map(skipText).join(' · ') : undefined}
        />
      )}
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <DataTable<EvaluationCandidate>
        rowKey={key} loading={list.isFetching} columns={columns} dataSource={list.data ?? []}
        rowSelection={{ selectedRowKeys: selected, preserveSelectedRowKeys: true, onChange: (k) => setSelected(k as string[]) }}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: params ? (list.isError ? t('req.err.generic') : t('eva.regEmpty')) : t('eva.regPrompt') }}
        toolbar={(
          <Space wrap>
            <Select showSearch allowClear style={{ width: 260 }} placeholder={t('req.deptPlaceholder')} value={department} onChange={setDepartment}
              loading={parts.isLoading} options={(parts.data ?? []).map((p) => ({ value: p, label: p }))} />
            <Input allowClear style={{ width: 150 }} placeholder={t('eva.employeeId')} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} onPressEnter={() => search()} />
            <DatePicker format="DD/MM/YYYY" placeholder={t('eva.dateRate')} value={dateRate} onChange={setDateRate} />
            <Tooltip title={t('eva.overdueLongTip')}>
              <Checkbox checked={overdue} onChange={(e) => { setOverdue(e.target.checked); search(e.target.checked) }}>{t('eva.overdueLong')}</Checkbox>
            </Tooltip>
            <Button icon={<SearchOutlined />} onClick={() => search()} loading={list.isFetching}>{t('common.search')}</Button>
            <Typography.Text type="secondary">{t('eva.regCount', { n: list.data?.length ?? 0, sel: selected.length })}</Typography.Text>
<Button disabled={selected.length === 0} onClick={() => setSelected([])}>{t('eva.regClear')}</Button>
            <Button disabled={selected.length === 0} onClick={() => setBulkOpen(true)}>{t('eva.regBulk')} ({selected.length})</Button>
            <Button type="primary" disabled={selected.length === 0} onClick={() => setReviewOpen(true)}>{t('eva.regReview')} ({selected.length})</Button>
          </Space>
        )}
      />
      <EvaluationLineModal
        subject={editing} current={editing ? custom[key(editing)] : undefined} currentDate={editing ? dates[key(editing)] : undefined} onClose={() => setEditing(null)}
        onSave={(line, d) => {
          if (!editing) return
          const k = key(editing)
          setCustom((p) => { const n = { ...p }; if (line) n[k] = line; else delete n[k]; return n })
          setDates((p) => { const n = { ...p }; if (d) n[k] = d; else delete n[k]; return n })
        }}
      />
      <EvaluationLineModal
        subject={bulkOpen ? (known[selected[0]] ?? null) : null} current={bulkOpen && selected[0] ? custom[selected[0]] : undefined} currentDate={bulkOpen && selected[0] ? dates[selected[0]] : undefined} bulkCount={selected.length} onClose={() => setBulkOpen(false)}
        onSave={(line, d) => {
          const tpl = known[selected[0]]
          if (!tpl) return
          setCustom((p) => {
            const n = { ...p }
            selected.forEach((k) => {
              const emp = k.split('|')[0]
              // vòng tự đánh giá của mẫu được áp cho từng người bằng chính mã của họ
              if (line) n[k] = line.map((r) => (r.userId === tpl.employeeId ? { ...r, userId: emp } : r)); else delete n[k]
            })
            return n
          })
          setDates((p) => { const n = { ...p }; selected.forEach((k) => { if (d) n[k] = d; else delete n[k] }); return n })
        }}
      />
      <EvaluationReviewModal
        open={reviewOpen} onClose={() => setReviewOpen(false)} loading={register.isPending} onConfirm={() => register.mutate()}
        items={selected.map((k) => { const [employeeId, dateRate] = k.split('|'); return { employeeId, dateRate, line: custom[k], newDateRate: dates[k] } })}
        onEdit={(employeeId, dateRate) => setEditing(known[`${employeeId}|${dateRate}`] ?? null)}
      />
    </div>
  )
}
