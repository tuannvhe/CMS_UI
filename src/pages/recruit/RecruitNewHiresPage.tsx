import { useState } from 'react'
import { Button, DatePicker, Input, Modal, Popconfirm, Select, Space, Tag, Tooltip } from 'antd'
import { CheckCircleOutlined, LaptopOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs, { type Dayjs } from 'dayjs'
import { recruitNewHires, type NewHireItRow } from '../../api/recruit'
import { ALL_NODE, BatchTree, inNode } from './RecruitBatchTree'
import { adminError } from '../../api/userAdmin'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { foldFilter, foldText } from '../../utils/search'
import { useDebouncedValue } from '../../hooks/useDebounce'
import { trData } from '../../utils/dataText'

const dmy = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')
const dmyhm = (v: string | null | undefined) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—')

/**
 * Bộ phận DX/EA: danh sách nhân sự sắp nhận việc (HR lập lịch) để chuẩn bị máy tính, email, tài khoản; chọn nhiều người rồi đánh dấu đã chuẩn bị xong (HR nhận chuông).
 * Chỉ có thông tin cần cho việc chuẩn bị, không có liên hệ, lương hay offer.
 */
export default function RecruitNewHiresPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const qc = useQueryClient()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs().add(60, 'day')])
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const q = useQuery({ queryKey: ['recruit-newhires', from, to], queryFn: () => recruitNewHires.list(from, to), retry: false })
  const [picked, setPicked] = useState<number[]>([])
  const batchQ = useQuery({ queryKey: ['recruit-newhires', 'batches'], queryFn: recruitNewHires.batches, retry: false, staleTime: 5 * 60_000 })
  const [node, setNode] = useState<number>(ALL_NODE)
  const [text, setText] = useState('')
  const dText = useDebouncedValue(text)   // gõ xong mới lọc, không lọc lại sau mỗi phím
  const [dept, setDept] = useState<string | undefined>()
  const [state, setState] = useState<string | undefined>()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }
  const mark = useMutation({
    mutationFn: (v: { ready: boolean; note?: string }) => recruitNewHires.ready(picked, v.ready, v.note),
    onSuccess: (r, v) => { toast.success(t(v.ready ? 'rec.nh.markedDone' : 'rec.nh.unmarkedDone', { n: r.count })); setPicked([]); setNoteOpen(false); setNote(''); qc.invalidateQueries({ queryKey: ['recruit-newhires'] }) },
    onError: (e) => toast.error(errText(e)),
  })

  const today = dayjs().format('YYYY-MM-DD')
  const everyone = q.data ?? []
  // Cây chỉ gồm các đợt / thư mục có người đã được HR lập lịch nhận việc (trong khoảng ngày đang xem), kèm các nút cha để giữ đường dẫn Năm → Tháng → Đợt
  const allBatches = batchQ.data ?? []
  const keep = new Set<number>()
  const byId = new Map(allBatches.map((b) => [b.id, b]))
  for (const r of everyone) {
    let id = r.batchId ?? null
    while (id != null && !keep.has(id)) { keep.add(id); id = byId.get(id)?.parentId ?? null }
  }
  const batches = allBatches.filter((b) => keep.has(b.id))
  const treeOn = batches.length > 0
  // Số trên mỗi nút = số người sắp nhận việc trong khoảng ngày đang xem
  const treeBatches = batches.map((b) => ({ ...b, applications: everyone.filter((r) => r.batchId === b.id).length }))
  // Đổi khoảng ngày làm nút đang chọn không còn người thì quay về Tất cả
  const sel = node > 0 && !keep.has(node) ? ALL_NODE : node
  const all = treeOn ? inNode(everyone, batches, sel) : everyone
  const depts = [...new Set(all.map((r) => r.department).filter((d): d is string => !!d))].sort()
  const key = foldText(dText.trim())
  const rows = all.filter((r) =>
    (!key || [r.fullName, r.position, r.department, r.factory, r.location].some((v) => foldText(v ?? '').includes(key)))
    && (!dept || r.department === dept)
    && (!state || (state === 'todo' ? !r.readyAt : state === 'done' ? !!r.readyAt : state === 'notified' ? !!r.itNotifiedAt : !r.itNotifiedAt)))
  const todo = all.filter((r) => !r.readyAt && r.startDate >= today).length

  const startCell = (r: NewHireItRow) => {
    const days = dayjs(r.startDate).diff(dayjs(today), 'day')
    return (
      <span>
        <b>{dmy(r.startDate)}</b>
        {days === 0 ? <Tag color="green" style={{ marginLeft: 6 }}>{t('rec.ob.today')}</Tag>
          : days > 0 && days <= 3 && !r.readyAt ? <Tag color="orange" style={{ marginLeft: 6 }}>{t('rec.nh.inDays', { n: days })}</Tag> : null}
      </span>
    )
  }

  return (
    <div className="page wide">
      <PageBanner avatar={<LaptopOutlined style={{ fontSize: 28, color: '#fff' }} />} title={t('nav.recruitNewHires')} subtitle={t('nav.recruitNewHiresDesc')} />
      <div className={treeOn ? 'rec-split' : undefined}>
      {treeOn && <BatchTree readOnly batches={treeBatches} total={everyone.length} unassigned={everyone.filter((r) => r.batchId == null).length} selected={sel} onSelect={(id) => { setNode(id); setPicked([]) }} />}
      <DataTable<NewHireItRow>
        className="rec-list"
        rowKey="applicationId" loading={q.isLoading} dataSource={rows} pagination={{ pageSize: 50, showSizeChanger: false }}
        rowSelection={{ selectedRowKeys: picked, onChange: (k) => setPicked(k as number[]), preserveSelectedRowKeys: true }}
        locale={{ emptyText: q.isError ? errText(q.error) : t('rec.nh.empty') }}
        toolbar={<Space wrap>
          <DatePicker.RangePicker allowClear={false} value={range} format="DD/MM/YYYY" onChange={(v) => { if (v?.[0] && v[1]) { setRange([v[0], v[1]]); setPicked([]) } }} />
          <Input.Search allowClear style={{ width: 220 }} placeholder={t('rec.nh.search')} value={text} onChange={(e) => setText(e.target.value)} />
          <Select allowClear showSearch filterOption={foldFilter()} style={{ width: 190 }} placeholder={t('rec.ob.fDept')} value={dept} onChange={setDept} options={depts.map((d) => ({ value: d, label: d }))} />
          <Select allowClear style={{ width: 190 }} placeholder={t('rec.nh.fState')} value={state} onChange={setState}
            options={[{ value: 'todo', label: t('rec.nh.sTodo') }, { value: 'done', label: t('rec.nh.sDone') }, { value: 'notified', label: t('rec.nh.sNotified') }, { value: 'silent', label: t('rec.nh.sSilent') }]} />
          {picked.length > 0 && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setNoteOpen(true)}>{t('rec.nh.mark', { n: picked.length })}</Button>}
          {picked.length > 0 && (
            <Popconfirm title={t('rec.nh.unmarkAsk', { n: picked.length })} onConfirm={() => mark.mutate({ ready: false })}>
              <Button icon={<UndoOutlined />} loading={mark.isPending && !noteOpen}>{t('rec.nh.unmark')}</Button>
            </Popconfirm>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => q.refetch()} loading={q.isFetching && !q.isLoading} />
          <span className="cell-muted">{t('rec.nh.count', { shown: rows.length, total: all.length, todo })}</span>
        </Space>}
        columns={[
          { title: t('rec.nh.startDate'), width: 170, render: (_: unknown, r) => startCell(r) },
          { title: t('rec.fullName'), render: (_: unknown, r) => <span><b>{r.fullName}</b><div className="cell-muted">{trData(r.position)}</div></span> },
          { title: t('rec.department'), render: (_: unknown, r) => [r.department, r.factory].filter(Boolean).join(' · ') || '—' },
          { title: t('rec.ob.location'), dataIndex: 'location', render: (v: string | null) => v ?? '—' },
          { title: t('rec.nh.hrNotified'), width: 190, render: (_: unknown, r) => r.itNotifiedAt
            ? <span>{dmyhm(r.itNotifiedAt)}<div className="cell-muted">{r.itNotifiedBy}</div></span>
            : <span className="cell-muted">{t('rec.nh.notNotified')}</span> },
          { title: t('rec.nh.prepared'), width: 220, render: (_: unknown, r) => r.readyAt
            ? <Tooltip title={r.readyNote || undefined}><span><Tag color="green" icon={<CheckCircleOutlined />}>{t('rec.nh.ready')}</Tag><div className="cell-muted">{r.readyBy} · {dmyhm(r.readyAt)}</div>{r.readyNote && <div className="cell-muted">{r.readyNote}</div>}</span></Tooltip>
            : <Tag color={r.startDate < today ? 'default' : 'orange'}>{t('rec.nh.notReady')}</Tag> },
          { title: t('rec.nh.arrival'), width: 150, render: (_: unknown, r) => r.arrival === 'yes' ? <Tag color="green">{t('rec.nh.came')}{r.arrivedDate ? ` ${dmy(r.arrivedDate)}` : ''}</Tag>
            : r.arrival === 'no' ? <Tag color="red">{t('rec.nh.noShow')}</Tag> : <span className="cell-muted">—</span> },
        ]}
      />
      </div>
      <Modal open={noteOpen} title={t('rec.nh.mark', { n: picked.length })} okText={t('rec.nh.markOk')} confirmLoading={mark.isPending}
        onOk={() => mark.mutate({ ready: true, note: note.trim() || undefined })} onCancel={() => setNoteOpen(false)} destroyOnHidden>
        <p className="cell-muted" style={{ marginTop: 0 }}>{t('rec.nh.markHint')}</p>
        <Input.TextArea rows={3} maxLength={500} showCount value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('rec.nh.notePh')} />
      </Modal>
    </div>
  )
}
