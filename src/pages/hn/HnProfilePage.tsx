import { Alert, Button, Card, Descriptions, Result, Skeleton } from 'antd'
import { IdcardOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { hnApi, hnErrorCode, hnErrorKey, type HnProfile } from '../../api/hn'
import { useAuth } from '../../auth/AuthContext'
import { PageBanner } from '../../components/PageBanner'
import { fmtCell } from '../../utils/hnFormat'

type Field = keyof HnProfile
const SECTIONS: { title: string; fields: Field[] }[] = [
  { title: 'hn.profile.sectionPersonal', fields: ['employeeId', 'fullName', 'birthday', 'sex', 'nation', 'married', 'place', 'address'] },
  { title: 'hn.profile.sectionWork', fields: ['department', 'position', 'process', 'title', 'startWork', 'workStatus'] },
  { title: 'hn.profile.sectionIdentity', fields: ['identityCardMasked', 'identityIssued', 'identityPlace', 'email', 'phone'] },
  { title: 'hn.profile.sectionEducation', fields: ['school', 'major', 'education'] },
]

/** Thông tin cá nhân của chính người đăng nhập (CCCD đã được máy chủ che). */
export default function HnProfilePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['hn', 'profile', user?.userId], queryFn: hnApi.profile, staleTime: 60_000, retry: false })
  const p = q.data
  const en = !i18n.language.startsWith('vi')
  // Chức danh / trình độ: ngôn ngữ khác tiếng Việt thì ưu tiên bản tiếng Anh nếu có
  const value = (f: Field): string => {
    if (!p) return ''
    if (f === 'title') return fmtCell(en && p.titleEn ? p.titleEn : p.title)
    if (f === 'education') return fmtCell(en && p.educationEn ? p.educationEn : p.education)
    return fmtCell(p[f])
  }

  return (
    <div className="page">
      <PageBanner
        avatar={<IdcardOutlined style={{ fontSize: 32 }} />}
        title={p?.fullName || t('hn.nav.profile')}
        subtitle={t('hn.nav.profileDesc')}
        chips={p ? [p.employeeId, p.department, p.position].filter(Boolean) : undefined}
      />
      {q.isLoading ? <Skeleton active paragraph={{ rows: 10 }} />
        : q.isError ? (hnErrorCode(q.error) === 'no_employee'
          ? <Result status="info" title={t(hnErrorKey(q.error))} />
          : <Alert type="error" showIcon title={t(hnErrorKey(q.error))} action={<Button size="small" onClick={() => void q.refetch()}>{t('hn.common.retry')}</Button>} />)
        : p && (
          <div style={{ display: 'grid', gap: 16 }}>
            {SECTIONS.map((s) => (
              <Card key={s.title} title={t(s.title)}>
                <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2, xl: 2 }}
                  items={s.fields.map((f) => ({ key: f, label: t(`hn.profile.f.${f}`), children: value(f) || '—' }))} />
              </Card>
            ))}
          </div>
        )}
    </div>
  )
}
