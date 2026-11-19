/** Chữ của ô chọn cơ sở ở màn đăng nhập (VINA / Hà Nội) và trang chào của cơ sở Hà Nội. */
export const SITE_BUNDLES = {
  vi: { site: {
    label: 'Cơ sở', vina: 'Bắc Ninh - Hưng Yên', hn: 'Ninh Bình (Hà Nam)', pickHint: 'Chọn cơ sở bạn làm việc',
    welcomeTitle: 'Chào {{name}}', badge: 'Cơ sở Ninh Bình (Hà Nam)',
    comingSoon: 'Các chức năng của cơ sở Ninh Bình (Hà Nam) đang được chuyển sang hệ thống này từng bước. Bạn đã đăng nhập thành công; khi chức năng nào sẵn sàng, nó sẽ hiện ở đây.',
    switch: 'Đăng xuất, chọn cơ sở khác',
  }, login: { site_unavailable: 'Cơ sở Ninh Bình (Hà Nam) chưa được cấu hình kết nối. Vui lòng liên hệ quản trị hệ thống.', site_not_supported: 'Chức năng này chưa dùng được ở cơ sở Ninh Bình (Hà Nam).' } },
  en: { site: {
    label: 'Site', vina: 'Bac Ninh - Hung Yen', hn: 'Ninh Binh (Ha Nam)', pickHint: 'Choose the site you work at',
    welcomeTitle: 'Hello {{name}}', badge: 'Ninh Binh (Ha Nam) site',
    comingSoon: 'Ninh Binh (Ha Nam) site features are being moved into this system step by step. You are signed in; each feature will appear here as soon as it is ready.',
    switch: 'Sign out and choose another site',
  }, login: { site_unavailable: 'The Ninh Binh (Ha Nam) site connection is not configured. Please contact the system administrator.', site_not_supported: 'This feature is not available at the Ninh Binh (Ha Nam) site yet.' } },
  ko: { site: {
    label: '사업장', vina: '박닌 - 흥옌', hn: '닌빈(하남)', pickHint: '근무하는 사업장을 선택하세요',
    welcomeTitle: '{{name}}님 안녕하세요', badge: '닌빈(하남) 사업장',
    comingSoon: '닌빈(하남) 사업장 기능이 이 시스템으로 단계적으로 이전되고 있습니다. 로그인되었으며, 기능이 준비되는 대로 여기에 표시됩니다.',
    switch: '로그아웃 후 다른 사업장 선택',
  }, login: { site_unavailable: '닌빈(하남) 사업장 연결이 설정되지 않았습니다. 시스템 관리자에게 문의하세요.', site_not_supported: '이 기능은 아직 닌빈(하남) 사업장에서 사용할 수 없습니다.' } },
} as const
