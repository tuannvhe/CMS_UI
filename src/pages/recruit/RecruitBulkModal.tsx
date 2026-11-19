import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Progress, Select, Tag, Tooltip, TreeSelect, Upload } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, DeleteOutlined, FileTextOutlined, FolderOpenOutlined, InboxOutlined, PlusOutlined, QuestionCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { CV_ACCEPT, recruit, type RecruitBatch } from '../../api/recruit'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { useToast } from '../../hooks/useToast'
import { batchLabel, batchTreeData, NONE_NODE } from './RecruitBatchTree'
import { foldFilter } from '../../utils/search'

/** batchId: undefined = theo nhánh chung của cả lô, null = chưa xếp đợt, số = đợt / thư mục riêng của CV này. id: hồ sơ đã tạo. */
interface Item { uid: string; file: File; name: string; edited?: boolean; state: 'wait' | 'ok' | 'fail'; error?: string; batchId?: number | null; id?: number; info: Info }
/** Thông tin riêng từng CV như màn tải 1 CV; position / department / factory trống = theo cả lô. SĐT / email trống thì máy chủ lấy từ CV. */
interface Info { phone?: string; email?: string; idNo?: string; position?: string; department?: string; factory?: string; note?: string; restricted?: boolean }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ID_RE = /^[\d\s.-]{9,15}$/
const infoError = (i: Info) => (i.email?.trim() && !EMAIL_RE.test(i.email.trim()) ? 'email' : i.idNo?.trim() && !ID_RE.test(i.idNo.trim()) ? 'idNo' : null)
const opt = (s?: string) => s?.trim() || undefined

const MAX_FILES = 100
const PARALLEL = 3
/** "Nguyen_Van-A (CV).pdf" → "Nguyen Van A (CV)": gợi ý họ tên từ tên file, HR sửa lại được trước khi tải. */
const nameOf = (f: File) => f.name.replace(/\.(pdf|docx?|xlsx?)$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)

/** Đường dẫn đầy đủ của một nút: "Đợt · Vị trí › Thư mục › Thư mục con". */
function batchPath(batches: RecruitBatch[], id: number): string {
  const parts: string[] = []
  let b = batches.find((x) => x.id === id)
  for (let guard = 0; b && guard < 20; guard++) {
    parts.unshift(b.parentId == null ? batchLabel(b) : b.name)
    const pid = b.parentId
    b = pid == null ? undefined : batches.find((x) => x.id === pid)
  }
  return parts.join(' › ') || `#${id}`
}

