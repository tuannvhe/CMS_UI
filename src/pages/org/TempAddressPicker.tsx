import { useState } from 'react'
import { Button, Input, Popover, Select, Space } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { idCards } from '../../api/idCards'
import { foldFilter } from '../../utils/search'

/**
 * Chọn nơi tạm trú theo dạng danh sách: chọn Tỉnh và Xã / Phường (đơn vị hành chính sau sáp nhập), chỉ gõ phần số nhà / ngõ;
 * bấm Áp dụng thì ô nhận chuỗi "số nhà / ngõ, xã, tỉnh". Vẫn gõ hoặc dán thẳng vào ô được.
 */
export default function TempAddressPicker({ value, onApply }: { value: string; onApply: (v: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [province, setProvince] = useState<string>()
  const [ward, setWard] = useState<string>()
  const [street, setStreet] = useState('')
  const provinces = useQuery({ queryKey: ['idc-addr', 'provinces'], queryFn: idCards.provinces, staleTime: Infinity, enabled: open })
  const wards = useQuery({ queryKey: ['idc-addr', 'wards', province], queryFn: () => idCards.wards(province!), staleTime: Infinity, enabled: open && !!province })

  const onOpen = (v: boolean) => {
    setOpen(v)
    if (v) { setProvince(undefined); setWard(undefined); setStreet(value.includes(',') ? value.split(',')[0].trim() : value.trim()) }   // lấy lại phần số nhà / ngõ đã gõ
  }
  const apply = () => {
    const p = provinces.data?.find((x) => x.code === province)?.name
    const w = wards.data?.find((x) => x.code === ward)?.name
    onApply([street.trim(), w, p].filter(Boolean).join(', '))
    setOpen(false)
  }
  const filter = foldFilter('label')

  return (
    <Popover trigger="click" open={open} onOpenChange={onOpen} placement="bottomRight" destroyTooltipOnHide
      content={(
        <Space direction="vertical" style={{ width: 300 }}>
          <Input autoFocus placeholder={t('idc.tempStreet')} value={street} maxLength={120} onChange={(e) => setStreet(e.target.value)} onPressEnter={apply} />
          <Select showSearch style={{ width: '100%' }} placeholder={t('idc.tempProvince')} loading={provinces.isLoading} value={province} optionFilterProp="label" filterOption={filter}
            onChange={(v) => { setProvince(v); setWard(undefined) }} options={(provinces.data ?? []).map((p) => ({ value: p.code, label: p.name }))} />
          <Select showSearch style={{ width: '100%' }} placeholder={t('idc.tempWard')} disabled={!province} loading={wards.isLoading} value={ward} optionFilterProp="label" filterOption={filter}
            onChange={setWard} options={(wards.data ?? []).map((w) => ({ value: w.code, label: w.name }))} />
          <Button type="primary" block disabled={!street.trim() && !province} onClick={apply}>{t('idc.tempApply')}</Button>
        </Space>
      )}>
      <Button type="text" size="small" tabIndex={-1} aria-label={t('idc.tempPick')} title={t('idc.tempPick')} icon={<EnvironmentOutlined />} />
    </Popover>
  )
}
