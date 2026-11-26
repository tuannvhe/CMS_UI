/*
 * 2026-11-26 - Nhắc bật thông báo đẩy trên web: trình duyệt chưa cho phép thông báo thì hiện hộp thoại giải thích vì sao nên bật,
 * video + hướng dẫn bật trên đúng trình duyệt đang dùng. Cho phép xong là tự đăng ký (enablePush) và đóng.
 * KHÔNG bắt buộc (user đổi 26/11): bấm "Để sau" thì thôi cho tới lần ĐĂNG NHẬP sau trên trình duyệt đó
 * (cờ sessionStorage PUSH_SKIP_KEY theo tài khoản; AuthContext xoá cờ mỗi lần đăng nhập, đóng trình duyệt cũng mất cờ).
 * Không hiện khi trình duyệt không thể nhận push: trang http (không HTTPS), trình duyệt không hỗ trợ, iPhone chưa "Thêm vào Màn hình chính",
 * máy chủ chưa bật / chưa cấu hình Web Push (/push/key) (nhắc cũng vô ích).
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Modal, theme } from 'antd'
import { BellFilled, CheckCircleFilled, FileTextFilled, LockOutlined, MessageFilled, NotificationFilled, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { currentSubscription, enablePush, isIos, isStandalone, pushApi, pushSupported } from '../api/push'

const BUNDLES = {
  vi: {
    push: { sound: 'Âm thanh khi có thông báo mới (lúc đang mở CMS)', soundTest: 'Nghe thử' },
    pushReq: {
      ios: { title: 'Cài CMS lên màn hình chính để nhận thông báo', intro: 'iPhone và iPad chỉ nhận thông báo khi CMS nằm trên màn hình chính (iOS / iPadOS 16.4 trở lên). Làm 4 bước dưới đây một lần là xong.', steps: ['Mở CMS bằng Safari, bấm nút Chia sẻ (hình vuông có mũi tên) ở thanh dưới', 'Chọn “Thêm vào MH chính”, rồi bấm “Thêm”', 'Mở CMS từ biểu tượng mới trên màn hình chính (không mở từ Safari)', 'Bấm “Bật thông báo” rồi chọn “Cho phép”'], note: 'Máy dùng Chrome / trình duyệt khác trên iPhone: hãy mở CMS bằng Safari để làm các bước này.' },
      videoSafari: 'Video: cách bật thông báo trong Safari',
      videoIos: 'Video: cài CMS lên màn hình chính iPhone / iPad',
      title: 'Bật thông báo để không bỏ lỡ việc',
      intro: 'CMS dùng thông báo để báo ngay cho bạn những việc liên quan đến công, đơn từ và lương, kể cả khi bạn không mở CMS. Thiếu thông báo, bạn có thể lỡ hạn duyệt đơn hoặc hạn sửa công, nên bạn nên bật trên mọi thiết bị hay dùng.',
      whyTitle: 'Bạn sẽ nhận được',
      why: {
        approve: 'Đơn cần bạn duyệt (tăng ca, nghỉ phép, quên vân tay…) ngay khi được gửi',
        result: 'Kết quả đơn của bạn: đã duyệt hay bị từ chối, kèm lý do',
        qa: 'Nhân sự trả lời câu hỏi và phản hồi công của bạn',
        notice: 'Thông báo chung: lịch chốt công, khoá / mở đăng ký đơn, phiếu lương mới',
      },
      privacy: 'Thông báo chỉ hiện tiêu đề ngắn, không hiện số lương hay thông tin nhạy cảm.',
      askTitle: 'Bấm nút bên dưới rồi chọn “Cho phép” khi trình duyệt hỏi.',
      allow: 'Bật thông báo',
      deniedTitle: 'Trình duyệt đang chặn thông báo của CMS. Bật lại theo các bước sau:',
      howTitle: 'Cách bật trên {{browser}}',
      steps: {
        chrome: ['Bấm biểu tượng điều chỉnh / ổ khoá ở bên trái thanh địa chỉ', 'Tìm mục “Thông báo” và chọn “Cho phép”', 'Tải lại trang (F5)'],
        edge: ['Bấm biểu tượng ổ khoá ở bên trái thanh địa chỉ', 'Chọn “Quyền cho trang web này”, mục “Thông báo” chọn “Cho phép”', 'Tải lại trang (F5)'],
        firefox: ['Bấm biểu tượng ổ khoá / quyền ở bên trái thanh địa chỉ', 'Ở dòng “Gửi thông báo”, bấm dấu × để bỏ chặn', 'Tải lại trang (F5), rồi chọn “Cho phép” khi được hỏi'],
        safari: ['Mở menu Safari → Cài đặt (Settings) → Trang web (Websites)', 'Chọn “Thông báo” ở cột trái, đổi trang CMS sang “Cho phép”', 'Quay lại và tải lại trang'],
        android: ['Chạm biểu tượng ổ khoá / ⓘ ở bên trái thanh địa chỉ', 'Chọn “Quyền” → “Thông báo” → bật “Cho phép”', 'Tải lại trang'],
        app: ['Mở Cài đặt của điện thoại → Ứng dụng → VINATECH CMS', 'Chọn “Thông báo” và bật “Cho phép thông báo”', 'Quay lại CMS'],
      },
      auto: 'Cho phép xong, hộp thoại này tự đóng.',
      reload: 'Tải lại trang',
      later: 'Để sau',
      laterHint: 'Chưa bật thì lần đăng nhập sau sẽ nhắc lại.',
      video: 'Video hướng dẫn bật thông báo',
      failed: 'Chưa đăng ký nhận thông báo được, vui lòng thử lại.',
    },
  },
  en: {
    push: { sound: 'Sound for new notifications (while CMS is open)', soundTest: 'Play sample' },
    pushReq: {
      ios: { title: 'Add CMS to your Home Screen to get notifications', intro: 'iPhone and iPad only receive notifications when CMS is on the Home Screen (iOS / iPadOS 16.4 or later). Do these 4 steps once.', steps: ['Open CMS in Safari and tap the Share button (square with an arrow) on the bottom bar', 'Choose “Add to Home Screen”, then tap “Add”', 'Open CMS from the new icon on the Home Screen (not from Safari)', 'Tap “Turn on notifications”, then choose “Allow”'], note: 'Using Chrome or another browser on iPhone: open CMS in Safari to do these steps.' },
      videoSafari: 'Video: how to turn on notifications in Safari',
      videoIos: 'Video: add CMS to the iPhone / iPad Home Screen',
      title: 'Turn on notifications so you never miss a thing',
      intro: 'CMS uses notifications to tell you right away about attendance, requests and payroll, even when CMS is closed. Without them you could miss an approval or a correction deadline, so you should turn them on for every device you use.',
      whyTitle: 'You will be told about',
      why: {
        approve: 'Requests waiting for your approval (overtime, leave, missed punch…) as soon as they are sent',
        result: 'The result of your own requests: approved or rejected, with the reason',
        qa: 'HR replies to your questions and attendance feedback',
        notice: 'Announcements: closing dates, request windows opening / closing, new payslips',
      },
      privacy: 'Notifications show a short title only, never salary amounts or sensitive data.',
      askTitle: 'Press the button below, then choose “Allow” when the browser asks.',
      allow: 'Turn on notifications',
      deniedTitle: 'The browser is blocking CMS notifications. Turn them back on:',
      howTitle: 'How to turn on in {{browser}}',
      steps: {
        chrome: ['Click the tune / lock icon on the left of the address bar', 'Find “Notifications” and choose “Allow”', 'Reload the page (F5)'],
        edge: ['Click the lock icon on the left of the address bar', 'Choose “Permissions for this site”, set “Notifications” to “Allow”', 'Reload the page (F5)'],
        firefox: ['Click the lock / permissions icon on the left of the address bar', 'Next to “Send notifications”, click × to clear the block', 'Reload the page (F5), then choose “Allow” when asked'],
        safari: ['Open the Safari menu → Settings → Websites', 'Choose “Notifications” on the left and set the CMS site to “Allow”', 'Come back and reload the page'],
        android: ['Tap the lock / ⓘ icon on the left of the address bar', 'Choose “Permissions” → “Notifications” → turn on “Allow”', 'Reload the page'],
        app: ['Open the phone Settings → Apps → VINATECH CMS', 'Choose “Notifications” and turn on “Allow notifications”', 'Come back to CMS'],
      },
      auto: 'Once allowed, this box closes by itself.',
      reload: 'Reload page',
      later: 'Later',
      laterHint: 'If still off, you will be reminded at your next sign-in.',
      video: 'Video: how to turn on notifications',
      failed: 'Could not register for notifications, please try again.',
    },
  },
  ko: {
    push: { sound: '새 알림 소리 (CMS를 열어 둔 동안)', soundTest: '미리 듣기' },
    pushReq: {
      ios: { title: '알림을 받으려면 CMS를 홈 화면에 추가하세요', intro: 'iPhone과 iPad는 CMS가 홈 화면에 있을 때만 알림을 받습니다(iOS / iPadOS 16.4 이상). 아래 4단계를 한 번만 하면 됩니다.', steps: ['Safari로 CMS를 열고 하단의 공유 버튼(화살표가 있는 네모)을 누르세요', '“홈 화면에 추가”를 선택하고 “추가”를 누르세요', '홈 화면의 새 아이콘으로 CMS를 여세요(Safari에서 열지 마세요)', '“알림 켜기”를 누르고 “허용”을 선택하세요'], note: 'iPhone에서 Chrome 등 다른 브라우저를 쓰는 경우 Safari로 CMS를 열어 진행하세요.' },
      videoSafari: '동영상: Safari에서 알림 켜는 방법',
      videoIos: '동영상: iPhone / iPad 홈 화면에 CMS 추가',
      title: '놓치지 않도록 알림을 켜세요',
      intro: 'CMS는 근태, 신청서, 급여 관련 소식을 CMS를 열지 않아도 바로 알려 드리기 위해 알림을 사용합니다. 알림이 없으면 승인이나 근태 수정 기한을 놓칠 수 있어 자주 쓰는 모든 기기에서 켜 두는 것이 좋습니다.',
      whyTitle: '이런 알림을 받습니다',
      why: {
        approve: '승인이 필요한 신청서(연장근무, 휴가, 지문 누락…)가 제출되는 즉시',
        result: '내 신청서 결과: 승인 또는 반려와 사유',
        qa: '질문과 근태 이의에 대한 인사팀 답변',
        notice: '공지: 근태 마감일, 신청 잠금 / 해제, 새 급여명세서',
      },
      privacy: '알림에는 짧은 제목만 표시되며 급여 금액이나 민감한 정보는 표시되지 않습니다.',
      askTitle: '아래 버튼을 누른 뒤 브라우저가 물으면 “허용”을 선택하세요.',
      allow: '알림 켜기',
      deniedTitle: '브라우저가 CMS 알림을 차단하고 있습니다. 다음 순서로 다시 켜세요:',
      howTitle: '{{browser}}에서 켜는 방법',
      steps: {
        chrome: ['주소창 왼쪽의 조정 / 자물쇠 아이콘 클릭', '“알림”을 찾아 “허용” 선택', '페이지 새로고침(F5)'],
        edge: ['주소창 왼쪽의 자물쇠 아이콘 클릭', '“이 사이트에 대한 권한”에서 “알림”을 “허용”으로', '페이지 새로고침(F5)'],
        firefox: ['주소창 왼쪽의 자물쇠 / 권한 아이콘 클릭', '“알림 보내기” 옆의 ×를 눌러 차단 해제', '새로고침(F5) 후 물으면 “허용” 선택'],
        safari: ['Safari 메뉴 → 설정 → 웹사이트', '왼쪽에서 “알림”을 선택하고 CMS 사이트를 “허용”으로', '돌아와서 새로고침'],
        android: ['주소창 왼쪽의 자물쇠 / ⓘ 아이콘 터치', '“권한” → “알림” → “허용” 켜기', '페이지 새로고침'],
        app: ['휴대폰 설정 → 앱 → VINATECH CMS', '“알림”에서 “알림 허용” 켜기', 'CMS로 돌아오기'],
      },
      auto: '허용하면 이 창은 자동으로 닫힙니다.',
      reload: '새로고침',
      later: '나중에',
      laterHint: '켜지 않으면 다음 로그인 때 다시 안내합니다.',
      video: '알림 켜는 방법 동영상',
      failed: '알림 등록에 실패했습니다. 다시 시도하세요.',
    },
  },
}
// push.sound / push.soundTest dùng ở Cài đặt (PushSettingsCard); AppShell luôn nạp file này trước khi vào trang Cài đặt
for (const [lng, res] of Object.entries(BUNDLES)) i18n.addResourceBundle(lng, 'translation', res, true, false)

type Browser = 'chrome' | 'edge' | 'firefox' | 'safari' | 'android' | 'app'
const BROWSER_NAME: Record<Browser, string> = { chrome: 'Chrome', edge: 'Microsoft Edge', firefox: 'Firefox', safari: 'Safari', android: 'Chrome (Android)', app: 'VINATECH CMS' }
function detectBrowser(): Browser {
  const ua = navigator.userAgent
  if (isStandalone()) return 'app'                       // đã cài như ứng dụng: không có thanh địa chỉ, bật trong Cài đặt máy
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Android/i.test(ua)) return 'android'
  if (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS/.test(ua)) return 'safari'
  return 'chrome'
}

/** Bấm "Để sau": nhớ trong phiên đăng nhập này (sessionStorage), AuthContext xoá khi đăng nhập lại. */
export const PUSH_SKIP_KEY = 'cmsvn.pushPromptSkip'
const skipped = (uid?: string) => { try { return !!uid && sessionStorage.getItem(PUSH_SKIP_KEY) === uid } catch { return false } }

