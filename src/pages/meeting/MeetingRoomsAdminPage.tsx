import { useState } from 'react'
import { Alert, AutoComplete, Avatar, Button, Form, Input, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { conflictsOf, MEETING_LOCATIONS, meetingRooms, type MeetingRoom } from '../../api/meetingRooms'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { foldFilter } from '../../utils/search'

interface RoomValues { name: string; location?: string }

/** Danh mục phòng họp (BM_MeetingRoom, dùng chung với web đặt phòng cũ): thêm, đổi tên / địa điểm, bật / tắt. */
export default function MeetingRoomsAdminPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<MeetingRoom | 'new' | null>(null)
  const [form] = Form.useForm<RoomValues>()
  const q = useQuery({ queryKey: ['meeting-rooms', 'admin'], queryFn: meetingRooms.allRooms })
  const refresh = () => qc.invalidateQueries({ queryKey: ['meeting-rooms'] })
  const errText = (e: unknown) => {
    const { detail, code } = adminError(e)
    if (detail === 'has_bookings') return t('mtg.err.has_bookings', { n: conflictsOf(e).length })
    return t(`mtg.err.${detail || code}`, { defaultValue: t('usr.err.generic') })
  }

  const save = useMutation({
    mutationFn: (v: RoomValues) => {
      const body = { name: v.name.trim(), location: v.location?.trim() || undefined }
      return editing && editing !== 'new' ? meetingRooms.updateRoom(editing.code, body) : meetingRooms.addRoom(body).then(() => undefined)
    },
    onSuccess: () => { msg.success(t('mtg.roomSaved')); setEditing(null); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const toggle = useMutation({
    mutationFn: (r: MeetingRoom) => meetingRooms.toggleRoom(r.code),
    onSuccess: () => { msg.success(t('mtg.roomSaved')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const open = (r: MeetingRoom | 'new') => {
    setEditing(r)
    form.setFieldsValue(r === 'new' ? { name: '', location: '' } : { name: r.name, location: r.location ?? '' })
  }

  const columns: ColumnsType<MeetingRoom> = [
    { title: t('mtg.code'), dataIndex: 'code', width: 110 },
    { title: t('mtg.roomName'), dataIndex: 'name' },
    { title: t('mtg.location'), dataIndex: 'location', width: 200 },
    { title: t('mtg.shownAs'), dataIndex: 'display', responsive: ['md'], render: (v: string) => <span className="cell-muted">{v}</span> },
    { title: t('mtg.active'), dataIndex: 'active', width: 100, render: (v: boolean, r) => <Switch size="small" checked={v} loading={toggle.isPending && toggle.variables?.code === r.code} onChange={() => toggle.mutate(r)} /> },
    { title: '', key: 'act', width: 70, align: 'right', render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => open(r)} aria-label={t('mtg.editRoom')} /> },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SettingOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.meetingRoomsManage')} subtitle={t('nav.meetingRoomsManageDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('mtg.adminNote')} />
      <DataTable<MeetingRoom>
        rowKey="code" loading={q.isLoading} columns={columns} dataSource={q.data ?? []} pagination={false}
        locale={{ emptyText: q.isError ? t('usr.err.generic') : t('mtg.noRooms') }}
        toolbar={<Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>{t('mtg.addRoom')}</Button>}
      />
      <AppModal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('mtg.addRoom') : t('mtg.editRoom')} subtitle={editing && editing !== 'new' ? editing.code : undefined}
        icon={<SettingOutlined />} size="sm" onOk={() => form.submit()} okLoading={save.isPending}>
        <Form form={form} layout="vertical" autoComplete="off" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label={t('mtg.roomName')} rules={[{ required: true, whitespace: true }, { min: 2 }, { max: 50 }]}>
            <Input maxLength={50} placeholder={t('mtg.roomNamePh')} />
          </Form.Item>
          <Form.Item name="location" label={t('mtg.location')} rules={[{ max: 50 }]}>
            <AutoComplete maxLength={50} placeholder={t('mtg.locationPh')} options={MEETING_LOCATIONS.map((l) => ({ value: l }))}
              filterOption={foldFilter('value')} />
          </Form.Item>
          {editing && editing !== 'new' && <Alert type="warning" showIcon title={t('mtg.renameNote')} />}
        </Form>
      </AppModal>
    </div>
  )
}
