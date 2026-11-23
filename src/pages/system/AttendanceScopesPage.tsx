import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Empty, Popconfirm, Select, Space, Switch, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { attendanceScopes, type AttendanceScopeRow, type ScopeEntry } from '../../api/attendanceScopes'
import { adminError, userAdmin } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'

const keyOf = (e: ScopeEntry) => `${e.department}|${e.part}`
/** Tìm trong danh sách chọn không phân biệt hoa thường và dấu tiếng Việt. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const foldFilter = () => (input: string, option?: { label?: unknown }) => fold(String(option?.label ?? '')).includes(fold(input))
/** Giá trị chỉ cập nhật sau khi ngừng đổi 350 ms (không gọi API cho mỗi phím gõ). */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value)
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h) }, [value, ms])
  return v
}

/**
 * Phân quyền xem công: chọn người (không cần là quản trị) được xem màn Tổng hợp công CHỈ trong phạm vi: toàn bộ công nhân OP và / hoặc một số bộ phận / part.
 * Người được cấp chỉ xem, không xuất Excel; mọi dòng được lọc ở máy chủ. Chỉ quản trị.
 */
export default function AttendanceScopesPage() {
  const { t, i18n } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AttendanceScopeRow | 'new' | null>(null)
  const [userId, setUserId] = useState<string>()
  const [search, setSearch] = useState('')
  const dSearch = useDebounced(search)
  const [includeOp, setIncludeOp] = useState(false)
  const [entries, setEntries] = useState<ScopeEntry[]>([])
  const [pickDept, setPickDept] = useState<string>()
  const [pickPart, setPickPart] = useState<string>()

  const list = useQuery({ queryKey: ['att-scopes'], queryFn: attendanceScopes.list, retry: false })
  const options = useQuery({ queryKey: ['att-scopes', 'options'], queryFn: attendanceScopes.options, enabled: !!editing, staleTime: 5 * 60_000 })
  const found = useQuery({
    queryKey: ['att-scopes', 'find', dSearch],
    queryFn: async () => (await userAdmin.list(dSearch, undefined, 'active', 1, 20)).rows.map((u) => ({ value: u.userId.trim(), label: `${u.fullName} · ${u.employeeId}${u.department ? ` · ${u.department}` : ''}` })),
    enabled: editing === 'new' && dSearch.trim().length >= 2,
  })
  const errText = (e: unknown) => { const { code } = adminError(e); return t(`ats.err.${code}`, { defaultValue: t('ats.err.generic') }) }
  const refresh = () => qc.invalidateQueries({ queryKey: ['att-scopes'] })
  const ready = list.data ? list.data.ready : true

  const open = (r: AttendanceScopeRow | 'new') => {
    setEditing(r)
    setUserId(r === 'new' ? undefined : r.userId)
    setIncludeOp(r === 'new' ? true : r.includeOp)
    setEntries(r === 'new' ? [] : r.entries)
    setPickDept(undefined); setPickPart(undefined); setSearch('')
  }
  const close = () => setEditing(null)

  const save = useMutation({
    mutationFn: () => attendanceScopes.save(userId!, { includeOp, entries }),
    onSuccess: () => { msg.success(t('ats.saved')); close(); refresh() },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => attendanceScopes.remove(id),
    onSuccess: () => { msg.success(t('ats.removed')); refresh() },
    onError: (e) => msg.error(errText(e)),
  })

  const parts = useMemo(() => options.data?.find((d) => d.department === pickDept)?.parts ?? [], [options.data, pickDept])
  const addEntry = () => {
    if (!pickDept) return
    const e: ScopeEntry = { department: pickDept, part: pickPart ?? '' }
    setEntries((cur) => {
      if (cur.some((x) => keyOf(x) === keyOf(e))) return cur
      // chọn cả bộ phận thì bỏ các part lẻ của bộ phận đó; đã có cả bộ phận thì không thêm part lẻ
      if (e.part && cur.some((x) => x.department === e.department && !x.part)) return cur
      return [...(e.part ? cur : cur.filter((x) => x.department !== e.department)), e]
    })
    setPickPart(undefined)
  }
  const empty = !includeOp && entries.length === 0
  const label = (e: ScopeEntry) => (e.part ? `${e.department} › ${e.part}` : e.department)

  const columns: ColumnsType<AttendanceScopeRow> = [
    {
      title: t('ats.person'), key: 'person', width: 240,
      render: (_: unknown, r) => <div><b>{r.fullName}</b><div className="cell-muted">{r.userId}{r.employeeId ? ` · ${r.employeeId}` : ''}{r.department ? ` · ${r.department}` : ''}</div></div>,
    },
    {
      title: t('ats.scope'), key: 'scope',
      render: (_: unknown, r) => (
        <Space size={[4, 4]} wrap>
          {r.includeOp && <Tag color="green">{t('ats.op')}</Tag>}
          {r.entries.map((e) => <Tag key={keyOf(e)}>{label(e)}</Tag>)}
        </Space>
      ),
    },
    { title: t('ats.people'), dataIndex: 'people', width: 120, align: 'right' },
    {
      title: t('ats.updated'), key: 'upd', width: 190,
      render: (_: unknown, r) => <span className="cell-muted">{r.updatedBy ?? ''}{r.updatedAt ? ` · ${dayjs(r.updatedAt).locale(i18n.language.slice(0, 2)).format('HH:mm DD/MM/YYYY')}` : ''}</span>,
    },
    {
      title: '', key: 'act', width: 190, align: 'right',
      render: (_: unknown, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(r)}>{t('req.edit')}</Button>
          <Popconfirm title={t('ats.removeAsk', { name: r.fullName })} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => remove.mutate(r.userId)}>
            <Button size="small" danger icon={<DeleteOutlined />} loading={remove.isPending && remove.variables === r.userId} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<EyeOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.attendanceScopes')} subtitle={t('nav.attendanceScopesDesc')} />
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('ats.intro')} />
      {list.data && !ready && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('ats.err.table_missing')} />}
      <DataTable<AttendanceScopeRow>
        rowKey="userId" loading={list.isLoading} columns={columns} dataSource={list.data?.items ?? []} pagination={false}
        locale={{ emptyText: list.isError ? t('ats.err.generic') : <Empty description={t('ats.empty')} /> }}
        toolbar={<Button type="primary" icon={<PlusOutlined />} disabled={!ready} onClick={() => open('new')}>{t('ats.add')}</Button>}
      />

      <AppModal open={!!editing} onClose={close} size="md" icon={<EyeOutlined />} title={editing === 'new' ? t('ats.add') : t('ats.edit')} subtitle={editing && editing !== 'new' ? `${editing.fullName} · ${editing.userId}` : t('ats.hint')}
        okText={t('req.saveChanges')} okLoading={save.isPending} okDisabled={!userId || empty} onOk={() => save.mutate()}>
        <Space orientation="vertical" size={14} style={{ width: '100%' }}>
          {editing === 'new' && (
            <Select showSearch filterOption={false} style={{ width: '100%' }} placeholder={t('ats.pickUser')} value={userId} onSearch={setSearch} onChange={setUserId}
              options={found.data ?? []} loading={found.isFetching} notFoundContent={search.trim().length < 2 ? t('ats.typeMore') : undefined} />
          )}
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Switch checked={includeOp} onChange={setIncludeOp} />
            <span><b>{t('ats.opAll')}</b><div className="cell-muted">{t('ats.opHint')}</div></span>
          </label>
          <div>
            <b>{t('ats.deptList')}</b>
            <div className="cell-muted" style={{ marginBottom: 8 }}>{t('ats.deptHint')}</div>
            <Space.Compact style={{ width: '100%' }}>
              <Select showSearch allowClear filterOption={foldFilter()} style={{ width: '45%' }} placeholder={t('ats.pickDept')} value={pickDept} loading={options.isLoading}
                onChange={(v) => { setPickDept(v); setPickPart(undefined) }} options={(options.data ?? []).map((d) => ({ value: d.department, label: `${d.department} (${d.people})` }))} />
              <Select showSearch allowClear filterOption={foldFilter()} style={{ width: '40%' }} placeholder={t('ats.wholeDept')} value={pickPart} disabled={!pickDept || parts.length === 0}
                onChange={setPickPart} options={parts.map((p) => ({ value: p, label: p }))} />
              <Button icon={<PlusOutlined />} disabled={!pickDept} onClick={addEntry}>{t('line.add')}</Button>
            </Space.Compact>
            <Space size={[6, 6]} wrap style={{ marginTop: 10 }}>
              {entries.map((e) => <Tag key={keyOf(e)} closable onClose={() => setEntries((cur) => cur.filter((x) => keyOf(x) !== keyOf(e)))}>{label(e)}</Tag>)}
              {entries.length === 0 && <span className="cell-muted">{t('ats.noDept')}</span>}
            </Space>
          </div>
          {empty && userId && <Alert type="warning" showIcon title={t('ats.emptyWarn')} />}
        </Space>
      </AppModal>
    </div>
  )
}
