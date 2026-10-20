import { useEffect, useRef, useState } from 'react'
import { Alert, Avatar, Button, Card, Descriptions, Input, Result, Space, Tag, TimePicker } from 'antd'
import type { InputRef } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ClockCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { gate, type GateEmployee, type GateLateRow } from '../../api/security'
import { apiErrorCode } from '../../api/requests'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { StatTiles } from '../../components/StatTiles'
import { UserAvatar } from '../../components/UserAvatar'
import { useToast } from '../../hooks/useToast'

/**
 * Bảo vệ đăng ký người đi muộn tại cổng (như màn "Đăng ký đi muộn" của hệ thống cũ): nhập hoặc quét mã nhân viên / số CCCD,
 * kiểm tra họ tên, bộ phận, ảnh rồi bấm Đăng ký; giờ lấy theo giờ hiện tại. Mỗi người chỉ đăng ký một lần mỗi ngày.
 */
export default function SecurityLatePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const msg = useToast()
  const input = useRef<InputRef>(null)
  const [code, setCode] = useState('')
  const [found, setFound] = useState<GateEmployee | null>(null)
  const [missing, setMissing] = useState(false)
  const [time, setTime] = useState<Dayjs>(dayjs())   // giờ đến thực tế, mặc định giờ hiện tại

  const today = useQuery({ queryKey: ['gate', 'late', 'today'], queryFn: () => gate.lateToday(), refetchInterval: 30_000, retry: false })
  useEffect(() => { input.current?.focus() }, [])
  const rows = today.data?.rows ?? []

  const errText = (e: unknown) => (apiErrorCode(e).code === 'invalid_time' ? t('sec.late.invalidTime') : apiErrorCode(e).code === 'already_registered' ? t('sec.late.already') : apiErrorCode(e).code === 'not_found' ? t('sec.late.notFound') : t('sec.err.generic'))
  const look = useMutation({
    mutationFn: () => gate.lateLookup(code.trim()),
    onSuccess: (e) => { setFound(e); setMissing(false); setTime(dayjs()) },
    onError: () => { setFound(null); setMissing(true) },
  })
  const register = useMutation({
    mutationFn: () => gate.lateRegister(found!.employeeId, time.format('HH:mm')),
    onSuccess: () => { msg.success(t('sec.late.done', { name: found!.fullName })); setFound(null); setCode(''); qc.invalidateQueries({ queryKey: ['gate', 'late'] }); input.current?.focus() },
    onError: (e) => { msg.error(errText(e)); qc.invalidateQueries({ queryKey: ['gate', 'late'] }) },
  })
  const search = () => { if (code.trim()) look.mutate() }

  const columns: ColumnsType<GateLateRow> = [
    { title: t('sec.late.time'), dataIndex: 'at', width: 90, render: (v: string) => <b>{dayjs(v).format('HH:mm')}</b> },
    { title: t('org.colEmp'), dataIndex: 'employeeId', width: 120 },
    { title: t('org.colName'), dataIndex: 'fullName', ellipsis: true },
    { title: t('att.dept'), dataIndex: 'department', ellipsis: true, render: (v: string | null) => v || '-' },
    { title: t('usr.colFactory'), dataIndex: 'factory', width: 110, render: (v: string | null) => v || '-' },
    { title: t('sec.late.by'), dataIndex: 'registeredBy', width: 120, render: (v: string | null) => v || '-' },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<ClockCircleOutlined />} />} title={t('nav.securityLate')} subtitle={t('nav.securityLateDesc')} />
      <StatTiles items={[{ label: t('sec.late.tileToday'), value: rows.length, color: '#D48806' }]} />

      <Card style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%', maxWidth: 520 }}>
          <Input ref={input} size="large" allowClear value={code} maxLength={50} placeholder={t('sec.late.placeholder')} onChange={(e) => { setCode(e.target.value); setMissing(false) }} onPressEnter={search} autoComplete="off" />
          <Button size="large" type="primary" icon={<SearchOutlined />} loading={look.isPending} onClick={search}>{t('sec.late.search')}</Button>
        </Space.Compact>

        {missing && <Alert type="warning" showIcon style={{ marginTop: 12 }} title={t('sec.late.notFound')} />}

        {found && (
          <div className="late-card">
            <UserAvatar name={found.fullName} src={found.avatarUrl} size={84} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: '0 0 6px' }}>{found.fullName} <Tag variant="filled">{found.employeeId}</Tag></h3>
              <Descriptions size="small" column={{ xs: 1, md: 2 }}>
                <Descriptions.Item label={t('att.dept')}>{found.department || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('org.colPosition')}>{found.position || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('usr.colFactory')}>{found.factory || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('sec.late.idCard')}>{found.identityCard || '-'}</Descriptions.Item>
              </Descriptions>
              {found.registeredToday
                ? <Alert type="info" showIcon style={{ marginTop: 8 }} title={t('sec.late.alreadyAt', { at: found.registeredAt ? dayjs(found.registeredAt).format('HH:mm') : '' })} />
                : (
                  <Space wrap style={{ marginTop: 8 }}>
                    <span>{t('sec.late.arrivedAt')}:</span>
                    <TimePicker size="large" format="HH:mm" minuteStep={1} allowClear={false} showNow value={time} onChange={(v) => v && setTime(v)} disabledTime={() => ({ disabledHours: () => Array.from({ length: 24 }, (_, h) => h).filter((h) => h > dayjs().hour()) })} />
                    <Button type="primary" size="large" icon={<ClockCircleOutlined />} loading={register.isPending} onClick={() => register.mutate()}>{t('sec.late.register')}</Button>
                  </Space>
                )}
            </div>
          </div>
        )}
        {!found && !missing && <Result status="info" style={{ padding: '24px 0 0' }} subTitle={t('sec.late.hint')} />}
      </Card>

      <DataTable<GateLateRow> rowKey="id" size="small" sticky={false} loading={today.isLoading} columns={columns} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        locale={{ emptyText: t('sec.late.empty') }} />
    </div>
  )
}
