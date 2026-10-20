import { Select, Space, Steps } from 'antd'
import { useTranslation } from 'react-i18next'

/** Số người duyệt tối thiểu của đơn nhiều cấp (quên vân tay, tăng ca, nghỉ phép). */
export const MIN_APPROVERS = 2

interface Props {
  /** Số cấp duyệt tối đa (3 hoặc 4); tên hiển thị là "Người duyệt 1, 2, 3…" */
  count: number
  values: (string | undefined)[]
  onChange: (next: (string | undefined)[]) => void
  options: (index: number, value?: string) => { value: string; label: string }[]
  /** Chưa chọn được (ví dụ chưa có bộ phận) */
  disabled?: boolean
}

/**
 * Chọn người duyệt tăng dần: ban đầu chỉ có "Người duyệt 1"; chọn xong mới hiện thêm "Người duyệt 2", rồi 3 (và 4) tới mức tối đa của loại đơn.
 * Có thanh tiến trình theo các cấp đang hiện. Xoá một cấp thì các cấp sau cũng bị xoá (không còn cấp sau mà thiếu cấp trước).
 */
export function ApproverChain({ count, values, onChange, options, disabled }: Props) {
  const { t } = useTranslation()
  const lastFilled = values.slice(0, count).reduce((m, v, i) => (v ? i : m), -1)
  const visible = Math.min(count, Math.max(MIN_APPROVERS, lastFilled + 2))   // luôn hiện đủ số cấp tối thiểu; sau đó các cấp đã chọn + 1 cấp kế tiếp
  const chosen = values.slice(0, count).filter(Boolean).length
  const labels = Array.from({ length: visible }, (_, i) => t('req.approverLevel', { n: i + 1 }))
  const current = labels.findIndex((_, i) => !values[i])
  const set = (i: number, v: string | undefined) => {
    const next = Array.from({ length: count }, (_, j) => values[j])
    next[i] = v
    if (!v) for (let j = i + 1; j < count; j++) next[j] = undefined
    onChange(next)
  }
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
      <Steps size="small" titlePlacement="vertical" current={current === -1 ? visible : current}
        items={labels.map((l, i) => ({ title: l, status: values[i] ? 'finish' : i === current ? 'process' : 'wait' }))} />
      <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('req.chainDone', { n: chosen, total: count })}</div>
      {labels.map((label, i) => (
        <Select key={i} style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" value={values[i]} disabled={disabled}
          placeholder={label} onChange={(v) => set(i, v)} options={options(i, values[i])} />
      ))}
    </Space>
  )
}