/** Tải hàng loạt CV cho staff trở lên: chọn vị trí và nhánh (đợt / thư mục) một lần, đổi nhánh được cho từng CV (cả sau khi đã tải); mỗi file CV (PDF, Word, Excel) thành một hồ sơ (mỗi file một yêu cầu để không vướng giới hạn dung lượng máy chủ). */
export function RecruitBulkModal({ open, onClose, departments, factories, onChanged, batches, defaultBatch, idNo }: {
  open: boolean; onClose: () => void; departments: string[]; factories: string[]; onChanged: () => void
  /** Danh sách đợt (undefined = chưa bật đợt tuyển dụng); defaultBatch = đợt đang chọn trên cây khi mở. */
  batches?: RecruitBatch[]; defaultBatch?: number
  /** Đã bật nhập CCCD. */
  idNo?: boolean
}) {
  const { t } = useTranslation()
  const msg = useToast()
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState<string>()
  const [factory, setFactory] = useState<string>()
  const [batch, setBatch] = useState<number | null>(null)   // nhánh chung của cả lô
  const [moving, setMoving] = useState<string>()             // uid đang chuyển nhánh, '*' = cả lô
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const done = items.filter((i) => i.state !== 'wait').length
  const failed = items.filter((i) => i.state === 'fail').length
  const pending = items.filter((i) => i.state === 'wait')

  const all = useMemo(() => batches ?? [], [batches])
  const tree = useMemo(() => {
    type N = { value: number; title: string; path: string; selectable?: boolean; children: N[] }
    type Src = { value: number; title: string; selectable?: boolean; children: Src[] }
    const withPath = (ns: Src[]): N[] => ns.map((n) => ({ ...n, path: n.value > 0 ? batchPath(all, n.value) : n.title, children: withPath(n.children) }))
    return [{ value: NONE_NODE, title: t('rec.bt.none'), path: t('rec.bt.none'), children: [] as N[] }, ...withPath(batchTreeData(all, t, true))]
  }, [all, t])
  const pathOf = (id: number | null) => (id == null ? t('rec.bt.none') : batchPath(all, id))
  /** Nhánh của một CV: đã tạo thì theo máy chủ, chưa tạo thì riêng của CV hoặc theo nhánh chung. */
  const targetOf = (i: Item) => (i.state === 'ok' ? i.batchId ?? null : i.batchId !== undefined ? i.batchId : batch)

  useEffect(() => {
    if (!open) return
    setBatch(defaultBatch != null && all.some((b) => b.id === defaultBatch && b.status === 'open') ? defaultBatch : null)
    // chỉ lấy đợt mặc định lúc mở modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /** Chọn nhánh chung: vị trí / bộ phận còn trống thì lấy theo đợt gốc. */
  const pickLot = (v: number) => {
    const id = v === NONE_NODE ? null : v
    setBatch(id)
    let root = id == null ? undefined : all.find((b) => b.id === id)
    for (let guard = 0; root?.parentId != null && guard < 20; guard++) { const pid = root.parentId; root = all.find((b) => b.id === pid) }
    if (root?.position && !position.trim()) setPosition(root.position.slice(0, 100))
    if (root?.department && !department && departments.includes(root.department)) setDepartment(root.department)
  }

  const reset = () => { setItems([]); setPosition(''); setDepartment(undefined); setFactory(undefined); setBatch(null) }
  const close = () => { if (running || moving) return; if (done > 0) onChanged(); reset(); onClose() }

  const add = (file: File) => {
    setItems((xs) => (xs.length >= MAX_FILES || !/\.(pdf|docx?|xlsx?)$/i.test(file.name) ? xs : [...xs, { uid: `${file.name}-${file.size}-${xs.length}-${Date.now()}`, file, name: nameOf(file), state: 'wait', info: {} }]))
    return false
  }
  const patch = (uid: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.uid === uid ? { ...x, ...p } : x)))
  const patchInfo = (uid: string, p: Partial<Info>) => setItems((xs) => xs.map((x) => (x.uid === uid ? { ...x, info: { ...x.info, ...p } } : x)))
  const posOf = (i: Item) => (i.info.position?.trim() || position.trim())
  /** CV sẵn sàng tải: có họ tên, có vị trí (riêng hoặc của cả lô), email / CCCD đúng dạng. */
  const ready = (i: Item) => i.state !== 'ok' && i.name.trim().length > 0 && posOf(i).length > 0 && !infoError(i.info)
  const errText = (e: unknown) => { const { detail, code } = adminError(e); return t(`rec.err.${detail || code}`, { defaultValue: t('usr.err.generic') }) }

  const run = async () => {
    const queue = items.filter(ready)
    setRunning(true)
    let next = 0
    const worker = async () => {
      while (next < queue.length) {
        const it = queue[next++]
        const bid = batches ? targetOf(it) : null
        try {
          const f = it.info
          const { id } = await recruit.create({
            fullName: it.name.trim(), position: posOf(it), level: 'staff', department: opt(f.department) ?? department, factory: opt(f.factory) ?? factory,
            phone: opt(f.phone), email: opt(f.email), idNo: idNo ? opt(f.idNo) : undefined, note: opt(f.note), restricted: !!f.restricted,
            file: it.file, nameFromFile: !it.edited, batchId: bid,
          })
          patch(it.uid, { state: 'ok', error: undefined, id, batchId: bid })
        } catch (e) {
          patch(it.uid, { state: 'fail', error: errText(e) })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker))
    setRunning(false)
    onChanged()
  }

  /** Đổi nhánh một CV: chưa tải thì chỉ đổi lựa chọn; đã tạo hồ sơ thì chuyển đợt ngay trên máy chủ. */
  const changeItem = async (it: Item, v: number) => {
    const id = v === NONE_NODE ? null : v
    if (it.state !== 'ok') { patch(it.uid, { batchId: id }); return }
    if (it.id == null || id === (it.batchId ?? null)) return
    setMoving(it.uid)
    try {
      await recruit.moveToBatch([it.id], id)
      patch(it.uid, { batchId: id })
      msg.success(t('rec.bt.moved', { n: 1 }))
      onChanged()
    } catch (e) {
      msg.error(errText(e))
    } finally { setMoving(undefined) }
  }

  /** Sau khi đã tải: chuyển mọi hồ sơ đã tạo (đang nằm nhánh khác) sang nhánh chung đang chọn. */
  const offLot = items.filter((i) => i.state === 'ok' && i.id != null && (i.batchId ?? null) !== batch)
  const moveCreated = async () => {
    const ids = offLot.map((i) => i.id!)
    setMoving('*')
    try {
      await recruit.moveToBatch(ids, batch)
      setItems((xs) => xs.map((x) => (x.id != null && ids.includes(x.id) ? { ...x, batchId: batch } : x)))
      msg.success(t('rec.bt.moved', { n: ids.length }))
      onChanged()
    } catch (e) {
      msg.error(errText(e))
    } finally { setMoving(undefined) }
  }

  /** Số CV theo từng nhánh đích, để HR thấy ngay cả lô đang đổ vào đâu. */
  const counts = new Map<number | null, number>()
  for (const i of items) { const k = targetOf(i); counts.set(k, (counts.get(k) ?? 0) + 1) }

  const busy = running || !!moving
  const canRun = items.some(ready)
  const readyN = items.filter(ready).length
  const okN = items.filter((i) => i.state === 'ok').length
  return (
    <AppModal open={open} onClose={close} size="full" icon={<UploadOutlined />} title={t('rec.bulk.title')} subtitle={t('rec.bulk.sub', { max: MAX_FILES })}
      okText={failed > 0 && pending.length === 0 ? t('rec.bulk.retry') : t('rec.bulk.run', { n: items.filter(ready).length })}
      okDisabled={!canRun || !!moving} okLoading={running} onOk={() => { if (canRun && !moving) void run() }}>
      <style>{BULK_CSS}</style>
      <section className="rbu-card">
        <div className="rbu-h"><span className="rbu-step">1</span>{t('rec.bulk.step1')}<span className="rbu-hint">{t('rec.bulk.step1Hint')}</span></div>
        <div className="rbu-lot">
          <label><span>{t('rec.position')}</span><Input value={position} maxLength={100} placeholder={t('rec.bulk.lotEmpty')} onChange={(e) => setPosition(e.target.value)} disabled={running} /></label>
          <label><span>{t('rec.department')}</span><Select allowClear showSearch filterOption={foldFilter('label')} value={department} onChange={setDepartment} disabled={running} options={departments.map((x) => ({ value: x, label: x }))} /></label>
          <label><span>{t('rec.factory')}</span><Select allowClear showSearch filterOption={foldFilter('label')} value={factory} onChange={setFactory} disabled={running} options={factories.map((x) => ({ value: x, label: x }))} /></label>
          {batches && (
            <label className="wide">
              <span><FolderOpenOutlined /> {t('rec.bulk.batch')} <Tooltip title={t('rec.bulk.batchHint')}><QuestionCircleOutlined className="cell-muted" /></Tooltip></span>
              <div style={{ display: 'flex', gap: 8 }}>
                <TreeSelect style={{ flex: 1, minWidth: 0 }} treeData={tree} treeNodeLabelProp="path" value={batch ?? NONE_NODE} onChange={pickLot} treeDefaultExpandAll showSearch treeNodeFilterProp="title" disabled={busy} />
                {offLot.length > 0 && <Button loading={moving === '*'} disabled={busy} onClick={() => void moveCreated()}>{t('rec.bulk.moveCreated', { n: offLot.length })}</Button>}
              </div>
            </label>
          )}
        </div>
      </section>

      <section className="rbu-card">
        <div className="rbu-h">
          <span className="rbu-step">2</span>{t('rec.bulk.step2')}{items.length > 0 && <span className="rbu-count">{items.length}/{MAX_FILES}</span>}
          {items.length > 0 && (
            <span style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
              {readyN > 0 && <Tag bordered={false} color="processing">{t('rec.bulk.stReady', { n: readyN })}</Tag>}
              {okN > 0 && <Tag bordered={false} color="success" icon={<CheckCircleFilled />}>{t('rec.bulk.stOk', { n: okN })}</Tag>}
              {failed > 0 && <Tag bordered={false} color="error" icon={<CloseCircleFilled />}>{t('rec.bulk.stFail', { n: failed })}</Tag>}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {items.length > 0 && (
            <Upload multiple accept={CV_ACCEPT} showUploadList={false} beforeUpload={add} disabled={running || items.length >= MAX_FILES}>
              <Button icon={<PlusOutlined />} disabled={running || items.length >= MAX_FILES}>{t('rec.bulk.add')}</Button>
            </Upload>
          )}
        </div>
        {items.length === 0 ? (
          <Upload.Dragger multiple accept={CV_ACCEPT} showUploadList={false} beforeUpload={add} disabled={running} className="rbu-drop">
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p style={{ fontWeight: 600 }}>{t('rec.bulk.drop')}</p>
            <p className="cell-muted">{t('rec.bulk.infoHint')}</p>
          </Upload.Dragger>
        ) : (
          <>
            {batches && (
              <div className="rbu-targets">
                {[...counts.entries()].map(([k, n]) => <Tag key={k ?? 'none'} icon={<FolderOpenOutlined />} color={k == null ? 'default' : 'blue'}>{t('rec.bulk.target', { name: pathOf(k), n })}</Tag>)}
              </div>
            )}
            {(running || done > 0) && <Progress percent={Math.round((done / items.length) * 100)} size="small" status={failed ? 'exception' : running ? 'active' : 'success'} format={() => `${done}/${items.length}`} style={{ marginBottom: 8 }} />}
            <div className="rbu-wrap">
              <table className="rbu">
                <thead>
                  <tr>
                    <th className="sx n">#</th>
                    <th className="sx nm">{t('rec.fullName')} <b>*</b></th>
                    <th style={{ minWidth: 130 }}>{t('rec.phone')}</th>
                    <th style={{ minWidth: 200 }}>Email</th>
                    {idNo && <th style={{ minWidth: 140 }}>CCCD</th>}
                    <th style={{ minWidth: 180 }}>{t('rec.position')} <b>*</b></th>
                    <th style={{ minWidth: 180 }}>{t('rec.department')}</th>
                    <th style={{ minWidth: 120 }}>{t('rec.factory')}</th>
                    {batches && <th style={{ minWidth: 230 }}>{t('rec.bt.title')}</th>}
                    <th style={{ minWidth: 200 }}>{t('rec.note')}</th>
                    <th style={{ width: 70, textAlign: 'center' }} title={t('rec.restricted')}>{t('rec.bulk.restrictedShort')}</th>
                    <th style={{ minWidth: 120 }}>{t('rec.bulk.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, n) => {
                    const cur = targetOf(i), f = i.info, lock = running || i.state === 'ok', err = infoError(f)
                    return (
                      <tr key={i.uid} className={i.state === 'ok' ? 'ok' : i.state === 'fail' ? 'fail' : undefined}>
                        <td className="sx n">{n + 1}</td>
                        <td className="sx nm">
                          <Input variant="borderless" value={i.name} maxLength={100} disabled={lock} status={i.name.trim() ? undefined : 'error'} onChange={(e) => patch(i.uid, { name: e.target.value, edited: true })} />
                          <div className="rbu-file" title={i.file.name}><FileTextOutlined /> {i.file.name}</div>
                        </td>
                        <td><Input variant="borderless" value={f.phone} maxLength={30} disabled={lock} placeholder={t('rec.bulk.fromCv')} onChange={(e) => patchInfo(i.uid, { phone: e.target.value })} /></td>
                        <td className={err === 'email' ? 'bad' : undefined}><Input variant="borderless" value={f.email} maxLength={200} disabled={lock} placeholder={t('rec.bulk.fromCv')} title={err === 'email' ? t('rec.err.email') : undefined} onChange={(e) => patchInfo(i.uid, { email: e.target.value })} /></td>
                        {idNo && <td className={err === 'idNo' ? 'bad' : undefined}><Input variant="borderless" inputMode="numeric" value={f.idNo} maxLength={15} disabled={lock} placeholder={t('rec.bulk.fromCv')} title={err === 'idNo' ? t('rec.err.idNo') : undefined} onChange={(e) => patchInfo(i.uid, { idNo: e.target.value })} /></td>}
                        <td className={i.state !== 'ok' && !posOf(i) ? 'bad' : undefined}><Input variant="borderless" value={f.position} maxLength={100} disabled={lock} placeholder={position.trim() || t('rec.bulk.lotEmpty')} onChange={(e) => patchInfo(i.uid, { position: e.target.value })} /></td>
                        <td><Select variant="borderless" allowClear showSearch filterOption={foldFilter('label')} style={{ width: '100%' }} value={f.department} disabled={lock} placeholder={department ?? t('rec.bulk.sameLot')} onChange={(v) => patchInfo(i.uid, { department: v })} options={departments.map((x) => ({ value: x, label: x }))} popupMatchSelectWidth={280} /></td>
                        <td><Select variant="borderless" allowClear showSearch filterOption={foldFilter('label')} style={{ width: '100%' }} value={f.factory} disabled={lock} placeholder={factory ?? t('rec.bulk.sameLot')} onChange={(v) => patchInfo(i.uid, { factory: v })} options={factories.map((x) => ({ value: x, label: x }))} popupMatchSelectWidth={180} /></td>
                        {batches && (
                          <td className={i.batchId !== undefined || i.state === 'ok' ? undefined : 'lot'}>
                            <TreeSelect variant="borderless" style={{ width: '100%' }} treeData={tree} treeNodeLabelProp="path" value={cur ?? NONE_NODE} title={pathOf(cur)} popupMatchSelectWidth={360}
                              onChange={(v: number) => void changeItem(i, v)} treeDefaultExpandAll showSearch treeNodeFilterProp="title" loading={moving === i.uid}
                              disabled={busy || (i.state === 'ok' && i.id == null)} />
                            {i.state !== 'ok' && i.batchId !== undefined && !running && <Button size="small" type="link" className="rbu-link" onClick={() => patch(i.uid, { batchId: undefined })}>{t('rec.bulk.followLot')}</Button>}
                          </td>
                        )}
                        <td><Input.TextArea variant="borderless" autoSize={{ minRows: 1, maxRows: 3 }} value={f.note} maxLength={1000} disabled={lock} onChange={(e) => patchInfo(i.uid, { note: e.target.value })} /></td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}><Checkbox checked={!!f.restricted} disabled={lock} onChange={(e) => patchInfo(i.uid, { restricted: e.target.checked })} /></td>
                        <td className="st">
                          {i.state === 'ok' && <span className="rbu-ok"><CheckCircleFilled /> {t('rec.bulk.ok')}</span>}
                          {i.state === 'fail' && <span className="rbu-err" title={i.error}><CloseCircleFilled /> {i.error}</span>}
                          {i.state === 'wait' && <span className="cell-muted">{ready(i) ? t('rec.bulk.wait') : t('rec.bulk.missing')}</span>}
                          {i.state !== 'ok' && !running && <Button size="small" type="text" danger icon={<DeleteOutlined />} title={t('rec.bulk.remove')} onClick={() => setItems((xs) => xs.filter((x) => x.uid !== i.uid))} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </AppModal>
  )
}

const BULK_CSS = `
.rbu-card { border: 1px solid var(--c-border, #eef0f3); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; background: var(--c-surface, #fff); }
.rbu-h { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; margin-bottom: 10px; flex-wrap: wrap; }
.rbu-step { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--c-primary, #1677ff); color: #fff; font-size: 12px; }
.rbu-hint { font-weight: 400; font-size: 12px; color: var(--c-muted, #8c8c8c); }
.rbu-count { font-weight: 400; font-size: 12px; color: var(--c-muted, #8c8c8c); }
.rbu-lot { display: grid; grid-template-columns: minmax(200px, 1.2fr) minmax(180px, 1fr) minmax(140px, .7fr) minmax(260px, 1.6fr); gap: 12px; }
.rbu-lot > label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rbu-lot > label > span { font-size: 12px; color: var(--c-muted, #8c8c8c); }
@media (max-width: 900px) { .rbu-lot { grid-template-columns: 1fr 1fr; } }
.rbu-drop.ant-upload-wrapper .ant-upload-drag { border-radius: 10px; background: var(--c-tint, #f5f8ff); }
.rbu-drop.ant-upload-wrapper .ant-upload-drag .ant-upload-btn { padding: 28px 0; }
.rbu-targets { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.rbu-wrap { max-height: calc(100vh - 430px); min-height: 220px; overflow: auto; border: 1px solid var(--c-border, #eef0f3); border-radius: 10px; }
.rbu { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.rbu th { position: sticky; top: 0; z-index: 3; background: var(--c-surface-2, #f7f8fa); text-align: left; font-weight: 600; font-size: 12px; color: var(--c-muted, #595959); padding: 8px 10px; border-bottom: 1px solid var(--c-border, #eef0f3); white-space: nowrap; }
.rbu th b { color: #ff4d4f; font-weight: 600; }
.rbu td { padding: 2px; border-bottom: 1px solid var(--c-border, #f0f0f0); border-right: 1px solid var(--c-border, #f5f5f5); vertical-align: top; background: var(--c-surface, #fff); }
.rbu td:last-child, .rbu th:last-child { border-right: 0; }
.rbu tbody tr:hover td { background: var(--c-tint, #f5f8ff); }
.rbu td:focus-within { box-shadow: inset 0 0 0 2px var(--c-primary, #1677ff); border-radius: 4px; }
.rbu td.bad { box-shadow: inset 0 0 0 1px #ff7875; background: rgba(255, 77, 79, .05); }
.rbu td.lot .ant-select-selection-item { color: var(--c-muted, #8c8c8c); }
.rbu tr.ok td { background: rgba(82, 196, 26, .06); }
.rbu tr.fail td { background: rgba(255, 77, 79, .05); }
.rbu .sx { position: sticky; left: 0; z-index: 2; }
.rbu th.sx { z-index: 4; }
.rbu .n { width: 40px; min-width: 40px; text-align: center; color: var(--c-muted, #8c8c8c); padding-top: 9px; }
.rbu .nm { left: 40px; min-width: 230px; box-shadow: 2px 0 0 var(--c-border, #eef0f3); }
.rbu-file { font-size: 11px; color: var(--c-muted, #8c8c8c); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 11px 4px; }
.rbu-link { padding: 0 11px !important; height: auto !important; font-size: 12px; }
.rbu td.st { vertical-align: middle; padding: 4px 8px; white-space: nowrap; }
.rbu-ok { color: #389e0d; font-weight: 500; }
.rbu-err { color: #cf1322; display: inline-block; max-width: 180px; white-space: normal; font-size: 12px; vertical-align: middle; }
`
