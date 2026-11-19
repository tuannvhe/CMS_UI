import { Descriptions, Modal, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { DASH_CSS, TrendBars } from '../../components/DashKit'
import { CATS, FREQ_LABEL, metaOf } from './kpiMeta'
import { MONTHS, STATUS_COLOR, achievement, fmtVal, pick, statusOf, type KpiItem } from './kpiDemoData'
import type { KpiItem as KpiApiItem } from '../../api/kpi'
import { CatLabel } from './KpiParts'
import { fmtNum, pickName } from './kpiShared'

/** Hộp thoại chi tiết một chỉ tiêu MẪU (tab Line sản xuất / KPI theo nhân viên vẫn là demo). Chỉ tiêu thật dùng KpiItemDrawer bên dưới. */
export default function KpiDetailDrawer({ item, title, onClose }: { item: KpiItem | null; title?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const meta = item ? metaOf(item.id) : null
  const rows = item ? MONTHS.map((mm, i) => ({ mm, v: item.actual[i], p: achievement(item, item.actual[i]) })) : []
  const cols: ColumnsType<(typeof rows)[number]> = item ? [
    { title: t('kpi.month'), dataIndex: 'mm' },
    { title: t('kpi.col.actual'), key: 'v', align: 'right', render: (_, r) => fmtVal(r.v, item.unit) },
    { title: t('kpi.col.achieve'), key: 'p', align: 'right', render: (_, r) => <b style={{ color: STATUS_COLOR[statusOf(r.p)] }}>{r.p}%</b> },
    { title: t('kpi.col.status'), key: 's', render: (_, r) => <Tag color={STATUS_COLOR[statusOf(r.p)]}>{t(`kpi.status.${statusOf(r.p)}`)}</Tag> },
  ] : []
  return (
    <Modal open={!!item} onCancel={onClose} footer={null} width={640} centered title={item ? pick(item.name, lang) : ''} destroyOnClose styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}>
      {item && meta && (
        <>
          {title && <div style={{ marginBottom: 12, opacity: 0.7 }}>{title}</div>}
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label={t('kpi.det.group')}><Tag color={CATS[meta.cat].color}>{pick(CATS[meta.cat].name, lang)}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.formula')}>{pick(meta.formula, lang)}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.source')}>{pick(meta.source, lang)}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.freq')}>{pick(FREQ_LABEL[meta.freq], lang)}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.col.target')}>{item.lowerIsBetter ? '≤ ' : '≥ '}{fmtVal(item.target, item.unit)}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.col.weight')}>{item.weight}%</Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.rule')}>{item.lowerIsBetter ? t('kpi.det.ruleLower') : t('kpi.det.ruleHigher')}</Descriptions.Item>
          </Descriptions>
          <div style={{ margin: '16px 0 4px', fontWeight: 600 }}>{t('kpi.det.history')}</div>
          <TrendBars labels={MONTHS} tips={MONTHS} values={item.actual} height={170} />
          <Table size="small" rowKey="mm" columns={cols} dataSource={rows} pagination={false} style={{ marginTop: 8 }} />
          <style>{DASH_CSS}</style>
        </>
      )}
    </Modal>
  )
}

/** Hộp thoại chi tiết một chỉ tiêu của phiếu KPI thật (dữ liệu từ API): định nghĩa trong thư viện, mục tiêu, trọng số và diễn biến các kỳ gần nhất. */
export function KpiItemDrawer({ item, title, onClose }: { item: KpiApiItem | null; title?: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const ind = item?.indicator
  const hist = item?.history ?? []
  const cols: ColumnsType<KpiApiItem['history'][number]> = [
    { title: t('kpi.period.label'), dataIndex: 'periodCode' },
    { title: t('kpi.col.actual'), key: 'v', align: 'right', render: (_, r) => fmtNum(r.actual, ind?.unit) },
    { title: t('kpi.col.achieve'), key: 'p', align: 'right', render: (_, r) => (r.achieve == null ? '—' : <b style={{ color: STATUS_COLOR[statusOf(r.achieve)] }}>{r.achieve}%</b>) },
    { title: t('kpi.col.status'), key: 's', render: (_, r) => (r.achieve == null ? '' : <Tag color={STATUS_COLOR[statusOf(r.achieve)]}>{t(`kpi.status.${statusOf(r.achieve)}`)}</Tag>) },
  ]
  return (
    <Modal open={!!item} onCancel={onClose} footer={null} width={640} centered title={item && ind ? `${ind.code} · ${pickName(ind.name, i18n.language)}` : ''} destroyOnHidden styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}>
      {item && ind && (
        <>
          {title && <div style={{ marginBottom: 12, opacity: 0.7 }}>{title}</div>}
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label={t('kpi.det.group')}><CatLabel cat={ind.category} /></Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.formula')}>{ind.formula || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.source')}>{ind.source || '—'} <Tag style={{ marginLeft: 6 }}>{t(`kpi.lib.sk.${ind.sourceKind}`)}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.freq')}>{t(`kpi.lib.fr.${ind.frequency}`)}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.lib.valueType')}>{t(`kpi.lib.vt.${ind.valueType}`)}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.col.target')}>{ind.valueType === 'yesno' ? t('kpi.sheet.yes') : `${ind.lowerBetter ? '≤ ' : '≥ '}${fmtNum(item.target, ind.unit)}`}</Descriptions.Item>
            <Descriptions.Item label={t('kpi.col.weight')}>{item.weight}%</Descriptions.Item>
            <Descriptions.Item label={t('kpi.det.rule')}>{ind.valueType === 'yesno' ? t('kpi.det.ruleYesNo') : ind.lowerBetter ? t('kpi.det.ruleLower') : t('kpi.det.ruleHigher')}</Descriptions.Item>
            {item.note && <Descriptions.Item label={t('kpi.sheet.note')}>{item.note}</Descriptions.Item>}
          </Descriptions>
          <div style={{ margin: '16px 0 4px', fontWeight: 600 }}>{t('kpi.det.historyN')}</div>
          {hist.length > 0 && <TrendBars labels={hist.map((h) => h.periodCode)} tips={hist.map((h) => `${h.periodCode} (%)`)} values={hist.map((h) => h.achieve ?? 0)} height={150} />}
          <Table size="small" rowKey="periodCode" columns={cols} dataSource={hist} pagination={false} style={{ marginTop: 8 }} locale={{ emptyText: t('kpi.noData') }} />
          <style>{DASH_CSS}</style>
        </>
      )}
    </Modal>
  )
}
