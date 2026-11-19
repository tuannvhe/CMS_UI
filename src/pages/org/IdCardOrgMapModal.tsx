import { useMemo, useState } from 'react'
import { Alert, Button, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AppModal } from '../../components/AppModal'
import { useTranslation } from 'react-i18next'
import { idCardError, idCards, type OrgDeptOption } from '../../api/idCards'
import { useToast } from '../../hooks/useToast'
import { foldFilter, matchText } from '../../utils/search'
import { useErpMasters } from './erpMasters'

const VIA_COLOR: Record<string, string> = { link: 'blue', auto: 'green', none: 'red' }

/**
 * Hộp "Quy đổi ERP": mỗi Bộ phận / Team / Part của nhân sự (cây CMS) sẽ ghi sang bộ phận ERP nào khi đồng bộ.
 * Mặc định tự quy đổi theo bộ phận ERP của phần lớn người cùng nhóm đang có trong ERP; chọn tay thì lưu vào Tbl_ErpLink (Kind ORGDEPT).
 */
export default function IdCardOrgMapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const erpM = useErpMasters()
  const [q, setQ] = useState('')
  const [onlyNone, setOnlyNone] = useState(false)

  const erpOptions = useMemo(() => erpM.depts.map((d) => ({ value: d.seq, label: d.path })), [erpM.depts])
  const seqOf = useMemo(() => new Map(erpM.depts.map((d) => [d.name.trim().toLowerCase(), d.seq])), [erpM.depts])
  const rows = erpM.org.filter((o) => (!onlyNone || o.via === 'none') && (!q || matchText(q, o.value, o.erpDept ?? '')))

  const save = useMutation({
    mutationFn: ({ value, seq }: { value: string; seq: number | null }) => idCards.setOrgMap(value, seq),
    onSuccess: () => { msg.success(t('idcMap.saved')); qc.invalidateQueries({ queryKey: ['id-cards', 'erp-masters'] }) },
    onError: (e) => { const { code, detail } = idCardError(e); msg.error(detail || code || String(e)) },
  })

  return (
    <AppModal open={open} onClose={onClose} size="xl" icon={<ApartmentOutlined />} title={t('idcMap.title')} footer={<Button onClick={onClose}>{t('idc.close')}</Button>}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message={t('idcMap.hint')} />
        {erpM.loaded && !erpM.useOrg && <Alert type="warning" showIcon message={t('idcMap.noOrg')} />}
        <Space wrap>
          <Input.Search allowClear placeholder={t('idcMap.search')} style={{ width: 320 }} onSearch={(v) => setQ(v.trim())} onChange={(e) => { if (!e.target.value) setQ('') }} />
          <Button type={onlyNone ? 'primary' : 'default'} onClick={() => setOnlyNone(!onlyNone)}>{t('idcMap.onlyNone', { n: erpM.org.filter((o) => o.via === 'none').length })}</Button>
        </Space>
        <Table<OrgDeptOption> size="small" rowKey="value" dataSource={rows} loading={!erpM.loaded || save.isPending} pagination={{ pageSize: 50, showSizeChanger: false }} scroll={{ y: 460 }}
          columns={[
            { title: t('idcMap.col.org'), dataIndex: 'value', render: (v: string, r) => <span>{v}<Typography.Text type="secondary"> · {t('idcMap.emps', { n: r.employees })}</Typography.Text></span> },
            { title: t('idcMap.col.erp'), dataIndex: 'erpDept', width: 380, render: (_: unknown, r) => (
              <Select<number> showSearch allowClear style={{ width: '100%' }} options={erpOptions} filterOption={foldFilter('label')} placeholder={t('idcMap.pick')}
                value={r.erpDept ? seqOf.get(r.erpDept.trim().toLowerCase()) : undefined}
                onChange={(seq) => save.mutate({ value: r.value, seq: seq ?? null })} />) },
            { title: t('idcMap.col.via'), dataIndex: 'via', width: 190, render: (v: string, r) => (
              <Space size={4}>
                <Tag color={VIA_COLOR[v]}>{t(`idcMap.via.${v}`)}{v === 'auto' ? ` ${r.matched}/${r.employees}` : ''}</Tag>
                {v === 'link' && <Button size="small" type="link" onClick={() => save.mutate({ value: r.value, seq: null })}>{t('idcMap.reset')}</Button>}
              </Space>) },
          ]} />
      </Space>
    </AppModal>
  )
}
