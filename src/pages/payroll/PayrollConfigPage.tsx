import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, Card, Collapse, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, DeleteOutlined, PlayCircleOutlined, PlusOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PAYROLL_TABLE_SQL, payroll, payrollError, type ConfigIssue, type PayItem, type PayKind, type PayrollConfig, type PayrollVersion } from '../../api/payroll'
import { PageBanner } from '../../components/PageBanner'
import { SqlNotReady } from '../../components/SqlNotReady'
import { useToast } from '../../hooks/useToast'

const KINDS: PayKind[] = ['income', 'deduction', 'total', 'calc', 'info']
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

interface Draft { id: number | null; effectiveFrom: string; name: string; config: PayrollConfig }
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const toDraft = (v: PayrollVersion): Draft => ({ id: v.builtin ? null : v.id, effectiveFrom: v.effectiveFrom, name: v.name, config: clone(v.config) })

/** Màn thay đổi công thức tính lương và các mức tiền: mỗi phiên bản áp dụng từ một kỳ lương (MM/yyyy) trở đi. */
export default function PayrollConfigPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['payroll', 'config'], queryFn: payroll.config, retry: false })
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [issues, setIssues] = useState<ConfigIssue[]>([])
  const [testVars, setTestVars] = useState<{ name: string; value: number }[]>([])
  const [testOut, setTestOut] = useState<{ values: Record<string, number>; errors: string[] } | null>(null)

  const versions = useMemo(() => q.data?.versions ?? [], [q.data])
  // Chọn phiên bản mới nhất khi vào màn hoặc sau khi lưu/xóa
  useEffect(() => {
    if (!versions.length) return
    const found = versions.find((v) => v.effectiveFrom === sel)
    if (!found) { const last = versions[versions.length - 1]; setSel(last.effectiveFrom); setDraft(toDraft(last)); setIssues([]); setTestOut(null) }
  }, [versions, sel])

  const pick = (from: string) => { const v = versions.find((x) => x.effectiveFrom === from); if (v) { setSel(from); setDraft(toDraft(v)); setIssues([]); setTestOut(null) } }
  const patch = (fn: (d: Draft) => void) => setDraft((d) => { if (!d) return d; const n = clone(d); fn(n); return n })
  const issueText = (i: ConfigIssue) => `${t(`prl.cfgIssue.${i.code}`, { defaultValue: i.code })}${i.where ? ` — ${i.where}` : ''}${i.detail ? ` (${i.detail})` : ''}`

  const errText = (e: unknown) => {
    const { code, detail, issues: iss } = payrollError(e)
    if (iss.length) setIssues(iss)
    if (code === 'conflict') return t('prl.err.conflict')
    if (code === 'table_missing') return t('prl.err.table')
    if (code === 'invalid_input') return iss.length ? t('prl.err.invalid') : (detail ? t(`prl.cfgIssue.${detail}`, { defaultValue: detail }) : t('cls.err.generic'))
    return t('cls.err.generic')
  }
  const validate = useMutation({
    mutationFn: () => payroll.validate(draft!.config),
    onSuccess: (iss) => { setIssues(iss); if (!iss.length) msg.success(t('prl.valid')) },
    onError: (e) => msg.error(errText(e)),
  })
  const save = useMutation({
    mutationFn: async () => {
      const b = { effectiveFrom: draft!.effectiveFrom.trim(), name: draft!.name.trim(), config: draft!.config }
      if (draft!.id == null) await payroll.create(b); else await payroll.update(draft!.id, b)
      return b.effectiveFrom
    },
    onSuccess: async (from) => { msg.success(t('prl.saved')); setIssues([]); setSel(from); await qc.invalidateQueries({ queryKey: ['payroll', 'config'] }); await q.refetch() },
    onError: (e) => msg.error(errText(e)),
  })
  const remove = useMutation({
    mutationFn: () => payroll.remove(draft!.id!),
    onSuccess: async () => { msg.success(t('prl.deleted')); setSel(null); await qc.invalidateQueries({ queryKey: ['payroll', 'config'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const seed = useMutation({
    mutationFn: payroll.seed,
    onSuccess: async () => { msg.success(t('prl.seeded')); setSel(null); await qc.invalidateQueries({ queryKey: ['payroll', 'config'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const reset = useMutation({
    mutationFn: payroll.reset,
    onSuccess: async () => { msg.success(t('prl.resetDone')); setSel(null); await qc.invalidateQueries({ queryKey: ['payroll', 'config'] }) },
    onError: (e) => msg.error(errText(e)),
  })
  const test = useMutation({
    mutationFn: () => payroll.test(draft!.config, Object.fromEntries(testVars.filter((v) => v.name).map((v) => [v.name, v.value]))),
    onSuccess: setTestOut,
    onError: (e) => msg.error(errText(e)),
  })

  if (q.data && !q.data.ready) {
    return (
      <div className="page wide">
        <PageBanner avatar={<Avatar size={56} icon={<SettingOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payrollConfig')} subtitle={t('nav.payrollConfigDesc')} />
        <SqlNotReady title={t('prl.notReady')} sql={PAYROLL_TABLE_SQL} onRetry={() => q.refetch()} loading={q.isFetching} />
      </div>
    )
  }

  const cfg = draft?.config
  const isNew = draft?.id == null
  const percent = (u: string) => u === '%'
  const varOptions = [...(q.data?.variables ?? []).map((v) => v.name), ...(cfg?.inputs ?? []).map((i) => i.key)]
  const move = (idx: number, d: -1 | 1) => patch((n) => { const j = idx + d; if (j < 0 || j >= n.config.items.length) return; [n.config.items[idx], n.config.items[j]] = [n.config.items[j], n.config.items[idx]] })

  const itemCols: ColumnsType<PayItem> = [
    { title: '#', width: 44, render: (_, __, i) => i + 1 },
    { title: t('prl.cLabel'), width: 220, render: (_, r, i) => <Input value={r.label} onChange={(e) => patch((n) => { n.config.items[i].label = e.target.value })} /> },
    { title: t('prl.cKey'), width: 150, render: (_, r, i) => <Input value={r.key} status={KEY_RE.test(r.key) ? undefined : 'error'} onChange={(e) => patch((n) => { n.config.items[i].key = e.target.value })} /> },
    { title: t('prl.cKind'), width: 140, render: (_, r, i) => <Select value={r.kind} style={{ width: '100%' }} options={KINDS.map((k) => ({ value: k, label: t(`prl.kind.${k}`) }))} onChange={(v) => patch((n) => { n.config.items[i].kind = v })} /> },
    { title: t('prl.cFormula'), width: 420, render: (_, r, i) => <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} value={r.formula} style={{ fontFamily: 'Consolas, monospace' }} onChange={(e) => patch((n) => { n.config.items[i].formula = e.target.value })} /> },
    { title: t('prl.cSlip'), width: 190, render: (_, r, i) => <Select allowClear showSearch value={r.payslip ?? undefined} style={{ width: '100%' }} placeholder="—" options={(q.data?.payslipFields ?? []).map((f) => ({ value: f.key, label: t(`pay.f.${f.key}`, { defaultValue: f.key }) }))} optionFilterProp="label" onChange={(v) => patch((n) => { n.config.items[i].payslip = v ?? null })} /> },
    { title: t('prl.cVisible'), width: 80, align: 'center', render: (_, r, i) => <Switch size="small" checked={r.visible} onChange={(v) => patch((n) => { n.config.items[i].visible = v })} /> },
    { title: t('prl.cRound'), width: 80, align: 'center', render: (_, r, i) => <Switch size="small" checked={r.round} onChange={(v) => patch((n) => { n.config.items[i].round = v })} /> },
    {
      title: '', width: 110, fixed: 'right', render: (_, __, i) => (
        <Space size={0}>
          <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />
          <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={i === (cfg?.items.length ?? 0) - 1} onClick={() => move(i, 1)} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => patch((n) => { n.config.items.splice(i, 1) })} />
        </Space>
      ),
    },
  ]

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<SettingOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} />} title={t('nav.payrollConfig')} subtitle={t('nav.payrollConfigDesc')} />

      {q.data?.usingBuiltin && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('prl.builtinTitle')} description={t('prl.builtinText')}
          action={<Popconfirm title={t('prl.seedConfirm')} onConfirm={() => seed.mutate()}><Button size="small" type="primary" loading={seed.isPending}>{t('prl.seed')}</Button></Popconfirm>} />
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Typography.Text strong>{t('prl.version')}:</Typography.Text>
          <Select style={{ minWidth: 300 }} value={sel ?? undefined} onChange={pick}
            options={versions.map((v) => ({ value: v.effectiveFrom, label: `${v.name} — ${t('prl.from')} ${v.effectiveFrom}${v.builtin ? ` (${t('prl.builtinTag')})` : ''}` }))} />
          {draft && !q.data?.usingBuiltin && (
            <Popconfirm title={t('prl.resetConfirm')} okButtonProps={{ danger: true }} onConfirm={() => reset.mutate()}><Button danger loading={reset.isPending}>{t('prl.reset')}</Button></Popconfirm>
          )}
          {draft && (
            <Button icon={<PlusOutlined />} onClick={() => { setDraft({ ...clone(draft), id: null, effectiveFrom: '', name: `${draft.name} (${t('prl.copy')})` }); setSel(null); setIssues([]) }}>{t('prl.newFromThis')}</Button>
          )}
        </Space>
        {draft && (
          <Space wrap style={{ marginTop: 12 }}>
            <Typography.Text>{t('prl.effectiveFrom')}</Typography.Text>
            <Input style={{ width: 110 }} placeholder="MM/yyyy" value={draft.effectiveFrom} onChange={(e) => patch((n) => { n.effectiveFrom = e.target.value })} />
            <Typography.Text>{t('prl.name')}</Typography.Text>
            <Input style={{ width: 280 }} value={draft.name} onChange={(e) => patch((n) => { n.name = e.target.value })} />
            <Button icon={<CheckCircleOutlined />} loading={validate.isPending} onClick={() => validate.mutate()}>{t('prl.check')}</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={save.isPending} onClick={() => save.mutate()}>{isNew ? t('prl.saveNew') : t('common.save', { defaultValue: 'Lưu' })}</Button>
            {!isNew && versions.length > 1 && (
              <Popconfirm title={t('prl.deleteConfirm')} onConfirm={() => remove.mutate()}><Button danger icon={<DeleteOutlined />} loading={remove.isPending}>{t('prl.delete')}</Button></Popconfirm>
            )}
          </Space>
        )}
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>{t('prl.versionHelp')}</Typography.Paragraph>
      </Card>

      {issues.length > 0 && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} title={`${t('prl.issues')} (${issues.length})`}
          description={<ul style={{ margin: 0, paddingLeft: 18 }}>{issues.slice(0, 12).map((i, k) => <li key={k}>{issueText(i)}</li>)}{issues.length > 12 && <li>…</li>}</ul>} />
      )}

      {cfg && (
        <Tabs items={[
          {
            key: 'params', label: t('prl.tabParams'), children: (
              <>
                <Typography.Paragraph type="secondary">{t('prl.paramsHelp')}</Typography.Paragraph>
                <Table size="small" rowKey="key" pagination={false} dataSource={cfg.params}
                  columns={[
                    { title: t('prl.pGroup'), dataIndex: 'group', width: 130, render: (g: string) => <Tag>{t(`prl.group.${g}`, { defaultValue: g })}</Tag> },
                    { title: t('prl.cLabel'), dataIndex: 'label' },
                    { title: t('prl.cKey'), dataIndex: 'key', width: 160, render: (k: string) => <code>{k}</code> },
                    {
                      title: t('prl.pValue'), width: 210, render: (_, r, i) => (
                        <InputNumber style={{ width: '100%' }} value={percent(r.unit) ? Math.round(r.value * 100000) / 1000 : r.value}
                          formatter={(v) => (v == null ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','))} parser={(v) => Number((v ?? '').replace(/,/g, ''))}
                          onChange={(v) => patch((n) => { n.config.params[i].value = percent(r.unit) ? (v ?? 0) / 100 : (v ?? 0) })} />
                      ),
                    },
                    { title: t('prl.pUnit'), dataIndex: 'unit', width: 70 },
                  ]} />
              </>
            ),
          },
          {
            key: 'inputs', label: t('prl.tabInputs'), children: (
              <>
                <Typography.Paragraph type="secondary">{t('prl.inputsHelp')} {t('prl.persistHelp')}</Typography.Paragraph>
                <Table size="small" rowKey={(_, i) => `${i}`} pagination={false} dataSource={cfg.inputs}
                  columns={[
                    { title: t('prl.iHeader'), render: (_, r, i) => <Input value={r.header} onChange={(e) => patch((n) => { n.config.inputs[i].header = e.target.value })} /> },
                    { title: t('prl.cKey'), width: 170, render: (_, r, i) => <Input value={r.key} status={KEY_RE.test(r.key) ? undefined : 'error'} onChange={(e) => patch((n) => { n.config.inputs[i].key = e.target.value })} /> },
                    { title: t('prl.cLabel'), render: (_, r, i) => <Input value={r.label} onChange={(e) => patch((n) => { n.config.inputs[i].label = e.target.value })} /> },
                    { title: t('prl.iPersist'), width: 120, align: 'center', render: (_, r, i) => <Switch size="small" checked={!!r.persist} onChange={(v) => patch((n) => { n.config.inputs[i].persist = v })} /> },
                    { title: t('prl.iDefault'), width: 140, render: (_, r, i) => <InputNumber style={{ width: '100%' }} value={r.default} onChange={(v) => patch((n) => { n.config.inputs[i].default = v ?? 0 })} /> },
                    { title: '', width: 50, render: (_, __, i) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => patch((n) => { n.config.inputs.splice(i, 1) })} /> },
                  ]} />
                <Button style={{ marginTop: 8 }} icon={<PlusOutlined />} onClick={() => patch((n) => { n.config.inputs.push({ key: '', label: '', header: '', default: 0 }) })}>{t('prl.addInput')}</Button>
              </>
            ),
          },
          {
            key: 'items', label: t('prl.tabItems'), children: (
              <>
                <Typography.Paragraph type="secondary">{t('prl.itemsHelp')}</Typography.Paragraph>
                <Collapse size="small" style={{ marginBottom: 12 }} items={[{
                  key: 'vars', label: t('prl.varsTitle'), children: (
                    <>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 6 }}>{t('prl.varsHelp', { functions: (q.data?.functions ?? []).join(', ') })}</Typography.Paragraph>
                      {Object.entries((q.data?.variables ?? []).reduce<Record<string, { name: string; label: string }[]>>((acc, v) => { (acc[v.group] ??= []).push(v); return acc }, {})).map(([g, list]) => (
                        <div key={g} style={{ marginBottom: 6 }}>
                          <b>{t(`prl.vgroup.${g}`, { defaultValue: g })}: </b>
                          {list.map((v) => <Tag key={v.name} title={v.label} style={{ cursor: 'pointer' }} onClick={() => navigator.clipboard?.writeText(v.name)}>{v.name}</Tag>)}
                        </div>
                      ))}
                      <div><b>{t('prl.vgroup.params')}: </b>{cfg.params.map((p) => <Tag key={p.key} title={p.label}>{p.key}</Tag>)}</div>
                      <div><b>{t('prl.vgroup.inputs')}: </b>{cfg.inputs.map((p) => <Tag key={p.key} title={p.label}>{p.key}</Tag>)}</div>
                    </>
                  ),
                }]} />
                <Table size="small" rowKey={(_, i) => `${i}`} pagination={false} columns={itemCols} dataSource={cfg.items} scroll={{ x: 'max-content' }} />
                <Button style={{ marginTop: 8 }} icon={<PlusOutlined />} onClick={() => patch((n) => { n.config.items.push({ key: '', label: '', kind: 'calc', formula: '0', payslip: null, visible: true, round: true }) })}>{t('prl.addItem')}</Button>
              </>
            ),
          },
          {
            key: 'tax', label: t('prl.tabTax'), children: (
              <>
                <Typography.Paragraph type="secondary">{t('prl.taxHelp')}</Typography.Paragraph>
                <Table size="small" rowKey={(_, i) => `${i}`} pagination={false} dataSource={cfg.taxBrackets}
                  columns={[
                    { title: t('prl.tUpTo'), render: (_, r, i) => <InputNumber style={{ width: 240 }} value={r.upTo ?? undefined} placeholder={t('prl.tRest')} formatter={(v) => (v == null ? '' : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','))} parser={(v) => Number((v ?? '').replace(/,/g, ''))} onChange={(v) => patch((n) => { n.config.taxBrackets[i].upTo = v ?? null })} /> },
                    { title: t('prl.tRate'), render: (_, r, i) => <InputNumber style={{ width: 120 }} min={0} max={100} addonAfter="%" value={Math.round(r.rate * 100000) / 1000} onChange={(v) => patch((n) => { n.config.taxBrackets[i].rate = (v ?? 0) / 100 })} /> },
                    { title: '', width: 50, render: (_, __, i) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => patch((n) => { n.config.taxBrackets.splice(i, 1) })} /> },
                  ]} />
                <Button style={{ marginTop: 8 }} icon={<PlusOutlined />} onClick={() => patch((n) => { n.config.taxBrackets.push({ upTo: null, rate: 0 }) })}>{t('prl.addBracket')}</Button>
              </>
            ),
          },
          {
            key: 'test', label: t('prl.tabTest'), children: (
              <>
                <Typography.Paragraph type="secondary">{t('prl.testHelp')}</Typography.Paragraph>
                {testVars.map((v, i) => (
                  <Space key={i} style={{ display: 'flex', marginBottom: 6 }}>
                    <Select showSearch style={{ width: 260 }} value={v.name || undefined} placeholder={t('prl.testVar')} options={[...new Set(varOptions)].map((n) => ({ value: n, label: n }))}
                      onChange={(n) => setTestVars((a) => a.map((x, k) => (k === i ? { ...x, name: n } : x)))} />
                    <InputNumber style={{ width: 180 }} value={v.value} onChange={(n) => setTestVars((a) => a.map((x, k) => (k === i ? { ...x, value: n ?? 0 } : x)))} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setTestVars((a) => a.filter((_, k) => k !== i))} />
                  </Space>
                ))}
                <Space>
                  <Button icon={<PlusOutlined />} onClick={() => setTestVars((a) => [...a, { name: '', value: 0 }])}>{t('prl.testAdd')}</Button>
                  <Button type="primary" icon={<PlayCircleOutlined />} loading={test.isPending} onClick={() => test.mutate()}>{t('prl.testRun')}</Button>
                </Space>
                {testOut && (
                  <div style={{ marginTop: 12 }}>
                    {testOut.errors.length > 0 && <Alert type="error" showIcon style={{ marginBottom: 8 }} title={testOut.errors.join('; ')} />}
                    <Table size="small" rowKey="key" pagination={false} dataSource={cfg.items.filter((i) => i.key in testOut.values)}
                      columns={[
                        { title: t('prl.cLabel'), dataIndex: 'label' },
                        { title: t('prl.cKey'), dataIndex: 'key', width: 180, render: (k: string) => <code>{k}</code> },
                        { title: t('prl.testValue'), width: 180, align: 'right', render: (_, r) => (r.kind === 'total' ? <b>{testOut.values[r.key].toLocaleString()}</b> : testOut.values[r.key].toLocaleString()) },
                      ]} />
                  </div>
                )}
              </>
            ),
          },
        ]} />
      )}
    </div>
  )
}
