/* 2026-11-23 [Truong] - Mobile app: reuse the web i18n resources, add mobile-only keys */
import * as SecureStore from 'expo-secure-store'
import i18n from '@web/i18n'

export const MOBILE_LANGS = ['vi', 'en', 'ko'] as const
export type MobileLang = (typeof MOBILE_LANGS)[number]

const MOBILE = {
  vi: {
    mobile: {
      tab: { attendance: 'Chấm công', requests: 'Đơn từ', approvals: 'Phê duyệt', payslip: 'Phiếu lương', notifications: 'Thông báo' },
      login: { title: 'Đăng nhập', userId: 'Mã nhân viên', password: 'Mật khẩu', submit: 'Đăng nhập', otpTitle: 'Xác thực hai bước', otpHint: 'Nhập mã 6 số trong ứng dụng xác thực.', otpSetup: 'Tài khoản quản trị chưa đăng ký xác thực hai bước: đăng nhập trên web để quét mã QR trước.', verify: 'Xác nhận', back: 'Quay lại' },
      err: { invalid_credential: 'Sai mã nhân viên hoặc mật khẩu.', account_locked: 'Tài khoản đang bị khoá.', too_many_attempts: 'Thử sai quá nhiều lần, vui lòng đợi rồi thử lại.', must_change_password: 'Bạn cần đổi mật khẩu trên trang web CMS trước khi dùng app.', invalid_otp: 'Mã OTP không đúng.', otp_ticket_expired: 'Phiên xác thực đã hết hạn, vui lòng đăng nhập lại.', table_missing: 'Máy chủ chưa sẵn sàng cho app, vui lòng liên hệ quản trị.', mobile_off: 'App đang tạm tắt.', network: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', invalid_input: 'Vui lòng nhập đủ thông tin.', generic: 'Có lỗi, thử lại sau.' },
      reqf: { forMe: 'Cho tôi', forOthers: 'Đăng ký hộ', viewDrafts: 'Xem danh sách nháp', pickPeopleFirst: 'Chọn người được đăng ký trước để hiện danh sách người duyệt.' },
      done: 'Xong',
      logout: 'Đăng xuất', logoutAsk: 'Đăng xuất khỏi app trên máy này?', cancel: 'Huỷ', retry: 'Thử lại', empty: 'Chưa có dữ liệu.', loading: 'Đang tải…', comingSoon: 'Màn hình đầy đủ sẽ có ở bản sau.',
      att: { month: 'Tháng này', present: 'Ngày công', hours: 'Giờ làm', ot: 'Tăng ca (giờ)', leave: 'Phép (giờ)', inOut: 'Vào / ra' },
      req: { sentThisMonth: 'Đơn đã gửi trong tháng', overtime: 'Tăng ca', finger: 'Quên vân tay', leave: 'Nghỉ phép' },
      appr: { pending: 'Đơn chờ bạn duyệt', none: 'Không có đơn nào chờ duyệt.', forms: '{{n}} đơn', openGroup: 'Xem từng đơn' },
      bio: { unlock: 'Mở bằng vân tay / Face ID', prompt: 'Xác nhận để mở phiếu lương', enableTitle: 'Mở nhanh phiếu lương', enableAsk: 'Lần sau mở phiếu lương bằng vân tay / Face ID thay cho nhập mã PIN trên máy này?', enable: 'Bật', enabled: 'Đã bật mở bằng vân tay / Face ID.', failed: 'Không bật được trên máy này (cần bản app cài đặt, không dùng được trong Expo Go).', stale: 'Mã PIN đã đổi: nhập mã mới, sau đó có thể bật lại vân tay / Face ID.', toggle: 'Mở phiếu lương bằng vân tay / Face ID' },
      pay: { hasPin: 'Đã đặt mã PIN phiếu lương.', noPin: 'Chưa đặt mã PIN: đặt lần đầu trên web hoặc ở bản app sau.', locked: 'Mã PIN đang bị khoá tạm.' },
      noti: { unread: '{{n}} chưa đọc', readAll: 'Đánh dấu đã đọc' },
    },
  },
  en: {
    mobile: {
      tab: { attendance: 'Attendance', requests: 'Requests', approvals: 'Approvals', payslip: 'Payslip', notifications: 'Notifications' },
      login: { title: 'Sign in', userId: 'Employee ID', password: 'Password', submit: 'Sign in', otpTitle: 'Two-step verification', otpHint: 'Enter the 6-digit code from your authenticator app.', otpSetup: 'This admin account has not set up two-step verification yet: sign in on the web first to scan the QR code.', verify: 'Verify', back: 'Back' },
      err: { invalid_credential: 'Wrong employee ID or password.', account_locked: 'This account is locked.', too_many_attempts: 'Too many attempts, please wait and try again.', must_change_password: 'Please change your password on the CMS website before using the app.', invalid_otp: 'Wrong OTP code.', otp_ticket_expired: 'Verification expired, please sign in again.', table_missing: 'The server is not ready for the app yet, please contact the administrator.', mobile_off: 'The app is temporarily disabled.', network: 'Cannot reach the server. Check your connection and try again.', invalid_input: 'Please fill in all fields.', generic: 'Something went wrong, please try again.' },
      reqf: { forMe: 'For me', forOthers: 'On behalf of others', viewDrafts: 'View drafts', pickPeopleFirst: 'Choose who the request is for first to load the approvers.' },
      done: 'Done',
      logout: 'Sign out', logoutAsk: 'Sign out of the app on this device?', cancel: 'Cancel', retry: 'Retry', empty: 'No data yet.', loading: 'Loading…', comingSoon: 'The full screen is coming in the next version.',
      att: { month: 'This month', present: 'Work days', hours: 'Work hours', ot: 'Overtime (h)', leave: 'Leave (h)', inOut: 'In / out' },
      req: { sentThisMonth: 'Requests sent this month', overtime: 'Overtime', finger: 'Missed punch', leave: 'Leave' },
      appr: { pending: 'Waiting for your approval', none: 'Nothing waiting for approval.', forms: '{{n}} requests', openGroup: 'View requests' },
      bio: { unlock: 'Unlock with fingerprint / Face ID', prompt: 'Confirm to open your payslip', enableTitle: 'Quick payslip unlock', enableAsk: 'Use fingerprint / Face ID instead of the PIN to open your payslip on this device?', enable: 'Turn on', enabled: 'Fingerprint / Face ID unlock is on.', failed: 'Could not turn it on on this device (needs the installed app, not available in Expo Go).', stale: 'Your PIN has changed: enter the new PIN, then you can turn fingerprint / Face ID back on.', toggle: 'Open payslip with fingerprint / Face ID' },
      pay: { hasPin: 'Payslip PIN is set.', noPin: 'No PIN yet: set it on the web first or in a later app version.', locked: 'PIN is temporarily locked.' },
      noti: { unread: '{{n}} unread', readAll: 'Mark all read' },
    },
  },
  ko: {
    mobile: {
      tab: { attendance: '근태', requests: '신청서', approvals: '결재', payslip: '급여명세서', notifications: '알림' },
      login: { title: '로그인', userId: '사번', password: '비밀번호', submit: '로그인', otpTitle: '2단계 인증', otpHint: '인증 앱의 6자리 코드를 입력하세요.', otpSetup: '관리자 계정의 2단계 인증이 아직 등록되지 않았습니다. 먼저 웹에서 로그인하여 QR 코드를 스캔하세요.', verify: '확인', back: '뒤로' },
      err: { invalid_credential: '사번 또는 비밀번호가 올바르지 않습니다.', account_locked: '계정이 잠겨 있습니다.', too_many_attempts: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.', must_change_password: '앱을 사용하기 전에 CMS 웹에서 비밀번호를 변경하세요.', invalid_otp: 'OTP 코드가 올바르지 않습니다.', otp_ticket_expired: '인증 시간이 만료되었습니다. 다시 로그인하세요.', table_missing: '서버가 아직 앱을 지원하지 않습니다. 관리자에게 문의하세요.', mobile_off: '앱이 일시적으로 중지되었습니다.', network: '서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도하세요.', invalid_input: '모든 항목을 입력하세요.', generic: '오류가 발생했습니다. 다시 시도하세요.' },
      reqf: { forMe: '본인', forOthers: '대리 신청', viewDrafts: '임시 저장 목록 보기', pickPeopleFirst: '결재자 목록을 불러오려면 먼저 신청 대상을 선택하세요.' },
      done: '완료',
      logout: '로그아웃', logoutAsk: '이 기기에서 로그아웃할까요?', cancel: '취소', retry: '다시 시도', empty: '데이터가 없습니다.', loading: '불러오는 중…', comingSoon: '전체 화면은 다음 버전에서 제공됩니다.',
      att: { month: '이번 달', present: '근무일', hours: '근무 시간', ot: '연장(시간)', leave: '휴가(시간)', inOut: '출근 / 퇴근' },
      req: { sentThisMonth: '이번 달 제출한 신청서', overtime: '연장근무', finger: '지문 누락', leave: '휴가' },
      appr: { pending: '결재 대기', none: '결재 대기 중인 신청서가 없습니다.', forms: '{{n}}건', openGroup: '신청서 보기' },
      bio: { unlock: '지문 / Face ID로 열기', prompt: '급여명세서를 열려면 인증하세요', enableTitle: '급여명세서 빠른 열기', enableAsk: '이 기기에서 PIN 대신 지문 / Face ID로 급여명세서를 열까요?', enable: '사용', enabled: '지문 / Face ID 열기를 사용합니다.', failed: '이 기기에서 설정할 수 없습니다(설치된 앱 필요, Expo Go에서는 사용 불가).', stale: 'PIN이 변경되었습니다. 새 PIN을 입력한 후 지문 / Face ID를 다시 켤 수 있습니다.', toggle: '지문 / Face ID로 급여명세서 열기' },
      pay: { hasPin: '급여명세서 PIN이 설정되어 있습니다.', noPin: 'PIN이 없습니다. 먼저 웹에서 설정하거나 다음 앱 버전에서 설정하세요.', locked: 'PIN이 일시적으로 잠겨 있습니다.' },
      noti: { unread: '읽지 않음 {{n}}', readAll: '모두 읽음' },
    },
  },
} as const

for (const lng of MOBILE_LANGS) i18n.addResourceBundle(lng, 'translation', MOBILE[lng], true, true)

const LANG_KEY = 'cms.lang'

/** Ngôn ngữ đã chọn trên máy (web lưu ở localStorage, app lưu ở SecureStore). */
export async function loadLanguage() {
  try {
    const saved = await SecureStore.getItemAsync(LANG_KEY)
    if (saved && (MOBILE_LANGS as readonly string[]).includes(saved)) await i18n.changeLanguage(saved)
  } catch { /* giữ mặc định vi */ }
}

export async function setMobileLanguage(code: MobileLang) {
  await i18n.changeLanguage(code)
  try { await SecureStore.setItemAsync(LANG_KEY, code) } catch { /* bỏ qua */ }
}

export default i18n
