import { useState } from 'react'
import { Alert, Button, DatePicker, Form, Modal, Popconfirm, Table, Upload } from 'antd'
import { DownloadOutlined, FileExcelOutlined, InboxOutlined, InfoCircleOutlined, SolutionOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { adminError } from '../../api/userAdmin'
import { ojt, type OjtCreateResult, type OjtImportResult, type OjtPerson } from '../../api/ojt'
import { OjtAvatar, PersonSelect, useOjtAvatars } from './OjtCommon'
import { OjtOverview } from './OjtTeamPage'

/** HR: lập kế hoạch OJT cho nhân viên mới (đã có tài khoản CMS), huỷ kế hoạch, cấu hình người duyệt OJT theo bộ phận. */
export default function OjtManagePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const ready = useQuery({ queryKey: ['ojt-ready'], queryFn: ojt.ready })
  const [form] = Form.useForm<{ employeeId: string; startDate?: { format: (f: string) => string } }>()
  const [imported, setImported] = useState<OjtImportResult | null>(null)
  const [last, setLast] = useState<OjtCreateResult | null>(null)
  const [picked, setPicked] = useState<OjtPerson | undefined>()
  const [openCreate, setOpenCreate] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const onError = (e: unknown) => { const { detail, code } = adminError(e); toast.error(t(`ojt.err.${detail || code}`, { defaultValue: t('ojt.err.generic') })) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ojt-team'] }) }

  const create = useMutation({
    mutationFn: (v: { employeeId: string; startDate?: { format: (f: string) => string } }) => ojt.create({ employeeId: v.employeeId, startDate: v.startDate?.format('YYYY-MM-DD') }),
    onSuccess: (r) => { setLast(r); setPicked(undefined); form.resetFields(); setOpenCreate(false); toast.success(t('ojt.created')); refresh() },
    onError,
  })

  const photos = useOjtAvatars([picked?.id])
  const upload = useMutation({ mutationFn: (f: File) => ojt.importPlans(f), onSuccess: (r) => { setImported(r); setOpenImport(false); refresh() }, onError })

  return (
    <div className="page wide ojt-root">
      <PageBanner avatar={<SolutionOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.ojtManage')} subtitle={t('nav.ojtManageDesc')}
        extra={<div className="ojt-mg-actions">
          <Button size="large" type="primary" ghost icon={<UserAddOutlined />} disabled={ready.data !== true} onClick={() => setOpenCreate(true)}>{t('ojt.create')}</Button>
          <Button size="large" type="primary" ghost icon={<FileExcelOutlined />} disabled={ready.data !== true} onClick={() => setOpenImport(true)}>{t('ojt.importTitle')}</Button>
        </div>} />
      {ready.data === false && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('ojt.notReady')} />
      )}
      {last && (last.approvers.length > 0
        ? <Alert style={{ marginBottom: 14 }} type="success" showIcon closable onClose={() => setLast(null)} message={t('ojt.notified', { n: last.approvers.length, ids: last.approvers.join(', ') })} />
        : <Alert style={{ marginBottom: 14 }} type="warning" showIcon closable onClose={() => setLast(null)} message={t('ojt.noLeaderCreated')} />)}
      <Modal open={openCreate} onCancel={() => setOpenCreate(false)} footer={null} width={560} destroyOnHidden centered title={null} className="ojt-mg-modal">
        <header className="ojt-mg-head">
          <span className="ojt-mg-ic"><UserAddOutlined /></span>
          <div><h3>{t('ojt.create')}</h3><p>{t('ojt.createSub')}</p></div>
        </header>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => create.mutate(v)} disabled={ready.data !== true}>
          <Form.Item name="employeeId" label={t('ojt.employeeAccount')} rules={[{ required: true, message: t('ojt.err.employee') }]}>
            <PersonSelect placeholder={t('ojt.pickEmployee')} onChange={(_, p) => setPicked(p)} />
          </Form.Item>
          {picked && (
            <div className="ojt-pick">
              <OjtAvatar name={picked.name} src={photos[picked.id]} size={44} />
              <div className="ojt-pick-main">
                <b>{picked.name}</b>
                <span>{picked.id} · {picked.department ?? '—'} · {picked.position ?? '—'}</span>
                <em>{t('ojt.confirmHint')}</em>
              </div>
            </div>
          )}
          <Form.Item name="startDate" label={t('ojt.startDateOpt')} extra={t('ojt.startDateHint')}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%', maxWidth: 260 }} />
          </Form.Item>
          <Popconfirm title={t('ojt.confirmAsk', { name: picked?.name ?? '' })} okText={t('ojt.createBtn')} cancelText={t('ojt.cancel')} disabled={!picked}
            onConfirm={() => form.validateFields().then((v) => create.mutate(v))}>
            <Button type="primary" size="large" block loading={create.isPending} disabled={!picked}>{t('ojt.createBtn')}</Button>
          </Popconfirm>
        </Form>
      </Modal>
      <Modal open={openImport} onCancel={() => setOpenImport(false)} footer={null} width={600} destroyOnHidden centered title={null} className="ojt-mg-modal">
        <header className="ojt-mg-head">
          <span className="ojt-mg-ic ojt-mg-ic-xl"><FileExcelOutlined /></span>
          <div><h3>{t('ojt.importTitle')}</h3><p>{t('ojt.importCols')}</p></div>
          <Button type="link" icon={<DownloadOutlined />} onClick={() => ojt.template().catch(() => toast.error(t('ojt.err.generic')))}>{t('ojt.importTemplate')}</Button>
        </header>
        <Upload.Dragger className="ojt-drop" accept=".xlsx" showUploadList={false} multiple={false} disabled={ready.data !== true || upload.isPending}
          beforeUpload={(f) => { upload.mutate(f); return false }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{upload.isPending ? t('ojt.importing') : t('ojt.dropTitle')}</p>
          <p className="ant-upload-hint">{t('ojt.dropSub')}</p>
        </Upload.Dragger>
        <p className="ojt-mg-note"><InfoCircleOutlined /><span>{t('ojt.importHint')}</span></p>
      </Modal>
      <Modal open={imported !== null} onCancel={() => setImported(null)} onOk={() => setImported(null)} cancelButtonProps={{ style: { display: 'none' } }} title={t('ojt.importDone')} width={560}>
        {imported && (
          <>
            <Alert type={imported.errors.length ? 'warning' : 'success'} showIcon style={{ marginBottom: 12 }} message={t('ojt.importSummary', { created: imported.created, updated: imported.updated, errors: imported.errors.length })} />
            {imported.errors.length > 0 && (
              <Table size="small" rowKey={(r) => `${r.excelRow}-${r.code}`} pagination={false} scroll={{ y: 260 }} dataSource={imported.errors}
                columns={[{ title: t('ojt.importRow'), dataIndex: 'excelRow', width: 70 }, { title: t('ojt.employee'), dataIndex: 'detail' }, { title: t('ojt.importReason'), render: (_: unknown, r) => t(`ojt.err.${r.code}`, { defaultValue: r.code }) }]} />
            )}
          </>
        )}
      </Modal>
      {ready.data === true && <OjtOverview manage />}
    </div>
  )
}
