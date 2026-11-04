import { useEffect, useState } from 'react'
import { Button, Empty, Input, Select, Space } from 'antd'
import { DeleteOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { recruit, type CcRole, type RecruitCcGroup } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const emails = (xs: string[]) => [...new Set(xs.map((x) => x.trim().toLowerCase()).filter((x) => EMAIL.test(x)))].slice(0, 30)

/** HR tự thêm / sửa / xoá nhóm CC (bộ phận, quản lý, IT, QC, R&D, ESH…) dùng để thêm nhanh khi gửi thư mời phỏng vấn. Lưu là thay cả danh sách. */
export function CcGroupsModal({ open, onClose, groups, seed, departments = [] }: { open: boolean; onClose: () => void; groups: RecruitCcGroup[]; seed?: string[]; departments?: string[] }) {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [rows, setRows] = useState<RecruitCcGroup[]>([])
  // Tìm người dùng để thêm vào nhóm (nhớ tên / email theo mã tài khoản để hiện nhãn và lấy email khi chọn)
  const [q, setQ] = useState('')
  const [known, setKnown] = useState<Record<string, { name: string; email: string | null }>>({})
  const found = useQuery({ queryKey: ['recruit', 'cc-users', q], queryFn: () => recruit.users(q), enabled: open && q.trim().length >= 2, staleTime: 30_000 })
  useEffect(() => { if (found.data) setKnown((k) => ({ ...k, ...Object.fromEntries(found.data!.map((u) => [u.userId, { name: u.fullName, email: u.email ?? null }])) })) }, [found.data])
  const ROLES: { value: CcRole; label: string }[] = [
    { value: '', label: t('rec.ccRole.none', { defaultValue: 'Chỉ CC thư (chọn nhanh khi gửi mail)' }) },
    { value: 'it', label: t('rec.ccRole.it', { defaultValue: 'Báo IT: nhóm nhận thông báo chuẩn bị máy, tài khoản' }) },
    { value: 'dept', label: t('rec.ccRole.dept', { defaultValue: 'Báo bộ phận: có nhân sự mới sắp vào' }) },
    { value: 'payroll', label: t('rec.ccRole.payroll', { defaultValue: 'Báo lương: thông tin + offer khi người đó đến nhận việc' }) },
  ]
  useEffect(() => {
    if (!open) return
    // Mở từ hộp thư mời khi đã có CC: thêm sẵn một nhóm mới chứa các địa chỉ đó để HR chỉ cần đặt tên
    setRows([...groups.map((g) => ({ ...g, emails: emails([...g.emails, ...(g.toEmails ?? [])]) })), ...(seed?.length ? [{ name: '', emails: [...seed] }] : [])])
    // chỉ nạp lại khi vừa mở hộp, không ghi đè lúc HR đang sửa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const set = (i: number, v: Partial<RecruitCcGroup>) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, ...v } : x)))
  const save = useMutation({
    mutationFn: () => recruit.saveCcGroups(rows.map((r) => ({ name: r.name.trim(), emails: r.emails, toEmails: [], department: r.department || null, role: r.role ?? '', userIds: r.userIds ?? [] }))),
    onSuccess: () => { msg.success(t('rec.ccSaved')); qc.invalidateQueries({ queryKey: ['recruit', 'lookups'] }); onClose() },
    onError: (e) => { const { detail, code } = adminError(e); msg.error(t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') })) },
  })
  const names = rows.map((r) => r.name.trim().toLowerCase())
  const invalid = rows.some((r, i) => !r.name.trim() || r.emails.length === 0 || names.indexOf(r.name.trim().toLowerCase()) !== i)
  return (
    <AppModal open={open} onClose={onClose} size="lg" icon={<TeamOutlined />} title={t('rec.ccManage')} subtitle={t('rec.ccManageHint')} okText={t('rec.ccSave')} okDisabled={invalid} okLoading={save.isPending} onOk={() => save.mutate()}
      extra={<Button icon={<PlusOutlined />} disabled={rows.length >= 50} onClick={() => setRows((xs) => [...xs, { name: '', emails: [] }])}>{t('rec.ccAddGroup')}</Button>}>
      {rows.length === 0 ? <Empty description={t('rec.ccEmpty')} /> : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {rows.map((r, i) => {
            const dup = names.indexOf(r.name.trim().toLowerCase()) !== i
            const lab = (txt: string, hint?: string) => <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{txt}{hint ? <span className="cell-muted" style={{ fontWeight: 400 }}> · {hint}</span> : null}</div>
            return (
              <div key={i} style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 14, background: 'var(--card, #fff)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b>{t('rec.ccGroupN', { defaultValue: 'Nhóm {{n}}', n: i + 1 })}{r.name.trim() ? `: ${r.name.trim()}` : ''}</b>
                  <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))}>{t('rec.ccDelGroup', { defaultValue: 'Xoá nhóm' })}</Button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div>
                    {lab(t('rec.ccLblName', { defaultValue: 'Tên nhóm' }), t('rec.ccLblNameHint', { defaultValue: 'hiện ở nút chọn nhanh' }))}
                    <Input maxLength={50} placeholder={t('rec.ccGroupName')} value={r.name} status={!r.name.trim() || dup ? 'error' : undefined} onChange={(e) => set(i, { name: e.target.value })} />
                    {dup && r.name.trim() ? <div style={{ color: '#d4380d', fontSize: 12 }}>{t('rec.ccDup', { defaultValue: 'Tên nhóm bị trùng' })}</div> : null}
                  </div>
                  <div>
                    {lab(t('rec.department'), t('rec.ccLblDeptHint', { defaultValue: 'không bắt buộc' }))}
                    <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder={t('rec.department')} value={r.department ?? undefined} onChange={(v) => set(i, { department: v ?? null, ...(r.name.trim() ? {} : v ? { name: v } : {}) })}
                      options={[...new Set([...(departments ?? []), ...(r.department ? [r.department] : [])])].map((d) => ({ value: d, label: d }))} />
                  </div>
                  <div>
                    {lab(t('rec.ccLblRole', { defaultValue: 'Nhóm này dùng để làm gì?' }))}
                    <Select style={{ width: '100%' }} value={r.role ?? ''} onChange={(v: CcRole) => set(i, { role: v })} options={ROLES} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  {lab(t('rec.ccLblPeopleCc', { defaultValue: 'Thêm người trong hệ thống' }), t('rec.ccLblPeopleCcHint', { defaultValue: 'gõ tên hoặc mã nhân viên, email tự thêm vào danh sách CC bên dưới' }))}
                  <Select mode="multiple" showSearch filterOption={false} style={{ width: '100%' }} value={r.userIds ?? []} onSearch={setQ} placeholder={t('rec.ccPeoplePh', { defaultValue: 'Chọn người nhận (gõ tên / mã)' })}
                    notFoundContent={q.trim().length < 2 ? t('rec.typeMore') : null} maxCount={30}
                    labelRender={(o) => known[String(o.value)]?.name ?? String(o.value)}
                    options={[...(r.userIds ?? []).map((u) => ({ value: u, label: known[u]?.name ?? u })), ...(found.data ?? []).filter((u) => !(r.userIds ?? []).includes(u.userId)).map((u) => ({ value: u.userId, label: `${u.fullName} (${u.userId})` }))]}
                    onChange={(ids: string[]) => {
                      // Thêm người: email của họ tự vào danh sách CC; bỏ người: bỏ email tương ứng
                      const removed = (r.userIds ?? []).filter((u) => !ids.includes(u)).map((u) => known[u]?.email?.toLowerCase()).filter(Boolean) as string[]
                      const added = ids.filter((u) => !(r.userIds ?? []).includes(u)).map((u) => known[u]?.email?.toLowerCase()).filter(Boolean) as string[]
                      set(i, { userIds: ids, emails: emails([...r.emails.filter((e) => !removed.includes(e)), ...added]) })
                    }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  {lab(t('rec.ccLblCc', { defaultValue: 'Danh sách email CC' }), t('rec.ccLblCcHint2', { defaultValue: 'gõ email rồi Enter để thêm người ngoài hệ thống' }))}
                  <Select mode="tags" style={{ width: '100%' }} open={false} tokenSeparators={[',', ';', ' ']} placeholder={t('rec.ccEmailsPh')} value={r.emails} status={r.emails.length === 0 ? 'error' : undefined} onChange={(v: string[]) => set(i, { emails: emails(v) })} />
                  {r.emails.length === 0 ? <div style={{ color: '#d4380d', fontSize: 12 }}>{t('rec.ccNeedOne', { defaultValue: 'Cần ít nhất 1 email mới lưu được' })}</div> : null}
                </div>
              </div>
            )
          })}
        </Space>
      )}
    </AppModal>
  )
}

/** Nút chọn nhanh nhóm CC đã lưu: một lần bấm thêm cả danh sách CC của nhóm. */
export function PickGroups({ groups, onPickCc }: { groups: RecruitCcGroup[]; onPickCc: (emails: string[]) => void }) {
  const { t } = useTranslation()
  const list = groups.filter((g) => g.emails.length > 0)
  if (list.length === 0) return null
  return (
    <Space wrap style={{ marginBottom: 12 }}>
      <span className="cell-muted">{t('rec.ccPickCc', { defaultValue: 'Chọn nhanh nhóm CC:' })}</span>
      {list.map((g) => <Button key={g.name} size="small" onClick={() => onPickCc(g.emails)}>{g.department ? `${g.department} · ` : ''}{g.name} ({g.emails.length})</Button>)}
    </Space>
  )
}