const perm = (): NotificationPermission => (typeof Notification === 'undefined' ? 'default' : Notification.permission)

/** Gắn trong AppShell (chỉ cơ sở VINA). Không render gì khi đã bật, đã bấm "Để sau" trong lần đăng nhập này, hoặc thiết bị không thể nhận thông báo đẩy. */
export function PushRequiredGate() {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  // Thiết bị có thể nhận push không (như PushSettingsCard): HTTPS, trình duyệt hỗ trợ, iPhone đã thêm vào màn hình chính
  const secure = typeof window !== 'undefined' && window.isSecureContext
  // iPhone / iPad mở bằng Safari thường: chưa nhận được push, phải "Thêm vào Màn hình chính" trước (hộp thoại hướng dẫn riêng)
  const iosInstall = secure && isIos() && !isStandalone()
  const capable = secure && pushSupported() && !iosInstall
  const key = useQuery({ queryKey: ['push-key'], queryFn: pushApi.key, enabled: capable || iosInstall, retry: false, staleTime: 5 * 60_000 })
  const serverOn = !!key.data?.enabled && !!key.data?.ready && !!key.data.publicKey
  const [state, setState] = useState<NotificationPermission>(perm)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const { user } = useAuth()
  const [laterNow, setLater] = useState(false)
  const later = laterNow || skipped(user?.userId)
  const skip = () => { try { if (user?.userId) sessionStorage.setItem(PUSH_SKIP_KEY, user.userId) } catch { /* bỏ qua */ } setLater(true) }

  const subscribe = useCallback(async (ask: boolean) => {
    if (!key.data?.publicKey) return
    if (!ask && perm() !== 'granted') return
    setBusy(true); setFailed(false)
    try {
      const r = await enablePush(key.data.publicKey)
      setState(perm())
      setSubscribed(r === 'ok')
    } catch {
      setFailed(true)
    } finally { setBusy(false) }
  }, [key.data?.publicKey])

  // Đã cho phép nhưng thiết bị chưa đăng ký (đăng ký cũ hết hạn, xoá dữ liệu trang…): tự đăng ký lại, không hỏi
  useEffect(() => {
    if (!capable || !serverOn) return
    currentSubscription().then((s) => {
      setSubscribed(!!s)
      if (!s && perm() === 'granted') void subscribe(false)
    }).catch(() => setSubscribed(false))
  }, [capable, serverOn, subscribe])

  // Theo dõi quyền: người dùng đổi trong cài đặt trình duyệt / quay lại tab là kiểm tra lại, cho phép xong tự đóng
  useEffect(() => {
    if (!capable) return
    const recheck = () => {
      const p = perm()
      setState(p)
      if (p === 'granted') void subscribe(false)
    }
    let status: PermissionStatus | null = null
    navigator.permissions?.query({ name: 'notifications' as PermissionName }).then((st) => { status = st; st.onchange = recheck }).catch(() => undefined)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
      if (status) status.onchange = null
    }
  }, [capable, subscribe])

  const open = serverOn && !later && (iosInstall || (capable && (state !== 'granted' || subscribed === false)))
  if (!open) return null

  const browser = detectBrowser()
  const denied = state === 'denied'
  const video = iosInstall ? 'push-ios' : browser === 'safari' ? 'push-safari' : browser === 'android' ? 'push-android' : 'push-enable'
  const videoLabel = iosInstall ? t('pushReq.videoIos') : browser === 'safari' ? t('pushReq.videoSafari') : t('pushReq.video')
  const steps = t(`pushReq.steps.${browser}`, { returnObjects: true }) as string[]
  const why: [React.ReactNode, string, string][] = [
    [<CheckCircleFilled key="a" />, t('pushReq.why.approve'), token.colorPrimary],
    [<FileTextFilled key="r" />, t('pushReq.why.result'), token.colorInfo],
    [<MessageFilled key="q" />, t('pushReq.why.qa'), '#7c3aed'],
    [<NotificationFilled key="n" />, t('pushReq.why.notice'), token.colorWarning],
  ]
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: token.colorTextSecondary, margin: '0 0 10px' }

  return (
    <Modal open centered onCancel={skip} maskClosable={false} footer={null} width="min(620px, calc(100vw - 24px))" zIndex={2000}
      styles={{ container: { padding: 0, overflow: 'hidden' }, body: { padding: 0 }, close: { color: '#fff' } }} aria-labelledby="push-req-title">
      {/* Khung cột: phần trên (đầu + nội dung) cuộn được, chân hộp thoại (nút) luôn thấy — điện thoại nhỏ / xoay ngang vẫn bấm được */}
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 32px)' }}>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
      {/* Đầu hộp thoại: màu chủ đạo + chuông */}
      <div style={{ background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryHover})`, color: '#fff', textAlign: 'center', padding: 'clamp(14px, 3vw, 24px) clamp(16px, 4vw, 32px)' }}>
        <div style={{ width: 60, height: 60, margin: '0 auto 10px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', position: 'relative' }}>
          <BellFilled style={{ fontSize: 28 }} />
          <span style={{ position: 'absolute', top: 11, right: 11, width: 13, height: 13, borderRadius: '50%', background: token.colorError, border: '2px solid #fff' }} />
        </div>
        <h2 id="push-req-title" style={{ color: '#fff', margin: '0 0 8px', fontSize: 'clamp(19px, 3.2vw, 23px)', fontWeight: 800 }}>{iosInstall ? t('pushReq.ios.title') : t('pushReq.title')}</h2>
        <p style={{ margin: 0, opacity: 0.93, lineHeight: 1.55, fontSize: 14.5 }}>{iosInstall ? t('pushReq.ios.intro') : t('pushReq.intro')}</p>
      </div>

      <div style={{ padding: 'clamp(14px, 3.5vw, 22px)' }}>
        {/* Ý nghĩa: nhận được gì (1 cột trên điện thoại, 2 cột từ ~520px) */}
        <p style={label}>{t('pushReq.whyTitle')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 18 }}>
          {why.map(([icon, text, color]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: token.colorFillQuaternary }}>
              <span style={{ flex: '0 0 38px', height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 19, color, background: `${color}1f` }}>{icon}</span>
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Video hướng dẫn theo trình duyệt (public/help: push-enable = Chrome / Edge / Firefox / Android, push-safari = Safari máy tính, push-ios = iPhone / iPad), không tiếng */}
        <video key={video} src={`/help/${video}.mp4`} autoPlay muted loop playsInline controls preload="metadata" aria-label={videoLabel}
          style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, background: token.colorFillTertiary, display: 'block', marginBottom: 16 }} />

        {iosInstall ? (
          <>
            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'grid', gap: 10 }}>
              {(t('pushReq.ios.steps', { returnObjects: true }) as string[]).map((st, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flex: '0 0 26px', height: 26, borderRadius: '50%', background: token.colorPrimary, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                  <span style={{ paddingTop: 3, lineHeight: 1.5 }}>{st}</span>
                </li>
              ))}
            </ol>
            <p style={{ color: token.colorTextSecondary, fontSize: 13, margin: '0 0 14px' }}>{t('pushReq.ios.note')}</p>
          </>
        ) : denied ? (
          <>
            <Alert type="warning" showIcon title={t('pushReq.deniedTitle')} style={{ marginBottom: 12 }} />
            <p style={label}>{t('pushReq.howTitle', { browser: BROWSER_NAME[browser] })}</p>
            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'grid', gap: 10 }}>
              {steps.map((st, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flex: '0 0 26px', height: 26, borderRadius: '50%', background: token.colorPrimary, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                  <span style={{ paddingTop: 3, lineHeight: 1.5 }}>{st}</span>
                </li>
              ))}
            </ol>
            <p style={{ color: token.colorTextSecondary, fontSize: 13, margin: '0 0 14px' }}>{t('pushReq.auto')}</p>
          </>
        ) : (
          <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>{t('pushReq.askTitle')}</p>
        )}

      </div>
      </div>

      {/* Chân hộp thoại cố định: nút luôn thấy được, phần trên cuộn khi màn thấp */}
      <div style={{ flex: '0 0 auto', padding: '12px clamp(14px, 3.5vw, 22px) 16px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        {failed && <Alert type="error" showIcon title={t('pushReq.failed')} style={{ marginBottom: 12 }} />}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {iosInstall ? null : denied
            ? <Button size="large" type="primary" icon={<ReloadOutlined />} style={{ flex: '1 1 200px' }} onClick={() => window.location.reload()}>{t('pushReq.reload')}</Button>
            : <Button size="large" type="primary" icon={<BellFilled />} style={{ flex: '1 1 200px' }} loading={busy} onClick={() => void subscribe(true)}>{t('pushReq.allow')}</Button>}
          <Button size="large" type={iosInstall ? 'primary' : 'default'} style={{ flex: iosInstall ? '1 1 200px' : '0 1 140px' }} onClick={skip}>{t('pushReq.later')}</Button>
        </div>
        <p style={{ color: token.colorTextTertiary, fontSize: 12.5, margin: '8px 0 0' }}>{t('pushReq.laterHint')}</p>

        <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: token.colorTextTertiary, fontSize: 12.5, margin: '6px 0 0' }}>
          <LockOutlined style={{ marginTop: 3 }} />{t('pushReq.privacy')}
        </p>
      </div>
      </div>
    </Modal>
  )
}
