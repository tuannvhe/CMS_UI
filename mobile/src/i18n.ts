/* 2026-11-23 [Truong] - Mobile app: reuse the web i18n resources, add mobile-only keys */
import * as SecureStore from 'expo-secure-store'
import i18n from '@web/i18n'

export const MOBILE_LANGS = ['vi', 'en', 'ko'] as const
export type MobileLang = (typeof MOBILE_LANGS)[number]

const MOBILE = {
  vi: {
    mobile: {
      tab: { attendance: 'Chấm công', requests: 'Đơn từ', approvals: 'Phê duyệt', payslip: 'Phiếu lương', notifications: 'Thông báo', feedback: 'Phản hồi' },
      login: { title: 'Đăng nhập', userId: 'Mã nhân viên', password: 'Mật khẩu', submit: 'Đăng nhập', otpTitle: 'Xác thực hai bước', otpHint: 'Nhập mã 6 số trong ứng dụng xác thực.', otpSetup: 'Tài khoản quản trị chưa đăng ký xác thực hai bước: đăng nhập trên web để quét mã QR trước.', verify: 'Xác nhận', back: 'Quay lại', tagline: 'Hệ thống quản lý nhân sự', userIdHint: 'Nhập mã nhân viên', showPw: 'Hiện mật khẩu', hidePw: 'Ẩn mật khẩu', remember: 'Ghi nhớ đăng nhập', bioNext: 'Lần sau đăng nhập bằng {{name}}', welcomeBack: 'Chào {{name}}', orPassword: 'hoặc nhập mật khẩu' },
      err: { invalid_credential: 'Sai mã nhân viên hoặc mật khẩu.', account_locked: 'Tài khoản đang bị khoá.', too_many_attempts: 'Thử sai quá nhiều lần, vui lòng đợi rồi thử lại.', must_change_password: 'Bạn cần đổi mật khẩu trên trang web CMS trước khi dùng app.', invalid_otp: 'Mã OTP không đúng.', otp_ticket_expired: 'Phiên xác thực đã hết hạn, vui lòng đăng nhập lại.', table_missing: 'Máy chủ chưa sẵn sàng cho app, vui lòng liên hệ quản trị.', mobile_off: 'App đang tạm tắt.', network: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', invalid_input: 'Vui lòng nhập đủ thông tin.', generic: 'Có lỗi, thử lại sau.', forbidden: 'Tài khoản của bạn chưa được cấp quyền dùng chức năng này. Liên hệ nhân sự / quản trị nếu cần.' },
      reqf: { forMe: 'Cho tôi', forOthers: 'Đăng ký hộ', viewDrafts: 'Xem danh sách nháp', pickPeopleFirst: 'Chọn người được đăng ký trước để hiện danh sách người duyệt.' },
      done: 'Xong', search: 'Tìm…',
      logout: 'Đăng xuất', logoutAsk: 'Đăng xuất khỏi app trên máy này?', cancel: 'Huỷ', retry: 'Thử lại', empty: 'Chưa có dữ liệu.', loading: 'Đang tải…', comingSoon: 'Màn hình đầy đủ sẽ có ở bản sau.',
      att: { today: 'Hôm nay', noPunch: 'Chưa có giờ vào / ra', month: 'Tháng này', present: 'Ngày công', hours: 'Giờ làm', ot: 'Tăng ca (giờ)', leave: 'Phép (giờ)', inOut: 'Vào / ra', prevMonth: 'Tháng trước', nextMonth: 'Tháng sau', monthLabel: 'Tháng {{m}}', flagged: '{{n}} ngày cần xem lại (thiếu vân tay, tăng ca thiếu…). Kéo xuống để xem và sửa.', daily: 'Từng ngày', pickRange: 'Chọn khoảng ngày', custom: 'Khoảng ngày tự chọn', thisMonth: 'Tháng này', lastMonth: 'Tháng trước', lastNDays: '{{n}} ngày qua', from: 'Từ ngày', to: 'Đến ngày', view: 'Xem công', tooLong: 'Chọn tối đa {{n}} ngày.' },
      req: { sentThisMonth: 'Đơn đã gửi trong tháng', overtime: 'Tăng ca', finger: 'Quên vân tay', leave: 'Nghỉ phép' },
      appr: { pending: 'Đơn chờ bạn duyệt', none: 'Không có đơn nào chờ duyệt.', forms: '{{n}} đơn', openGroup: 'Xem từng đơn' },
      bio: { unlock: 'Mở bằng vân tay / Face ID', prompt: 'Xác nhận để mở phiếu lương', enableTitle: 'Mở nhanh phiếu lương', enableAsk: 'Lần sau mở phiếu lương bằng vân tay / Face ID thay cho nhập mã PIN trên máy này?', enable: 'Bật', enabled: 'Đã bật mở bằng vân tay / Face ID.', failed: 'Không bật được trên máy này (cần bản app cài đặt, không dùng được trong Expo Go).', stale: 'Mã PIN đã đổi: nhập mã mới, sau đó có thể bật lại vân tay / Face ID.', toggle: 'Mở phiếu lương bằng vân tay / Face ID' },
      pay: { hasPin: 'Đã đặt mã PIN phiếu lương.', noPin: 'Chưa đặt mã PIN: đặt lần đầu trên web hoặc ở bản app sau.', locked: 'Mã PIN đang bị khoá tạm.' },
      settings: { title: 'Cài đặt', light: 'Sáng', dark: 'Tối', system: 'Theo máy', security: 'Bảo mật', language: 'Ngôn ngữ' },
      bioLogin: { stale: 'Mật khẩu đã đổi nên chưa đăng nhập được bằng {{name}}. Nhập mật khẩu mới (giữ ô dùng {{name}} lần sau để bật lại).', finger: 'vân tay', prompt: 'Xác nhận để vào VINATECH CMS', offerTitle: 'Đăng nhập bằng {{name}}?', offerText: 'Lần sau mở app chỉ cần dùng {{name}} thay cho nhập mật khẩu trên máy này.', later: 'Để sau', hello: 'Xin chào', useBio: 'Dùng {{name}}', tapToUse: 'Chạm để mở khoá bằng {{name}}', usePassword: 'Nhập mật khẩu', switch: 'Đăng nhập tài khoản khác', failed: 'Chưa xác thực được bằng {{name}}. Thử lại hoặc nhập mật khẩu.', toggle: 'Đăng nhập bằng {{name}}', toggleHint: 'Mở app và quay lại sau 1 phút sẽ hỏi vân tay / khuôn mặt.', unavailable: 'Máy chưa cài vân tay hoặc khuôn mặt.' },
      chat: { photo: 'Chọn ảnh', camera: 'Chụp ảnh', maxImages: 'Tối đa {{n}} ảnh mỗi tin.', tooLarge: 'Ảnh tối đa 10 MB.', uploading: 'Đang tải ảnh…', noPerm: 'Chưa cho phép truy cập ảnh / máy ảnh. Mở Cài đặt của máy để cho phép.', removeImage: 'Bỏ ảnh', close: 'Đóng', keyboard: 'Bàn phím' },
      fb: { closed: 'Phản hồi công / Hỏi đáp chưa mở. Hằng tháng mở từ ngày 1 đến hết ngày 7.' },
      push: { title: 'Thông báo trên điện thoại', on: 'Đang nhận thông báo trên máy này', off: 'Máy này chưa nhận được thông báo', denied: 'Bạn đã tắt quyền thông báo của app. Mở Cài đặt của điện thoại để bật lại.', noProject: 'Bản app này chưa được cấu hình thông báo (thiếu mã dự án Expo). Báo quản trị.', expoGo: 'Expo Go trên Android không nhận thông báo đẩy. Cần cài bản app riêng (development build / APK).', simulator: 'Máy ảo không nhận được thông báo đẩy.', error: 'Chưa đăng ký được thông báo. Kiểm tra mạng rồi thử lại.', openSettings: 'Mở Cài đặt điện thoại' },
      noti: { unread: '{{n}} chưa đọc', readAll: 'Đánh dấu đã đọc', allRead: 'Đã đọc hết' },
    },
  },
  en: {
    mobile: {
      tab: { attendance: 'Attendance', requests: 'Requests', approvals: 'Approvals', payslip: 'Payslip', notifications: 'Notifications', feedback: 'Feedback' },
      login: { title: 'Sign in', userId: 'Employee ID', password: 'Password', submit: 'Sign in', otpTitle: 'Two-step verification', otpHint: 'Enter the 6-digit code from your authenticator app.', otpSetup: 'This admin account has not set up two-step verification yet: sign in on the web first to scan the QR code.', verify: 'Verify', back: 'Back', tagline: 'HR management system', userIdHint: 'Enter your employee ID', showPw: 'Show password', hidePw: 'Hide password', remember: 'Keep me signed in', bioNext: 'Sign in with {{name}} next time', welcomeBack: 'Welcome back, {{name}}', orPassword: 'or use your password' },
      err: { invalid_credential: 'Wrong employee ID or password.', account_locked: 'This account is locked.', too_many_attempts: 'Too many attempts, please wait and try again.', must_change_password: 'Please change your password on the CMS website before using the app.', invalid_otp: 'Wrong OTP code.', otp_ticket_expired: 'Verification expired, please sign in again.', table_missing: 'The server is not ready for the app yet, please contact the administrator.', mobile_off: 'The app is temporarily disabled.', network: 'Cannot reach the server. Check your connection and try again.', invalid_input: 'Please fill in all fields.', generic: 'Something went wrong, please try again.', forbidden: 'Your account does not have access to this feature. Contact HR / the administrator if you need it.' },
      reqf: { forMe: 'For me', forOthers: 'On behalf of others', viewDrafts: 'View drafts', pickPeopleFirst: 'Choose who the request is for first to load the approvers.' },
      done: 'Done', search: 'Search…',
      logout: 'Sign out', logoutAsk: 'Sign out of the app on this device?', cancel: 'Cancel', retry: 'Retry', empty: 'No data yet.', loading: 'Loading…', comingSoon: 'The full screen is coming in the next version.',
      att: { today: 'Today', noPunch: 'No punches yet', month: 'This month', present: 'Work days', hours: 'Work hours', ot: 'Overtime (h)', leave: 'Leave (h)', inOut: 'In / out', prevMonth: 'Previous month', nextMonth: 'Next month', monthLabel: 'Month {{m}}', flagged: '{{n}} days need attention (missed punch, short overtime…). Scroll down to review and fix.', daily: 'Day by day', pickRange: 'Choose dates', custom: 'Custom range', thisMonth: 'This month', lastMonth: 'Last month', lastNDays: 'Last {{n}} days', from: 'From', to: 'To', view: 'Show', tooLong: 'Choose at most {{n}} days.' },
      req: { sentThisMonth: 'Requests sent this month', overtime: 'Overtime', finger: 'Missed punch', leave: 'Leave' },
      appr: { pending: 'Waiting for your approval', none: 'Nothing waiting for approval.', forms: '{{n}} requests', openGroup: 'View requests' },
      bio: { unlock: 'Unlock with fingerprint / Face ID', prompt: 'Confirm to open your payslip', enableTitle: 'Quick payslip unlock', enableAsk: 'Use fingerprint / Face ID instead of the PIN to open your payslip on this device?', enable: 'Turn on', enabled: 'Fingerprint / Face ID unlock is on.', failed: 'Could not turn it on on this device (needs the installed app, not available in Expo Go).', stale: 'Your PIN has changed: enter the new PIN, then you can turn fingerprint / Face ID back on.', toggle: 'Open payslip with fingerprint / Face ID' },
      pay: { hasPin: 'Payslip PIN is set.', noPin: 'No PIN yet: set it on the web first or in a later app version.', locked: 'PIN is temporarily locked.' },
      settings: { title: 'Settings', light: 'Light', dark: 'Dark', system: 'System', security: 'Security', language: 'Language' },
      bioLogin: { stale: 'Your password has changed, so {{name}} sign-in is off. Enter the new password (keep the {{name}} box ticked to turn it back on).', finger: 'fingerprint', prompt: 'Confirm to open VINATECH CMS', offerTitle: 'Sign in with {{name}}?', offerText: 'Next time just use {{name}} instead of your password on this device.', later: 'Later', hello: 'Welcome back', useBio: 'Use {{name}}', tapToUse: 'Tap to unlock with {{name}}', usePassword: 'Enter password', switch: 'Sign in with another account', failed: 'Could not verify with {{name}}. Try again or enter your password.', toggle: 'Sign in with {{name}}', toggleHint: 'Asked when opening the app and after 1 minute in the background.', unavailable: 'No fingerprint or face is set up on this device.' },
      chat: { photo: 'Choose photo', camera: 'Take photo', maxImages: 'Up to {{n}} photos per message.', tooLarge: 'Photos up to 10 MB.', uploading: 'Uploading photo…', noPerm: 'Photo / camera access is not allowed. Open the device settings to allow it.', removeImage: 'Remove photo', close: 'Close', keyboard: 'Keyboard' },
      fb: { closed: 'Attendance feedback / Q&A is not open now. It opens every month from day 1 to the end of day 7.' },
      push: { title: 'Phone notifications', on: 'Receiving notifications on this device', off: 'This device is not receiving notifications', denied: 'Notifications are turned off for the app. Turn them on in the phone Settings.', noProject: 'This app build is not set up for notifications (missing Expo project ID). Contact the administrator.', expoGo: 'Expo Go on Android cannot receive push notifications. Install the app build (development build / APK).', simulator: 'Simulators cannot receive push notifications.', error: 'Could not register for notifications. Check the connection and try again.', openSettings: 'Open phone Settings' },
      noti: { unread: '{{n}} unread', readAll: 'Mark all read', allRead: 'All caught up' },
    },
  },
  ko: {
    mobile: {
      tab: { attendance: '근태', requests: '신청서', approvals: '결재', payslip: '급여명세서', notifications: '알림', feedback: '문의' },
      login: { title: '로그인', userId: '사번', password: '비밀번호', submit: '로그인', otpTitle: '2단계 인증', otpHint: '인증 앱의 6자리 코드를 입력하세요.', otpSetup: '관리자 계정의 2단계 인증이 아직 등록되지 않았습니다. 먼저 웹에서 로그인하여 QR 코드를 스캔하세요.', verify: '확인', back: '뒤로', tagline: '인사 관리 시스템', userIdHint: '사번을 입력하세요', showPw: '비밀번호 표시', hidePw: '비밀번호 숨기기', remember: '로그인 상태 유지', bioNext: '다음에 {{name}}(으)로 로그인', welcomeBack: '{{name}}님, 다시 오신 것을 환영합니다', orPassword: '또는 비밀번호 입력' },
      err: { invalid_credential: '사번 또는 비밀번호가 올바르지 않습니다.', account_locked: '계정이 잠겨 있습니다.', too_many_attempts: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.', must_change_password: '앱을 사용하기 전에 CMS 웹에서 비밀번호를 변경하세요.', invalid_otp: 'OTP 코드가 올바르지 않습니다.', otp_ticket_expired: '인증 시간이 만료되었습니다. 다시 로그인하세요.', table_missing: '서버가 아직 앱을 지원하지 않습니다. 관리자에게 문의하세요.', mobile_off: '앱이 일시적으로 중지되었습니다.', network: '서버에 연결할 수 없습니다. 네트워크를 확인하고 다시 시도하세요.', invalid_input: '모든 항목을 입력하세요.', generic: '오류가 발생했습니다. 다시 시도하세요.', forbidden: '이 기능을 사용할 권한이 없습니다. 필요하면 인사팀 / 관리자에게 문의하세요.' },
      reqf: { forMe: '본인', forOthers: '대리 신청', viewDrafts: '임시 저장 목록 보기', pickPeopleFirst: '결재자 목록을 불러오려면 먼저 신청 대상을 선택하세요.' },
      done: '완료', search: '검색…',
      logout: '로그아웃', logoutAsk: '이 기기에서 로그아웃할까요?', cancel: '취소', retry: '다시 시도', empty: '데이터가 없습니다.', loading: '불러오는 중…', comingSoon: '전체 화면은 다음 버전에서 제공됩니다.',
      att: { today: '오늘', noPunch: '출퇴근 기록 없음', month: '이번 달', present: '근무일', hours: '근무 시간', ot: '연장(시간)', leave: '휴가(시간)', inOut: '출근 / 퇴근', prevMonth: '이전 달', nextMonth: '다음 달', monthLabel: '{{m}}월', flagged: '확인이 필요한 날이 {{n}}일 있습니다(지문 누락, 연장 부족 등). 아래에서 확인하고 수정하세요.', daily: '일별', pickRange: '기간 선택', custom: '사용자 지정 기간', thisMonth: '이번 달', lastMonth: '지난달', lastNDays: '최근 {{n}}일', from: '시작일', to: '종료일', view: '조회', tooLong: '최대 {{n}}일까지 선택할 수 있습니다.' },
      req: { sentThisMonth: '이번 달 제출한 신청서', overtime: '연장근무', finger: '지문 누락', leave: '휴가' },
      appr: { pending: '결재 대기', none: '결재 대기 중인 신청서가 없습니다.', forms: '{{n}}건', openGroup: '신청서 보기' },
      bio: { unlock: '지문 / Face ID로 열기', prompt: '급여명세서를 열려면 인증하세요', enableTitle: '급여명세서 빠른 열기', enableAsk: '이 기기에서 PIN 대신 지문 / Face ID로 급여명세서를 열까요?', enable: '사용', enabled: '지문 / Face ID 열기를 사용합니다.', failed: '이 기기에서 설정할 수 없습니다(설치된 앱 필요, Expo Go에서는 사용 불가).', stale: 'PIN이 변경되었습니다. 새 PIN을 입력한 후 지문 / Face ID를 다시 켤 수 있습니다.', toggle: '지문 / Face ID로 급여명세서 열기' },
      pay: { hasPin: '급여명세서 PIN이 설정되어 있습니다.', noPin: 'PIN이 없습니다. 먼저 웹에서 설정하거나 다음 앱 버전에서 설정하세요.', locked: 'PIN이 일시적으로 잠겨 있습니다.' },
      settings: { title: '설정', light: '라이트', dark: '다크', system: '시스템', security: '보안', language: '언어' },
      bioLogin: { stale: '비밀번호가 변경되어 {{name}} 로그인이 해제되었습니다. 새 비밀번호를 입력하세요({{name}} 사용 항목을 체크하면 다시 켜집니다).', finger: '지문', prompt: 'VINATECH CMS를 열려면 인증하세요', offerTitle: '{{name}}(으)로 로그인할까요?', offerText: '다음부터 이 기기에서 비밀번호 대신 {{name}}만 사용하세요.', later: '나중에', hello: '안녕하세요', useBio: '{{name}} 사용', tapToUse: '눌러서 {{name}}(으)로 잠금 해제', usePassword: '비밀번호 입력', switch: '다른 계정으로 로그인', failed: '{{name}} 인증에 실패했습니다. 다시 시도하거나 비밀번호를 입력하세요.', toggle: '{{name}}(으)로 로그인', toggleHint: '앱을 열 때와 백그라운드 1분 후에 인증을 요청합니다.', unavailable: '이 기기에 지문 또는 얼굴이 등록되어 있지 않습니다.' },
      chat: { photo: '사진 선택', camera: '사진 촬영', maxImages: '메시지당 사진은 최대 {{n}}장입니다.', tooLarge: '사진은 최대 10MB입니다.', uploading: '사진 업로드 중…', noPerm: '사진 / 카메라 접근이 허용되지 않았습니다. 기기 설정에서 허용하세요.', removeImage: '사진 삭제', close: '닫기', keyboard: '키보드' },
      fb: { closed: '근태 이의 / 문의가 지금은 열려 있지 않습니다. 매월 1일부터 7일까지 열립니다.' },
      push: { title: '휴대폰 알림', on: '이 기기에서 알림을 받고 있습니다', off: '이 기기는 알림을 받지 못합니다', denied: '앱 알림 권한이 꺼져 있습니다. 휴대폰 설정에서 켜 주세요.', noProject: '이 앱 빌드에는 알림 설정(Expo 프로젝트 ID)이 없습니다. 관리자에게 문의하세요.', expoGo: 'Android의 Expo Go에서는 푸시 알림을 받을 수 없습니다. 앱 빌드(development build / APK)를 설치하세요.', simulator: '시뮬레이터에서는 푸시 알림을 받을 수 없습니다.', error: '알림 등록에 실패했습니다. 네트워크를 확인하고 다시 시도하세요.', openSettings: '휴대폰 설정 열기' },
      noti: { unread: '읽지 않음 {{n}}', readAll: '모두 읽음', allRead: '모두 읽었습니다' },
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
