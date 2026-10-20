import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Button, ColorPicker, DatePicker, Form, Input, Popconfirm, Segmented, Select, Slider, Space, Switch, Tabs, Tag } from 'antd'
import { CalendarOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PictureOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { announcementAdmin } from '../../api/announcementAdmin'
import { occasionsApi, EMPTY_OCCASIONS, type CustomOccasion, type OccasionBackground, type OccasionOverride, type OccasionPost, type OccasionSettings, type OccasionText } from '../../api/occasions'
import { adminError } from '../../api/userAdmin'
import { AppModal } from '../../components/AppModal'
import { DataTable } from '../../components/DataTable'
import { PageBanner } from '../../components/PageBanner'
import { useToast } from '../../hooks/useToast'
import { useThemeMode } from '../../theme/ThemeProvider'
import { BUILTIN, paletteFromColors } from '../../theme/occasions'

interface Row { key: string; custom: boolean; name: string; emoji: string[]; ranges: { from: string; to: string }[]; enabled: boolean; background?: OccasionBackground | null; post?: OccasionPost | null }
interface Draft { key: string; custom: boolean; isNew: boolean; name: string; ranges: { from: string; to: string }[]; emoji: string; primary: string; accent: string
  title: OccasionText; sub: OccasionText; background: OccasionBackground; post: OccasionPost }

const NO_BG: OccasionBackground = { kind: 'none', angle: 135, veil: 80 }
const fmtRange = (r: { from: string; to: string }) => (r.from.length === 5 ? `${r.from.split('-').reverse().join('/')} – ${r.to.split('-').reverse().join('/')}` : `${dayjs(r.from).format('DD/MM/YYYY')} – ${dayjs(r.to).format('DD/MM/YYYY')}`)

/** Quản lý dịp lễ: dịp có sẵn (tắt / đổi lời chúc, nền, tự đăng bài) và dịp tự thêm (ngày, biểu tượng, hai màu, lời chúc, nền, tự đăng bài). Lưu một lần cho mọi người dùng. */
export default function OccasionsPage() {
  const { t } = useTranslation()
  const msg = useToast()
  const { setPreview, reloadOccasions } = useThemeMode()
  const q = useQuery({ queryKey: ['occasions'], queryFn: occasionsApi.get })
  const types = useQuery({ queryKey: ['announcement-admin'], queryFn: announcementAdmin.list, retry: false })
  const [data, setData] = useState<OccasionSettings>(EMPTY_OCCASIONS)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [uploading, setUploading] = useState(false)
  useEffect(() => { if (q.data && !dirty) setData(q.data) }, [q.data, dirty])
  const errText = (e: unknown) => t(`occm.err.${adminError(e).detail}`, { defaultValue: t('usr.err.generic') })
  const update = (fn: (d: OccasionSettings) => OccasionSettings) => { setData((d) => fn(d)); setDirty(true) }

  const save = useMutation({
    mutationFn: () => occasionsApi.save(data),
    onSuccess: (saved) => { msg.success(t('occm.saved')); setData(saved); setDirty(false); q.refetch(); reloadOccasions() },
    onError: (e) => msg.error(errText(e)),
  })

  const rows: Row[] = useMemo(() => [
    ...data.custom.map<Row>((c) => ({ key: c.id, custom: true, name: c.name, emoji: c.emoji, ranges: c.ranges, enabled: c.enabled, background: c.background, post: c.post })),
    ...BUILTIN.map<Row>((b) => ({ key: b.key, custom: false, name: t(`occ.${b.key}.name`), emoji: b.emoji, ranges: b.ranges, enabled: !data.disabledBuiltins.includes(b.key), background: data.overrides[b.key]?.background, post: data.overrides[b.key]?.post })),
  ], [data, t])

  const openNew = () => setEditing({ key: '', custom: true, isNew: true, name: '', ranges: [{ from: '11-05', to: '11-06' }], emoji: '🎉 🎈 ✨', primary: '#0F6B3E', accent: '#5FA830', title: { vi: '' }, sub: { vi: '' }, background: NO_BG, post: { enabled: false } })
  const openEdit = (r: Row) => {
    if (r.custom) {
      const c = data.custom.find((x) => x.id === r.key)!
      setEditing({ key: c.id, custom: true, isNew: false, name: c.name, ranges: c.ranges, emoji: c.emoji.join(' '), primary: c.primary, accent: c.accent, title: c.title, sub: c.sub ?? { vi: '' }, background: c.background ?? NO_BG, post: c.post ?? { enabled: false } })
    } else {
      const ov = data.overrides[r.key]
      setEditing({ key: r.key, custom: false, isNew: false, name: r.name, ranges: r.ranges, emoji: r.emoji.join(' '), primary: '', accent: '', title: ov?.title ?? { vi: '' }, sub: ov?.sub ?? { vi: '' }, background: ov?.background ?? NO_BG, post: ov?.post ?? { enabled: false } })
    }
  }

  const apply = () => {
    const d = editing!
    const bg = d.background.kind === 'none' ? null : d.background
    const post = d.post.enabled ? d.post : null
    if (d.custom) {
      const id = d.isNew ? d.name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'dip' : d.key
      const uniq = d.isNew ? `${id}-${Math.random().toString(36).slice(2, 5)}` : id
      const item: CustomOccasion = { id: uniq, name: d.name, enabled: true, ranges: d.ranges, emoji: d.emoji.split(/[\s,]+/).filter(Boolean), primary: d.primary, accent: d.accent, title: d.title, sub: d.sub, background: bg, post }
      update((s) => ({ ...s, custom: d.isNew ? [...s.custom, item] : s.custom.map((c) => (c.id === d.key ? { ...item, enabled: c.enabled } : c)) }))
    } else {
      const ov: OccasionOverride = { title: d.title.vi ? d.title : null, sub: d.sub.vi ? d.sub : null, background: bg, post }
      update((s) => {
        const overrides = { ...s.overrides }
        if (ov.title || ov.sub || ov.background || ov.post) overrides[d.key] = ov; else delete overrides[d.key]
        return { ...s, overrides }
      })
    }
    setEditing(null)
  }

  const toggle = (r: Row, on: boolean) => update((s) => r.custom
    ? { ...s, custom: s.custom.map((c) => (c.id === r.key ? { ...c, enabled: on } : c)) }
    : { ...s, disabledBuiltins: on ? s.disabledBuiltins.filter((k) => k !== r.key) : [...s.disabledBuiltins, r.key] })

  const upload = async (file: File) => {
    setUploading(true)
    try { const url = await occasionsApi.uploadImage(file); setEditing((d) => (d ? { ...d, background: { ...d.background, kind: 'image', imageUrl: url } } : d)) }
    catch { msg.error(t('rte.imageFail')) } finally { setUploading(false) }
  }

  const year = new Date().getFullYear()
  const bgLabel = (b?: OccasionBackground | null) => (b?.kind === 'gradient' ? t('occm.bgGradient') : b?.kind === 'image' ? t('occm.bgImage') : t('occm.bgDefault'))
  const postedThisYear = (key: string) => data.posted.includes(`${key}:${year}`)
  const typeOptions = (types.data?.types ?? []).map((x) => ({ value: x, label: x }))

  const columns = [
    { title: t('occm.colName'), render: (_: unknown, r: Row) => <span><span style={{ fontSize: 18, marginRight: 8 }}>{r.emoji[0]}</span><b>{r.name}</b>{r.custom && <Tag color="purple" variant="filled" style={{ marginLeft: 8 }}>{t('occm.customTag')}</Tag>}</span> },
    { title: t('occm.colDates'), width: 260, render: (_: unknown, r: Row) => r.ranges.map((x, i) => <div key={i} style={{ fontSize: 12.5 }}>{fmtRange(x)}</div>) },
    { title: t('occm.colBg'), width: 120, render: (_: unknown, r: Row) => <Tag variant="filled">{bgLabel(r.background)}</Tag> },
    { title: t('occm.colPost'), width: 150, render: (_: unknown, r: Row) => (r.post?.enabled ? <Tag color={postedThisYear(r.key) ? 'success' : 'processing'} variant="filled">{postedThisYear(r.key) ? t('occm.posted') : t('occm.postOn')}</Tag> : <span className="cell-muted">-</span>) },
    { title: t('occm.colOn'), width: 90, align: 'center' as const, render: (_: unknown, r: Row) => <Switch checked={r.enabled} onChange={(v) => toggle(r, v)} /> },
    { title: '', width: 210, render: (_: unknown, r: Row) => (
      <Space size={4}>
        <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(r.key)}>{t('occm.preview')}</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>{t('req.edit')}</Button>
        {r.custom && <Popconfirm title={t('occm.deleteAsk')} okText={t('req.delete')} okButtonProps={{ danger: true }} cancelText={t('req.cancel')} onConfirm={() => update((s) => ({ ...s, custom: s.custom.filter((c) => c.id !== r.key) }))}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
      </Space>
    ) },
  ]

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setEditing((d) => (d ? { ...d, [k]: v } : d))
  const txt = (field: 'title' | 'sub', lang: 'vi' | 'en' | 'ko', ph?: string) => (
    <Input value={editing?.[field][lang] ?? ''} maxLength={field === 'title' ? 120 : 200} placeholder={ph} onChange={(e) => set(field, { ...editing![field], [lang]: e.target.value })} addonBefore={lang.toUpperCase()} />
  )
  const bg = editing?.background ?? NO_BG
  const preview = bg.kind === 'gradient' && bg.color1 && bg.color2 ? `linear-gradient(${bg.angle}deg, ${bg.color1}, ${bg.color2})` : bg.kind === 'image' && bg.imageUrl ? `url("${bg.imageUrl}") center / cover no-repeat` : undefined
  const pal = editing?.custom ? paletteFromColors(editing.primary || '#0F6B3E', editing.accent || '#5FA830') : null

  return (
    <div className="page wide">
      <PageBanner avatar={<Avatar size={56} icon={<CalendarOutlined />} />} title={t('nav.occasions')} subtitle={t('nav.occasionsDesc')}
        extra={<Space wrap>
          <Button icon={<PlusOutlined />} onClick={openNew}>{t('occm.add')}</Button>
          <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>{t('req.saveChanges')}</Button>
        </Space>} />
      {dirty && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t('occm.dirty')} />}
      <DataTable<Row> rowKey="key" loading={q.isLoading} columns={columns} dataSource={rows} pagination={false} locale={{ emptyText: q.isError ? t('usr.err.generic') : '' }} />

      <AppModal open={!!editing} onClose={() => setEditing(null)} size="lg" icon={<CalendarOutlined />} title={editing?.isNew ? t('occm.add') : t('occm.editTitle')} subtitle={editing?.name || undefined}
        okText={t('occm.apply')} onOk={apply} okDisabled={!editing || (editing.custom && (editing.name.trim().length < 2 || !editing.title.vi.trim() || editing.ranges.length === 0))}>
        {editing && (
          <Tabs items={[
            ...(editing.custom ? [{
              key: 'general', label: t('occm.tabGeneral'), children: (
                <Form layout="vertical">
                  <Form.Item label={t('occm.name')} required><Input value={editing.name} maxLength={80} onChange={(e) => set('name', e.target.value)} /></Form.Item>
                  <Form.Item label={t('occm.dates')} extra={t('occm.datesHint')}>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      {editing.ranges.map((r, i) => (
                        <Space key={i} wrap>
                          <Segmented size="small" value={r.from.length === 5 ? 'yearly' : 'once'}
                            options={[{ value: 'yearly', label: t('occm.yearly') }, { value: 'once', label: t('occm.once') }]}
                            onChange={(v) => set('ranges', editing.ranges.map((x, k) => (k === i ? (v === 'yearly' ? { from: x.from.slice(-5), to: x.to.slice(-5) } : { from: `${year}-${x.from.slice(-5)}`, to: `${year}-${x.to.slice(-5)}` }) : x)))} />
                          <DatePicker.RangePicker format={r.from.length === 5 ? 'DD/MM' : 'DD/MM/YYYY'}
                            value={[dayjs(r.from.length === 5 ? `2024-${r.from}` : r.from), dayjs(r.to.length === 5 ? `2024-${r.to}` : r.to)]}
                            onChange={(v) => v?.[0] && v[1] && set('ranges', editing.ranges.map((x, k) => (k === i ? (r.from.length === 5 ? { from: v[0]!.format('MM-DD'), to: v[1]!.format('MM-DD') } : { from: v[0]!.format('YYYY-MM-DD'), to: v[1]!.format('YYYY-MM-DD') }) : x)))} />
                          {editing.ranges.length > 1 && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => set('ranges', editing.ranges.filter((_, k) => k !== i))} />}
                        </Space>
                      ))}
                      {editing.ranges.length < 6 && <Button size="small" icon={<PlusOutlined />} onClick={() => set('ranges', [...editing.ranges, { from: '11-05', to: '11-06' }])}>{t('occm.addRange')}</Button>}
                    </Space>
                  </Form.Item>
                  <Form.Item label={t('occm.emoji')} extra={t('occm.emojiHint')}><Input value={editing.emoji} maxLength={40} onChange={(e) => set('emoji', e.target.value)} /></Form.Item>
                  <Space size="large" wrap>
                    <Form.Item label={t('occm.primary')}><ColorPicker value={editing.primary} onChange={(c) => set('primary', c.toHexString().toUpperCase().slice(0, 7))} showText /></Form.Item>
                    <Form.Item label={t('occm.accent')}><ColorPicker value={editing.accent} onChange={(c) => set('accent', c.toHexString().toUpperCase().slice(0, 7))} showText /></Form.Item>
                    {pal && <div style={{ width: 220, height: 40, borderRadius: 10, background: `linear-gradient(110deg, ${pal.deep}, ${pal.primary} 55%, ${pal.accent})` }} />}
                  </Space>
                </Form>
              ),
            }] : []),
            {
              key: 'greeting', label: t('occm.tabGreeting'), children: (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Alert type="info" showIcon title={editing.custom ? t('occm.greetingHintCustom') : t('occm.greetingHintBuiltin')} />
                  <div><b>{t('occm.greetTitle')}</b></div>
                  {txt('title', 'vi', editing.custom ? '' : t(`occ.${editing.key}.title`, { year }))}
                  {txt('title', 'en')}
                  {txt('title', 'ko')}
                  <div style={{ marginTop: 8 }}><b>{t('occm.greetSub')}</b></div>
                  {txt('sub', 'vi', editing.custom ? '' : t(`occ.${editing.key}.sub`, { year }))}
                  {txt('sub', 'en')}
                  {txt('sub', 'ko')}
                </Space>
              ),
            },
            {
              key: 'bg', label: <span><PictureOutlined /> {t('occm.tabBg')}</span>, children: (
                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                  <Segmented value={bg.kind} onChange={(v) => set('background', { ...bg, kind: v as OccasionBackground['kind'] })}
                    options={[{ value: 'none', label: t('occm.bgDefault') }, { value: 'gradient', label: t('occm.bgGradient') }, { value: 'image', label: t('occm.bgImage') }]} />
                  {bg.kind === 'gradient' && (
                    <Space size="large" wrap>
                      <span>{t('occm.color1')} <ColorPicker value={bg.color1 ?? '#D6336C'} onChange={(c) => set('background', { ...bg, color1: c.toHexString().toUpperCase().slice(0, 7), color2: bg.color2 ?? '#FF8FB7' })} showText /></span>
                      <span>{t('occm.color2')} <ColorPicker value={bg.color2 ?? '#FF8FB7'} onChange={(c) => set('background', { ...bg, color2: c.toHexString().toUpperCase().slice(0, 7), color1: bg.color1 ?? '#D6336C' })} showText /></span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 260 }}>{t('occm.angle')} <Slider style={{ flex: 1 }} min={0} max={360} value={bg.angle} onChange={(v) => set('background', { ...bg, angle: v })} /></span>
                    </Space>
                  )}
                  {bg.kind === 'image' && (
                    <Space wrap>
                      <label className="ant-btn ant-btn-default" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                        <PictureOutlined /> {uploading ? t('rte.imageBusy') : bg.imageUrl ? t('occm.replaceImage') : t('occm.uploadImage')}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
                      </label>
                      <span className="cell-muted">{t('occm.imageHint')}</span>
                    </Space>
                  )}
                  {bg.kind !== 'none' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 190 }}>{t('occm.veil')}</span>
                        <Slider style={{ flex: 1 }} min={0} max={90} value={bg.veil} onChange={(v) => set('background', { ...bg, veil: v })} />
                      </div>
                      <div style={{ height: 150, borderRadius: 14, background: preview ?? 'var(--c-surface-2)', border: '1px solid var(--c-border)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 18, borderRadius: 10, background: `color-mix(in srgb, var(--c-bg) ${bg.veil}%, transparent)`, display: 'grid', placeItems: 'center', fontWeight: 600 }}>{t('occm.previewText')}</div>
                      </div>
                    </>
                  )}
                </Space>
              ),
            },
            {
              key: 'post', label: t('occm.tabPost'), children: (
                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                  <Alert type="info" showIcon title={t('occm.postHint')} />
                  <span><Switch checked={editing.post.enabled} onChange={(v) => set('post', { ...editing.post, enabled: v })} /> {t('occm.postSwitch')}</span>
                  {editing.post.enabled && (
                    <>
                      <Form layout="vertical">
                        <Form.Item label={t('occm.postType')}>
                          {typeOptions.length > 0
                            ? <Select allowClear value={editing.post.type ?? undefined} placeholder={t('occm.postTypeDefault')} options={typeOptions} onChange={(v) => set('post', { ...editing.post, type: v ?? null })} />
                            : <Input value={editing.post.type ?? ''} placeholder={t('occm.postTypeDefault')} onChange={(e) => set('post', { ...editing.post, type: e.target.value || null })} />}
                        </Form.Item>
                        <Form.Item label={t('occm.postTitle')}><Input value={editing.post.title ?? ''} maxLength={300} placeholder={t('occm.postTitlePh')} onChange={(e) => set('post', { ...editing.post, title: e.target.value || null })} /></Form.Item>
                        <Form.Item label={t('occm.postBody')} extra={t('occm.postBodyHint')}><Input.TextArea rows={5} value={editing.post.html ?? ''} maxLength={8000} onChange={(e) => set('post', { ...editing.post, html: e.target.value || null })} /></Form.Item>
                      </Form>
                      {!editing.isNew && postedThisYear(editing.key) && <Tag color="success" variant="filled">{t('occm.postedThisYear', { year })}</Tag>}
                    </>
                  )}
                </Space>
              ),
            },
          ]} />
        )}
      </AppModal>
    </div>
  )
}
