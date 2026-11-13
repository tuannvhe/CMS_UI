/**
 * Nội dung trang chủ dạng landing (tab "Tổng quan") giới thiệu VINATECH VINA BẮC NINH.
 * Toàn bộ chữ, số liệu, ảnh, liên hệ nằm ở đây; component chỉ hiển thị. Chỗ nào có "TODO" là nội dung tạm cần thay bằng thông tin thật.
 * Ảnh đặt trong public/images/landing/ (WebP, dưới 300KB mỗi ảnh); đường dẫn bắt đầu bằng "/images/landing/".
 */
import logoFallback from '../assets/logo1.png'

/** Tên icon dùng được trong cấu hình (component đổi sang icon của @ant-design/icons). */
export type LandingIcon =
  | 'thunder' | 'experiment' | 'safety' | 'team' | 'global' | 'rocket' | 'tool' | 'check'
  | 'heart' | 'bulb' | 'eye' | 'aim' | 'star' | 'deploymentUnit' | 'audit' | 'car'

export interface LandingImage { src: string; alt: string }

export const landing = {
  // TODO: thay bằng logo trắng cho nền xanh (src/assets/brand/logo-white.svg) — import file rồi gán vào đây
  logoUrl: logoFallback as string,
  companyName: 'VINATECH VINA BẮC NINH',
  // TODO: slogan chính thức của công ty
  slogan: 'Năng lượng sạch cho tương lai — chất lượng từ con người Việt Nam.',
  // Ảnh nền mờ phía sau hero. TODO: thay bằng ảnh thật nhà máy
  heroImage: { src: '/images/landing/hero-factory.webp', alt: 'Toàn cảnh nhà máy VINATECH VINA tại Bắc Ninh' } as LandingImage,

  greeting: {
    morning: 'Chào buổi sáng', noon: 'Chào buổi trưa', afternoon: 'Chào buổi chiều', evening: 'Chào buổi tối',
  },
  cta: { learnMore: 'Tìm hiểu thêm', contact: 'Liên hệ' },
  quickTitle: 'Truy cập nhanh',

  /** Thanh mục lục ngay dưới tab (bấm để cuộn tới từng phần). */
  sections: {
    about: 'Giới thiệu', stats: 'Số liệu', products: 'Lĩnh vực', quality: 'Chất lượng',
    culture: 'Văn hóa', recruit: 'Tuyển dụng', contact: 'Liên hệ',
  },

  about: {
    eyebrow: 'Về chúng tôi',
    title: 'VINATECH VINA — thành viên của tập đoàn VINATech Hàn Quốc',
    // TODO: đoạn giới thiệu chính thức
    lead: 'VINATECH VINA là công ty 100% vốn Hàn Quốc, thành viên của VINATech Co., Ltd. — doanh nghiệp tiên phong về siêu tụ điện và vật liệu năng lượng. Nhà máy tại Bắc Ninh sản xuất điện cực và siêu tụ điện cung cấp cho khách hàng toàn cầu.',
    // TODO: mốc lịch sử thật
    history: [
      { year: '1999', text: 'VINATech được thành lập tại Hàn Quốc, phát triển siêu tụ điện (EDLC).' },
      { year: '2016', text: 'Thành lập VINATECH VINA, xây dựng nhà máy tại Bắc Ninh.' },
      { year: '2020', text: 'Mở rộng dây chuyền điện cực và siêu tụ điện công suất lớn.' },
      { year: '2026', text: 'Số hóa quản trị nội bộ với hệ thống CMS mới.' },
    ],
    vision: { title: 'Tầm nhìn', text: 'Trở thành nhà sản xuất linh kiện lưu trữ năng lượng hàng đầu khu vực, góp phần vào nền kinh tế xanh.' },
    mission: { title: 'Sứ mệnh', text: 'Cung cấp sản phẩm an toàn, bền bỉ, chất lượng ổn định; tạo môi trường làm việc an toàn và phát triển cho người lao động.' },
    values: [
      { icon: 'check', title: 'Chất lượng', text: 'Làm đúng ngay từ đầu, không chấp nhận lỗi chuyển sang công đoạn sau.' },
      { icon: 'safety', title: 'An toàn', text: 'An toàn của con người là ưu tiên trước mọi chỉ tiêu sản xuất.' },
      { icon: 'team', title: 'Đồng đội', text: 'Tôn trọng, hợp tác và chia sẻ giữa các bộ phận, các quốc gia.' },
      { icon: 'bulb', title: 'Đổi mới', text: 'Cải tiến liên tục quy trình, thiết bị và cách làm việc.' },
    ] as { icon: LandingIcon; title: string; text: string }[],
  },

  stats: {
    eyebrow: 'Số liệu nổi bật',
    title: 'VINATECH VINA qua những con số',
    // TODO: số liệu thật (value là số để chạy hiệu ứng đếm; suffix là đơn vị hiển thị sau số)
    items: [
      { value: 2016, suffix: '', label: 'Năm thành lập', plain: true },
      { value: 1000, suffix: '+', label: 'Cán bộ, công nhân viên' },
      { value: 30000, suffix: ' m²', label: 'Diện tích nhà máy' },
      { value: 50, suffix: ' triệu+', label: 'Sản phẩm mỗi năm' },
    ] as { value: number; suffix: string; label: string; plain?: boolean }[],
  },

  products: {
    eyebrow: 'Lĩnh vực hoạt động',
    title: 'Sản phẩm và năng lực chính',
    // TODO: danh mục sản phẩm thật
    items: [
      { icon: 'thunder', title: 'Siêu tụ điện (EDLC)', text: 'Tụ điện hai lớp dung lượng cao cho thiết bị điện tử, ô tô, lưu trữ năng lượng.' },
      { icon: 'deploymentUnit', title: 'Điện cực carbon', text: 'Sản xuất điện cực phủ carbon hoạt tính — vật liệu cốt lõi của siêu tụ điện.' },
      { icon: 'car', title: 'Module năng lượng', text: 'Module siêu tụ cho hệ thống khởi động, dự phòng nguồn và xe điện.' },
      { icon: 'experiment', title: 'Kiểm định và R&D', text: 'Phòng thí nghiệm đo kiểm, phát triển sản phẩm cùng trung tâm R&D Hàn Quốc.' },
    ] as { icon: LandingIcon; title: string; text: string }[],
  },

  quality: {
    eyebrow: 'Quy trình và chất lượng',
    title: 'Từ nguyên liệu tới sản phẩm đạt chuẩn',
    // TODO: các bước quy trình thật
    steps: [
      { title: 'Nguyên liệu', text: 'Kiểm tra đầu vào (IQC) từng lô vật liệu.' },
      { title: 'Điện cực', text: 'Phối trộn, phủ, ép và cắt điện cực.' },
      { title: 'Lắp ráp', text: 'Quấn, ngâm điện giải và đóng vỏ.' },
      { title: 'Hóa thành và đo kiểm', text: 'Hóa thành, lão hóa, đo điện dung và nội trở 100%.' },
      { title: 'Xuất hàng', text: 'Kiểm tra cuối (OQC), đóng gói và giao hàng.' },
    ],
    // TODO: chứng nhận thật (tên + năm / phạm vi)
    certs: [
      { name: 'ISO 9001', text: 'Hệ thống quản lý chất lượng' },
      { name: 'ISO 14001', text: 'Hệ thống quản lý môi trường' },
      { name: 'IATF 16949', text: 'Chất lượng ngành ô tô' },
      { name: 'ISO 45001', text: 'An toàn và sức khỏe nghề nghiệp' },
    ],
  },

  culture: {
    eyebrow: 'Văn hóa và đời sống',
    title: 'Làm việc hết mình, gắn kết như một gia đình',
    text: 'Hoạt động thể thao, văn nghệ, sinh nhật, du lịch và các ngày lễ được tổ chức đều đặn cho cán bộ, công nhân viên.',
    // TODO: thay bằng ảnh thật của công ty (WebP, dưới 300KB)
    gallery: [
      { src: '/images/landing/gallery-01.webp', alt: 'Hoạt động thể thao của công nhân viên' },
      { src: '/images/landing/gallery-02.webp', alt: 'Tiệc tất niên cuối năm' },
      { src: '/images/landing/gallery-03.webp', alt: 'Chúc mừng sinh nhật tháng' },
      { src: '/images/landing/gallery-04.webp', alt: 'Đào tạo an toàn lao động' },
      { src: '/images/landing/gallery-05.webp', alt: 'Du lịch hè của công ty' },
      { src: '/images/landing/gallery-06.webp', alt: 'Dây chuyền sản xuất điện cực' },
    ] as LandingImage[],
  },


  recruit: {
    title: 'Cùng VINATECH VINA phát triển sự nghiệp',
    text: 'Chúng tôi luôn tìm kiếm những đồng nghiệp tận tâm. Giới thiệu người thân, bạn bè hoặc xem các vị trí đang tuyển.',
    button: 'Đến mục Tuyển dụng',
    // TODO: ảnh banner tuyển dụng
    image: { src: '/images/landing/recruit-banner.webp', alt: 'Đội ngũ VINATECH VINA' } as LandingImage,
  },

  contact: {
    eyebrow: 'Liên hệ',
    title: 'Nhà máy VINATECH VINA Bắc Ninh',
    // TODO: kiểm tra lại địa chỉ, hotline, email
    address: 'Số 410, khu Hà Liễu, phường Phương Liễu, thị xã Quế Võ, tỉnh Bắc Ninh, Việt Nam',
    hotline: '+84 222 222 1105',
    email: 'hr@vina.co.kr',
    hours: 'Thứ 2 – Thứ 7, 08:00 – 17:00',
    website: 'https://www.vinatech.com/',
    // TODO: link nhúng Google Maps (Google Maps → Chia sẻ → Nhúng bản đồ → lấy giá trị src của iframe)
    mapEmbedUrl: 'https://www.google.com/maps?q=Ph%C6%B0%C6%A1ng%20Li%E1%BB%85u%2C%20Qu%E1%BA%BF%20V%C3%B5%2C%20B%E1%BA%AFc%20Ninh&output=embed',
    labels: { address: 'Địa chỉ', hotline: 'Hotline', email: 'Email', hours: 'Giờ làm việc', website: 'Website', map: 'Bản đồ nhà máy VINATECH VINA Bắc Ninh' },
  },


  footer: {
    copyright: (year: number) => `© ${year} VINATECH VINA Co., Ltd. Bảo lưu mọi quyền.`,
    note: 'Hệ thống quản trị nội bộ — chỉ dành cho cán bộ, công nhân viên.',
  },
}
