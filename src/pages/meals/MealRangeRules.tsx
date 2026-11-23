import { useEffect, useState } from 'react'
import { Alert, Button, Card, Select, Space, Tag } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { mealRegister } from '../../api/meals'
import { useToast } from '../../hooks/useToast'

/**
 * Tab cấu hình (người duyệt suất ăn): bộ phận KHÔNG được đăng ký theo khoảng ngày, chỉ đăng ký từng ngày (ví dụ bộ phận sản xuất).
 * Chọn trong danh sách bộ phận hoặc gõ tên mới. Chưa thêm bộ phận nào thì hệ thống dùng mặc định: tên có "production" / "sản xuất".
 */
export function MealRangeRules({ departments, saved }: { departments: string[]; saved: string[] }) {
  const { t } = useTranslation()
  const message = useToast()
  const qc = useQueryClient()
  const [value, setValue] = useState<string[]>(saved)
  useEffect(() => { setValue(saved) }, [saved])
  const dirty = value.length !== saved.length || value.some((v) => !saved.includes(v))
  const save = useMutation({
    mutationFn: () => mealRegister.setRangeExcluded(value),
    onSuccess: () => { message.success(t('mealReg.rulesSaved')); qc.invalidateQueries({ queryKey: ['meal-range-excluded'] }) },
    onError: () => message.error(t('req.err.generic')),
  })
  return (
    <Card title={t('mealReg.rulesTitle')} extra={<Button type="primary" icon={<SaveOutlined />} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>{t('mealReg.rulesSave')}</Button>}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert type="info" showIcon title={t('mealReg.rulesHint')} />
        {saved.length === 0 && <Alert type="warning" showIcon title={t('mealReg.rulesDefault')} />}
        <Select mode="tags" style={{ width: '100%' }} value={value} onChange={(v) => setValue(v.map((x) => x.trim()).filter(Boolean))} placeholder={t('mealReg.rulesPh')}
          options={departments.map((d) => ({ value: d, label: d }))} tokenSeparators={[';']} maxTagTextLength={60} />
        <div className="cell-muted">{t('mealReg.rulesCount', { n: value.length })}</div>
        {value.length > 0 && <Space wrap>{value.map((d) => <Tag key={d}>{d}</Tag>)}</Space>}
      </Space>
    </Card>
  )
}
