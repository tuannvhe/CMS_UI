import { invalidateOrgData } from '../../api/cache'
import { useEffect, useState } from 'react'
import { Alert, Avatar, Button, Select, Space, Steps, Switch, Tag, Typography, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ApartmentOutlined, CheckCircleFilled, CheckOutlined, DownloadOutlined, FileExcelOutlined, InboxOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { adminError, employeeImport, type EmployeeImportPreview, type EmployeeImportResult, type EmployeeInput, type EmployeeIssue, type EmployeeMove, type NameUsage } from '../../api/userAdmin'
import { MiniTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { AddDepartmentModal, NextStepModal } from '../../components/OrgModals'
import type { DepartmentInfo } from '../../api/departments'

const MAX_SHOWN = 8

function Issues({ title, type, items }: { title: string; type: 'error' | 'warning'; items: EmployeeIssue[] }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <Alert type={type} showIcon style={{ marginBottom: 12 }} title={`${title} (${items.length})`}
      description={(
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.slice(0, MAX_SHOWN).map((i, k) => (
            <li key={k}>{i.excelRow > 0 ? `${t('cls.row', { n: i.excelRow })}: ` : ''}{t(`emi.issue.${i.code}`, { defaultValue: i.code })}{i.detail ? ` (${i.detail})` : ''}</li>
          ))}
          {items.length > MAX_SHOWN && <li>…</li>}
        </ul>
      )} />
  )
}

interface NameRowProps {
  kind: 'd' | 'p'
  usage: NameUsage
  options: string[]
  mapped: string | undefined
  onMap: (v: string | undefined) => void
  onAddDepartment: () => void
}

/**
 * Một tên chưa có trong danh mục chuẩn. Phòng ban: bắt buộc chọn lại một phòng ban chuẩn, hoặc "Thêm mới" bằng tay vào hệ thống rồi chọn.
 * Bộ phận: bắt buộc chọn một bộ phận đã có line đánh giá (muốn bộ phận mới thì tạo line đánh giá trước).
 */
function NameRow({ kind, usage, options, mapped, onMap, onAddDepartment }: NameRowProps) {
  const { t } = useTranslation()
  const resolved = !!mapped
  return (
    <div className={`emi-name ${resolved ? 'ok' : 'new'}`}>
      <div className="emi-name-main">
        <b>{usage.name}</b>
        <span className="emi-count">{t('emi.nEmployees', { n: usage.count })}</span>
        <Tag variant="filled" color={resolved ? 'green' : 'orange'}>{resolved ? t('emi.resolved') : t('emi.notInSystem')}</Tag>
      </div>
      <div className="emi-name-fix">
        <Select showSearch allowClear optionFilterProp="label" style={{ minWidth: 260, flex: 1 }} placeholder={t(kind === 'd' ? 'emi.pickDepartment' : 'emi.pickPart')}
          value={mapped} onChange={(v) => onMap(v)} options={options.map((o) => ({ value: o, label: o }))} />
        {usage.suggestion && !mapped && <Button size="small" onClick={() => onMap(usage.suggestion!)}>{t('emi.useSuggestion', { name: usage.suggestion })}</Button>}
        {kind === 'd'
          ? <Button size="small" icon={<PlusOutlined />} onClick={onAddDepartment}>{t('emi.addDepartment')}</Button>
          : <span className="cell-muted">{t('emi.partNeedsLine')}</span>}
      </div>
    </div>
  )
}

