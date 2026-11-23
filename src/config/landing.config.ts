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
  companyName: 'VINATECH VINA',
  // TODO: slogan chính thức của công ty
  slogan: 'Năng lượng sạch cho tương lai — chất lượng từ con người Việt Nam.',
  // Ảnh nền chạy của banner đầu trang (chuyển mỗi 5 giây). Bắc Ninh: ảnh bài CafeF 28/10/2026; Hưng Yên: ảnh flycam của nhà thầu Hải Long (07/2026, đã cắt bỏ logo góc)
  heroSlides: [
    { src: '/images/landing/banner-bacninh.webp', alt: 'Nhà máy VINATECH VINA tại Bắc Ninh' },
    { src: '/images/landing/banner-hungyen-1.webp', alt: 'Nhà máy VINATECH ES tại KCN Sạch, Xuân Trúc, Hưng Yên' },
    { src: '/images/landing/banner-hungyen-2.webp', alt: 'Toàn cảnh nhà máy Hưng Yên (giai đoạn hoàn thiện, 07/2026)' },
    // Ninh Bình (Hà Nam cũ): ảnh toàn cảnh KCN Đồng Văn IV do Viglacera đăng (2017), nơi đặt nhà máy VINA ENESOL. TODO: thay bằng ảnh thật của nhà máy
    { src: '/images/landing/banner-ninhbinh.webp', alt: 'KCN Đồng Văn IV, Ninh Bình — nơi đặt nhà máy VINA ENESOL' },
    // Thêm từ ảnh bìa trang Facebook công ty (cắt khung banner)
    { src: '/images/landing/banner-factory-overview.webp', alt: 'Toàn cảnh khuôn viên nhà máy VINATECH VINA Bắc Ninh' },
  ] as LandingImage[],

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
    // Nguồn công khai (11/2026): giới thiệu công ty VINATech, hồ sơ doanh nghiệp, tin tức. TODO: HR duyệt lại câu chữ chính thức
    lead: 'VINATECH VINA là công ty 100% vốn Hàn Quốc, thành viên của VINATech Co., Ltd. (Jeonju, Hàn Quốc; niêm yết KOSDAQ) — nhà sản xuất siêu tụ điện (EDLC), tụ lai và vật liệu pin nhiên liệu hydro hàng đầu thế giới. Từ ba nhà máy tại Bắc Ninh, Hưng Yên và Hà Nam (VINA ENESOL), chúng tôi sản xuất linh kiện lưu trữ năng lượng cho ô tô, điện tử, lưới điện và trung tâm dữ liệu AI trên toàn cầu.',
    history: [
      { year: '1999', text: 'VINATech Co., Ltd. được thành lập tại Jeonju, Hàn Quốc.' },
      { year: '2004', text: 'Bắt đầu sản xuất hàng loạt siêu tụ điện; đạt chứng nhận ISO 9001 và ISO 14001.' },
      { year: '2013', text: 'Niêm yết trên sàn KONEX (Hàn Quốc).' },
      { year: '2017', text: 'Thành lập VINATECH VINA, nhà máy tại phường Phương Liễu, Quế Võ, Bắc Ninh.' },
      { year: '2020', text: 'VINATech chuyển niêm yết lên sàn KOSDAQ.' },
      // TODO: kiểm tra năm VINA ENESOL (Hà Nam) gia nhập / đi vào hoạt động
      { year: '2024', text: 'Mua lại Enesol — nhà sản xuất tụ polymer nhôm và tụ polymer lai; nhà máy VINA ENESOL tại Hà Nam gia nhập tập đoàn.' },
      { year: '2025', text: 'Ký hợp đồng dài hạn cung cấp siêu tụ cho Bloom Energy, phục vụ nguồn điện trung tâm dữ liệu AI.' },
      // TODO: kiểm tra lại quy mô / tên pháp nhân nhà máy Hưng Yên
      { year: '2026', text: 'Xây dựng nhà máy Hưng Yên tại Khu công nghiệp Sạch, xã Xuân Trúc — quy mô 17 ha, đầu tư theo 3 giai đoạn.', highlight: true },
    ] as { year: string; text: string; highlight?: boolean }[],
    historyTitle: 'Hành trình phát triển',
    // Ba điểm nhấn cạnh đoạn giới thiệu
    facts: [
      { value: '1999', label: 'Tập đoàn thành lập' },
      { value: 'KOSDAQ', label: 'Niêm yết Hàn Quốc' },
      { value: '3 nhà máy', label: 'Bắc Ninh · Hưng Yên · Hà Nam' },
    ],
    // Ảnh bên phải đoạn giới thiệu: mặt tiền nhà máy Bắc Ninh (ảnh bài CafeF 28/10/2026)
    image: { src: '/images/landing/about-factory-bn.webp', alt: 'Nhà máy VINATECH VINA tại Bắc Ninh' } as LandingImage,
    badge: { title: 'VINATech Group', text: 'Thành viên tập đoàn Hàn Quốc' },
    // Khung ảnh bên phải đoạn giới thiệu: 3 nhà máy (ảnh lớn trên, 2 ảnh nhỏ dưới). TODO: thay ảnh Ninh Bình bằng ảnh thật của nhà máy VINA ENESOL
    factories: [
      { name: 'Bắc Ninh', src: '/images/landing/about-factory-bn.webp', alt: 'Nhà máy VINATECH VINA tại Bắc Ninh' },
      { name: 'Hưng Yên', src: '/images/landing/banner-hungyen-1.webp', alt: 'Nhà máy VINATECH ES tại KCN Sạch, Xuân Trúc, Hưng Yên' },
      { name: 'Ninh Bình', src: '/images/landing/banner-ninhbinh.webp', alt: 'KCN Đồng Văn IV, Ninh Bình — nơi đặt nhà máy VINA ENESOL' },
    ],
    newTag: 'Mới',
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
    // TODO: kiểm tra lại số liệu (value là số để chạy hiệu ứng đếm; suffix là đơn vị hiển thị sau số)
    items: [
      { value: 1999, suffix: '', label: 'Năm thành lập tập đoàn VINATech', plain: true, icon: 'global' },
      { value: 2017, suffix: '', label: 'Năm thành lập VINATECH VINA', plain: true, icon: 'star' },
      { value: 1000, suffix: '+', label: 'Cán bộ, công nhân viên tại Việt Nam', icon: 'team' },
      { value: 3, suffix: ' nhà máy', label: 'Bắc Ninh, Hưng Yên và Hà Nam (VINA ENESOL)', icon: 'deploymentUnit' },
    ] as { value: number; suffix: string; label: string; plain?: boolean; icon: LandingIcon }[],
  },

  products: {
    eyebrow: 'Lĩnh vực hoạt động',
    title: 'Sản phẩm và năng lực chính',
    // Theo danh mục sản phẩm công khai của VINATech; ảnh lấy từ vinatech.com (11/2026). TODO: chọn đúng các dòng sản xuất tại Việt Nam
    items: [
      { icon: 'thunder', title: 'Siêu tụ điện (EDLC)', text: 'Tụ điện hai lớp sạc / xả nhanh gấp hàng trăm lần pin lithium-ion, tuổi thọ cao — cho ô tô, đồng hồ điện, ESS.', image: '/images/landing/product-edlc.webp' },
      { icon: 'rocket', title: 'Tụ lai và tụ lithium-ion (LiC)', text: 'Mật độ năng lượng gấp khoảng 2 lần EDLC thường; tụ polymer nhôm và polymer lai (VINA ENESOL, Hà Nam).', image: '/images/landing/product-hybrid.webp' },
      { icon: 'experiment', title: 'Vật liệu pin nhiên liệu hydro', text: 'Chất mang xúc tác, xúc tác Pt/C và màng điện cực MEA cho xe và trạm phát điện hydro.', image: '/images/landing/product-fuelcell.webp' },
      { icon: 'deploymentUnit', title: 'Module và hệ thống siêu tụ', text: 'Module, hệ thống lưu trữ cho ESS, lưới điện, xe và nguồn ổn định trung tâm dữ liệu AI.', image: '/images/landing/product-module.webp' },
    ] as { icon: LandingIcon; title: string; text: string; image?: string }[],
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
    // ISO 9001 / 14001: VINATech đạt từ 2004. TODO: xác nhận chứng nhận của nhà máy Việt Nam (IATF 16949, ISO 45001 là ví dụ)
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
    // Ảnh lấy từ trang Facebook VINATech VINA (11/2026). Muốn đổi: thay file cùng tên trong public/images/landing/
    gallery: [
      { src: '/images/landing/gallery-01.webp', alt: 'Lễ ra mắt đội PCCC cơ sở nhà máy Hưng Yên' },
      { src: '/images/landing/gallery-02.webp', alt: 'Ngày hội tuyển dụng tại VINATECH VINA' },
      { src: '/images/landing/gallery-07.webp', alt: 'Chung tay trồng cây xanh' },
      { src: '/images/landing/gallery-04.webp', alt: 'Giới thiệu sản phẩm và công nghệ siêu tụ điện' },
      { src: '/images/landing/gallery-08.webp', alt: 'Hoạt động vì môi trường xanh' },
    ] as LandingImage[],
  },


  recruit: {
    title: 'Cùng VINATECH VINA phát triển sự nghiệp',
    eyebrow: 'Tuyển dụng',
    text: 'Chúng tôi luôn tìm kiếm những đồng nghiệp tận tâm. Hãy giới thiệu người thân, bạn bè cùng gia nhập đại gia đình VINATECH VINA.',
    // TODO: HR kiểm tra lại các điểm nổi bật
    perks: [
      { icon: 'global', text: 'Môi trường doanh nghiệp Hàn Quốc chuyên nghiệp' },
      { icon: 'team', text: 'Đào tạo bài bản, có người kèm cặp (OJT)' },
      { icon: 'rocket', text: 'Nhà máy mới tại Hưng Yên — nhiều vị trí đang mở' },
      { icon: 'heart', text: 'Bữa ăn ca, xe đưa đón và hoạt động gắn kết' },
    ] as { icon: LandingIcon; text: string }[],
    // Ảnh ghép: ảnh lớn bên trái + 2 ảnh nhỏ xếp chồng (ảnh từ trang Facebook công ty)
    images: [
      { src: '/images/landing/recruit-banner.webp', alt: 'Buổi tuyển dụng tại hội trường VINATECH VINA' },
      { src: '/images/landing/gallery-03.webp', alt: 'Đón sinh viên tham quan công ty' },
      { src: '/images/landing/gallery-06.webp', alt: 'Thuyết trình giới thiệu VINATECH VINA' },
    ] as LandingImage[],
  },

  contact: {
    eyebrow: 'Liên hệ',
    title: 'Nhà máy VINATECH VINA',
    // TODO: kiểm tra lại địa chỉ, hotline, email
    address: 'Số 410, khu Hà Liễu, phường Phương Liễu, thị xã Quế Võ, tỉnh Bắc Ninh, Việt Nam',
    // Nhà máy thứ hai (Hưng Yên). TODO: kiểm tra lại địa chỉ
    address2: 'Lô CN7.4-5, Khu công nghiệp Sạch, xã Xuân Trúc, tỉnh Hưng Yên, Việt Nam',
    // Nhà máy thứ ba: VINA ENESOL (Hà Nam cũ, nay thuộc tỉnh Ninh Bình sau sáp nhập 2025)
    address3: '01 Khu công nghiệp Đồng Văn IV, xã Lê Hồ, tỉnh Ninh Bình, Việt Nam',
    hotline: '+84 222 222 1105',
    email: 'hr@vina.co.kr',
    hours: 'Thứ 2 – Thứ 7, 08:00 – 17:00',
    website: 'https://www.vinatech.com/',
    // Trang chính thức trên mạng xã hội (hiện ở phần Liên hệ và footer)
    socials: [
      { kind: 'facebook', label: 'Facebook VINATech VINA', url: 'https://www.facebook.com/VINATechVina.sieutudien' },
      { kind: 'youtube', label: 'YouTube VINATech', url: 'https://www.youtube.com/c/VINATech/featured' },
      { kind: 'linkedin', label: 'LinkedIn VINATech', url: 'https://www.linkedin.com/company/6419696/' },
      { kind: 'website', label: 'vinatech.com', url: 'https://www.vinatech.com/' },
    ] as { kind: 'facebook' | 'youtube' | 'linkedin' | 'website'; label: string; url: string }[],
    // TODO: link nhúng Google Maps (Google Maps → Chia sẻ → Nhúng bản đồ → lấy giá trị src của iframe)
    mapEmbedUrl: 'https://www.google.com/maps?q=Ph%C6%B0%C6%A1ng%20Li%E1%BB%85u%2C%20Qu%E1%BA%BF%20V%C3%B5%2C%20B%E1%BA%AFc%20Ninh&output=embed',
    // Bản đồ nhà máy Hưng Yên (KCN Sạch, xã Xuân Trúc). TODO: thay bằng link nhúng chính xác của nhà máy
    mapEmbedUrl2: 'https://www.google.com/maps?q=Khu%20c%C3%B4ng%20nghi%E1%BB%87p%20S%E1%BA%A1ch%20Xu%C3%A2n%20Tr%C3%BAc%20H%C6%B0ng%20Y%C3%AAn&output=embed',
    // Bản đồ VINA ENESOL (KCN Đồng Văn IV). Có link nhúng chính xác của nhà máy thì thay vào đây
    mapEmbedUrl3: 'https://www.google.com/maps?q=Khu%20c%C3%B4ng%20nghi%E1%BB%87p%20%C4%90%E1%BB%93ng%20V%C4%83n%20IV%2C%20L%C3%AA%20H%E1%BB%93%2C%20Ninh%20B%C3%ACnh&output=embed',
    labels: { address: 'Nhà máy Bắc Ninh', address2: 'Nhà máy Hưng Yên', address3: 'Nhà máy Hà Nam — VINA ENESOL (nay thuộc Ninh Bình)', hotline: 'Hotline', email: 'Email', hours: 'Giờ làm việc', website: 'Website', socials: 'Theo dõi chúng tôi', map: 'Bản đồ nhà máy VINATECH VINA Bắc Ninh', map2: 'Bản đồ nhà máy VINATECH VINA Hưng Yên', map3: 'Bản đồ nhà máy VINA ENESOL Hà Nam', mapBn: 'Bắc Ninh', mapHy: 'Hưng Yên', mapHn: 'Hà Nam' },
  },


  footer: {
    copyright: (year: number) => `© ${year} VINATECH VINA Co., Ltd. Bảo lưu mọi quyền.`,
    note: 'Hệ thống quản trị nội bộ — chỉ dành cho cán bộ, công nhân viên.',
  },
}
