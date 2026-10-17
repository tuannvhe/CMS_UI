import { useState } from 'react'
import { Alert, Button, DatePicker, Descriptions, Input, Select, Skeleton, Space, Tag } from 'antd'
import { UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { AppModal } from '../../components/AppModal'
import { apiErrorCode } from '../../api/requests'
import { BLOCKING_ISSUES, EVALUATION_TYPES, evaluations } from '../../api/evaluations'
import { useToast } from '../../hooks/useToast'
import { issueColor } from './EvaluationReviewModal'

const ROUND_COLOR = ['', 'green', 'blue', 'purple', 'orange', 'red']

/**
 * HR tạo đơn đánh giá cho đúng MỘT người, kể cả khi hệ thống chưa xếp người đó "đến hạn":
 * nhập mã nhân viên → chọn loại đánh giá và ngày → xem trước line / cảnh báo → tạo đơn. Line dùng mặc định của bộ phận; muốn đổi thì sửa ở màn Rà soát line.
 */
export function EvaluationManualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState<string>()
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [error, setError] = useState('')

  const lookup = useQuery({ queryKey: ['evaluations', 'manual-lookup', employeeId], queryFn: () => evaluations.manualLookup(employeeId), enabled: open && !!employeeId, retry: false, gcTime: 0 })
  const effectiveType = type ?? lookup.data?.suggestedType
  const body = employeeId && effectiveType ? { employeeId, typeRate: effectiveType, dateRate: date.format('YYYY-MM-DD') } : null
  const preview = useQuery({ queryKey: ['evaluations', 'manual-review', body], queryFn: () => evaluations.manualReview(body!), enabled: open && !!body && !!lookup.data, retry: false, gcTime: 0 })

  const close = () => { setCode(''); setEmployeeId(''); setType(undefined); setDate(dayjs()); setError(''); onClose() }
  const create = useMutation({
    mutationFn: () => evaluations.manualRegister(body!),
    onSuccess: (r) => {
      if (r.created > 0) { toast.success(t('eva.regResult', { n: r.created, rounds: r.rounds })); qc.invalidateQueries({ queryKey: ['evaluations'] }); close() }
      else setError(t(`evaM.issue.${r.skipped[0]?.reason}`, { defaultValue: t(`eva.regSkip.${r.skipped[0]?.reason}`, { defaultValue: r.skipped[0]?.reason ?? t('req.err.generic') }) }))
    },
    onError: (e) => {
      const { code: c, detail } = apiErrorCode(e)
      setError(c === 'invalid_input' ? t(`eva.regErr.${detail}`, { defaultValue: t('req.err.invalid_input') }) : t('req.err.generic'))
    },
  })

  const emp = lookup.data?.employee
  const row = preview.data
  const blocked = !row || row.issues.some((i) => BLOCKING_ISSUES.includes(i))
  const label = (i: string) => t(`eva.issue.${i}`, { defaultValue: t(`evaM.issue.${i}`, { defaultValue: i }) })

  return (
    <AppModal open={open} onClose={close} size="lg" icon={<UserAddOutlined />} title={t('evaM.title')} subtitle={t('evaM.subtitle')}
      onOk={() => { setError(''); create.mutate() }} okText={t('evaM.create')} okDisabled={blocked || preview.isFetching} okLoading={create.isPending}>
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <Space.Compact style={{ width: '100%' }}>
          <Input allowClear placeholder={t('eva.employeeId')} value={code} onChange={(e) => setCode(e.target.value)} onPressEnter={() => { setEmployeeId(code.trim()); setType(undefined); setError('') }} maxLength={50} />
          <Button type="primary" onClick={() => { setEmployeeId(code.trim()); setType(undefined); setError('') }}>{t('common.search')}</Button>
        </Space.Compact>

        {lookup.isFetching && <Skeleton active paragraph={{ rows: 2 }} />}
        {lookup.isError && <Alert type="error" showIcon title={t('evaM.notFound')} />}
        {emp && (
          <>
            <Descriptions size="small" column={2} bordered items={[
              { key: 'n', label: t('eva.fullName'), children: <b>{emp.fullName}</b> },
              { key: 'd', label: t('eva.department'), children: emp.department },
              { key: 'p', label: t('eva.position'), children: emp.position },
              { key: 's', label: t('eva.startWork'), children: emp.startWork ? dayjs(emp.startWork).format('DD/MM/YYYY') : '—' },
              { key: 'e', label: t('evaM.existing'), span: 2, children: lookup.data!.existing.length === 0 ? '—' : lookup.data!.existing.map((e) => <Tag key={`${e.typeRate}${e.dateRate}`}>{e.typeRate} · {dayjs(e.dateRate).format('DD/MM/YYYY')}</Tag>) },
            ]} />
            <Space wrap>
              <Select style={{ width: 340 }} value={effectiveType} onChange={setType} options={EVALUATION_TYPES.map((x) => ({ value: x, label: x }))} />
              <DatePicker format="DD/MM/YYYY" allowClear={false} value={date} onChange={(d) => d && setDate(d)} />
            </Space>
            {preview.isFetching ? <Skeleton active paragraph={{ rows: 2 }} /> : row && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('eva.lineCol')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {row.line.length === 0 && <span style={{ color: 'var(--c-muted)' }}>—</span>}
                  {row.line.map((l) => (
                    <Tag key={`${l.round}-${l.userId}`} color={l.active === false ? 'error' : ROUND_COLOR[l.round] ?? 'default'} variant="filled">
                      {t('line.roundN', { n: l.round })}: {l.userId === row.employeeId ? t('eva.lineSelf') : (l.fullName ?? l.userId)}
                    </Tag>
                  ))}
                </div>
                {row.issues.length === 0
                  ? <Alert type="success" showIcon title={t('eva.reviewOk')} />
                  : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{row.issues.map((i) => <Tag key={i} color={issueColor(i)} variant="filled">{label(i)}</Tag>)}</div>}
              </div>
            )}
          </>
        )}
        {error && <Alert type="error" showIcon title={error} />}
      </Space>
    </AppModal>
  )
}