/** Nhập danh sách nhân viên từ Excel (thay trang Uploademployees của hệ thống cũ): xem trước, chuẩn hoá phòng ban / bộ phận, rồi mới ghi và tạo tài khoản mặc định. */
export default function EmployeeImportPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null)
  const [done, setDone] = useState<EmployeeImportResult | null>(null)
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [createAccounts, setCreateAccounts] = useState(true)
  const [groupId, setGroupId] = useState<string>()
  const [adding, setAdding] = useState<string | null>(null)
  const [next, setNext] = useState<DepartmentInfo | null>(null)

  const options = useQuery({ queryKey: ['import', 'options'], queryFn: employeeImport.options, enabled: preview !== null, staleTime: 0 })
  useEffect(() => { if (options.data && !groupId) setGroupId(options.data.defaultGroupId ?? options.data.groups[0]?.groupId) }, [options.data, groupId])

  const errText = (e: unknown) => {
    const { code, detail } = adminError(e)
    if (code === 'too_large') return t('cls.err.too_large')
    if (code === 'expired') return t('cls.err.expired')
    if (code === 'bad_file') return t(`cls.err.bad_${detail}`, { defaultValue: t('cls.err.bad_file') })
    if (code === 'invalid_input') return t(`emi.err.${detail}`, { defaultValue: t('cls.err.generic') })
    return t('cls.err.generic')
  }
  const reset = () => { setMappings({}); setCreateAccounts(true) }
  const doPreview = useMutation({ mutationFn: (f: File) => employeeImport.preview(f), onSuccess: (p) => { setDone(null); reset(); setPreview(p) }, onError: (e) => msg.error(errText(e)) })
  const commit = useMutation({
    mutationFn: () => employeeImport.commit(preview!.token, { mappings, createAccounts, groupId: createAccounts ? groupId : undefined }),
    onSuccess: (r) => { setDone(r); setPreview(null) },
    onError: (e) => { msg.error(errText(e)); if (adminError(e).code === 'expired') setPreview(null) },
  })

  const newDeps = (preview?.departments ?? []).filter((d) => d.isNew)
  const newParts = (preview?.parts ?? []).filter((d) => d.isNew)
  const unresolvedDeps = newDeps.filter((d) => !mappings[`d:${d.name}`]).length
  const unresolvedParts = newParts.filter((d) => !mappings[`p:${d.name}`]).length
  const accountOk = !createAccounts || !!groupId
  const canCommit = !!preview && preview.totalRows > 0 && unresolvedDeps === 0 && unresolvedParts === 0 && accountOk

  const setMap = (key: string, v: string | undefined) => setMappings((m) => { const n = { ...m }; if (v) n[key] = v; else delete n[key]; return n })

  const date = (v: string | null) => (v ? v.split('-').reverse().join('/') : '-')
  const columns: ColumnsType<EmployeeInput> = [
    { title: t('cls.row', { n: '' }).replace(/\s*$/, ''), dataIndex: 'excelRow', width: 70 },
    { title: t('sys.colEmp'), dataIndex: 'employeeId', width: 110 },
    { title: t('att.name'), dataIndex: 'fullName', width: 200, ellipsis: true },
    { title: t('att.dept'), dataIndex: 'department', width: 190, ellipsis: true },
    { title: t('cls.position'), dataIndex: 'position', width: 90 },
    { title: t('emi.birthday'), dataIndex: 'birthday', width: 110, render: date },
    { title: t('emi.startWork'), dataIndex: 'startWork', width: 110, render: date },
    { title: t('emi.statusWorking'), dataIndex: 'statusWorking', width: 120 },
    { title: t('usr.colActive'), dataIndex: 'active', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'red'} variant="filled">{v ? t('usr.active') : t('usr.locked')}</Tag> },
    { title: t('usr.colFactory'), dataIndex: 'factoryCode', width: 100 },
  ]
  const step = done ? 2 : preview ? 1 : 0
  const okDeps = (preview?.departments ?? []).filter((d) => !d.isNew)
  const okParts = (preview?.parts ?? []).filter((d) => !d.isNew)

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<TeamOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />}
        title={t('nav.employeeImport')} subtitle={t('nav.employeeImportDesc')} />
      <Steps className="ci-steps" current={step} items={[{ title: t('cls.step1') }, { title: t('emi.step2') }, { title: t('cls.step3') }]} />

      {!preview && !done && (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t('emi.noteTitle')} description={t('emi.note')} />
          <div className="ci-drop">
            <Upload.Dragger accept=".xlsx" multiple={false} showUploadList={false} disabled={doPreview.isPending} beforeUpload={(f) => { doPreview.mutate(f); return false }}>
              <InboxOutlined className="ci-drop-icon" />
              <div className="ci-drop-title">{doPreview.isPending ? t('cls.reading') : t('emi.drop')}</div>
              <div className="ci-drop-hint">{t('cls.dropHint')}</div>
            </Upload.Dragger>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={() => employeeImport.template().catch(() => msg.error(t('cls.err.generic')))}>{t('cls.template')}</Button>
          </div>
        </>
      )}

      {done && (
        <div className="ci-card">
          <div className="ci-body ci-success">
            <CheckCircleFilled />
            <Typography.Title level={4} style={{ margin: '12px 0 4px' }}>{t('emi.doneTitle')}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>{t('emi.doneText', { inserted: done.inserted, updated: done.updated })}</Typography.Paragraph>
            {done.accountsCreated > 0 && <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>{t('emi.accountsDone', { n: done.accountsCreated })}</Typography.Paragraph>}
            <Button type="primary" style={{ marginTop: 8 }} onClick={() => setDone(null)}>{t('cls.importMore')}</Button>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="stat-grid">
            <div className="stat-tile" style={{ ['--tile' as string]: '#0F6B3E' }}><div className="st-label">{t('cls.rows')}</div><div className="st-value">{preview.totalRows.toLocaleString()}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: '#2E9E4F' }}><div className="st-label">{t('cls.newRows')}</div><div className="st-value">{preview.new}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: '#D48806' }}><div className="st-label">{t('cls.updatedRows')}</div><div className="st-value">{preview.updated}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: unresolvedDeps + unresolvedParts ? '#D92D20' : '#2E9E4F' }}><div className="st-label">{t('emi.toFix')}</div><div className="st-value">{unresolvedDeps + unresolvedParts}</div></div>
            <div className="stat-tile" style={{ ['--tile' as string]: preview.errors.length ? '#D92D20' : '#98A2B3' }}><div className="st-label">{t('cls.errorsN')}</div><div className="st-value">{preview.errors.length}</div></div>
          </div>

          <div className="ci-card">
            <header>
              <span className="ci-file"><FileExcelOutlined /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.fileName}</span></span>
              <Space>
                <Button onClick={() => setPreview(null)}>{t('cls.chooseOther')}</Button>
                <Button type="primary" icon={<CheckOutlined />} loading={commit.isPending} disabled={!canCommit} onClick={() => commit.mutate()}>{t('emi.confirm', { n: preview.totalRows })}</Button>
              </Space>
            </header>
            <div className="ci-body">
              {preview.totalRows === 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('emi.empty')} />}
              <Issues title={t('cls.errors')} type="error" items={preview.errors} />

              {/* ---- Chuẩn hoá phòng ban / bộ phận ---- */}
              {(newDeps.length > 0 || newParts.length > 0) && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('emi.fixTitle')} description={t('emi.fixNote')} />}
              {newDeps.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <Typography.Text strong><ApartmentOutlined /> {t('emi.departments')}</Typography.Text>
                  <div className="emi-names">
                    {newDeps.map((u) => (
                      <NameRow key={`d:${u.name}`} kind="d" usage={u} options={options.data?.departments ?? []} mapped={mappings[`d:${u.name}`]}
                        onMap={(v) => setMap(`d:${u.name}`, v)} onAddDepartment={() => setAdding(u.name)} />
                    ))}
                  </div>
                </div>
              )}
              {newParts.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <Typography.Text strong>{t('emi.parts')}</Typography.Text>
                  <div className="emi-names">
                    {newParts.map((u) => (
                      <NameRow key={`p:${u.name}`} kind="p" usage={u} options={options.data?.parts ?? []} mapped={mappings[`p:${u.name}`]}
                        onMap={(v) => setMap(`p:${u.name}`, v)} onAddDepartment={() => undefined} />
                    ))}
                  </div>
                </div>
              )}
              {(okDeps.length > 0 || okParts.length > 0) && (
                <div style={{ marginBottom: 14 }}>
                  <Typography.Text type="secondary">{t('emi.okNames')}</Typography.Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {okDeps.map((u) => <Tag key={`d${u.name}`} variant="filled" color="green">{u.name} · {u.count}{u.normalized > 0 ? ` · ${t('emi.normalized', { n: u.normalized })}` : ''}{u.hasLine ? '' : ` · ${t('emi.noApproverLine')}`}</Tag>)}
                    {okParts.map((u) => <Tag key={`p${u.name}`} variant="filled" color={u.hasLine ? 'green' : 'default'}>{u.name} · {u.count}{u.hasLine ? '' : ` · ${t('emi.noEvalLine')}`}</Tag>)}
                  </div>
                </div>
              )}

              {preview.moves > 0 && (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('emi.movesTitle', { n: preview.moves })}
                  description={(
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {preview.moveSample.slice(0, 8).map((m: EmployeeMove) => (
                        <li key={m.employeeId}>{m.employeeId} {m.fullName}: {m.fromDepartment || '-'} → {m.toDepartment}{m.fromPart !== m.toPart ? ` · ${m.fromPart || '-'} → ${m.toPart || '-'}` : ''}</li>
                      ))}
                      {preview.moves > 8 && <li>…</li>}
                    </ul>
                  )} />
              )}
              <Issues title={t('cls.warnings')} type="warning" items={preview.warnings} />

              {/* ---- Tài khoản mặc định ---- */}
              <div className="emi-accounts">
                <div className="emi-accounts-head">
                  <Switch checked={createAccounts} onChange={setCreateAccounts} disabled={preview.accountsToCreate === 0} />
                  <div>
                    <b>{t('emi.accountsTitle', { n: preview.accountsToCreate })}</b>
                    <div className="cell-muted">{t('emi.accountsRule')}</div>
                  </div>
                </div>
                {createAccounts && preview.accountsToCreate > 0 && (
                  <div className="emi-accounts-body">
                    <span>{t('usr.colGroup')}</span>
                    <Select style={{ minWidth: 240 }} value={groupId} onChange={setGroupId} loading={options.isLoading} options={(options.data?.groups ?? []).map((g) => ({ value: g.groupId, label: g.name }))} />
                    <span className="cell-muted">{t('emi.accountsForce')}</span>
                  </div>
                )}
                {preview.accountSkipped.length > 0 && <Alert type="warning" showIcon style={{ marginTop: 8 }} title={t('emi.accountsSkipped', { codes: preview.accountSkipped.slice(0, 8).join(', ') })} />}
              </div>

              {preview.totalRows > 0 && (
                <>
                  <Typography.Text type="secondary">{t('cls.sampleOf', { n: preview.sample.length, total: preview.totalRows })}</Typography.Text>
                  <MiniTable<EmployeeInput> rowKey="excelRow" size="small" pagination={false} columns={columns} dataSource={preview.sample} scroll={{ x: 1200 }} style={{ marginTop: 8 }} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      <AddDepartmentModal open={adding !== null} initial={adding ?? undefined} onClose={() => setAdding(null)}
        onAdded={(d) => {
          if (adding) setMap(`d:${adding}`, d.english)
          setAdding(null)
          setNext(d)
          qc.invalidateQueries({ queryKey: ['import', 'options'] })
          invalidateOrgData(qc)
        }} />
      <NextStepModal department={next} onClose={() => setNext(null)} />
    </div>
  )
}
