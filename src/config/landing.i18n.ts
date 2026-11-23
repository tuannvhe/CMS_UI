/**
 * Bản dịch nội dung trang chủ landing (tiếng Anh, tiếng Hàn). Gốc tiếng Việt nằm ở landing.config.ts.
 * Chỉ ghi phần chữ: ảnh, icon, số, năm, đường dẫn lấy từ bản gốc. Mảng ghép theo thứ tự phần tử (phần tử thứ n ghép với phần tử thứ n của bản gốc),
 * nên khi thêm / bớt / đổi thứ tự một mục ở landing.config.ts thì sửa cả mảng tương ứng ở đây. Thiếu chữ nào thì hiện chữ tiếng Việt.
 */
import { landing } from './landing.config'

type DeepPartial<T> = T extends (...args: never[]) => unknown ? T
  : T extends readonly (infer U)[] ? DeepPartial<U>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T
type Landing = typeof landing
/** heroSlides: chú thích ảnh banner (nếu bản gốc có). */
type Override = DeepPartial<Landing> & { heroSlides?: { alt?: string }[] }

const en: Override = {
  slogan: 'Clean energy for the future — quality made by Vietnamese people.',
  heroSlides: [
    { alt: 'VINATECH VINA factory in Bac Ninh' },
    { alt: 'VINATECH ES factory, Xuan Truc Clean Industrial Park, Hung Yen' },
    { alt: 'Hung Yen factory overview (finishing phase, 07/2026)' },
    { alt: 'VINATECH ES Hung Yen factory from above' },
    { alt: 'Dong Van IV Industrial Park, Ninh Binh — home of the VINA ENESOL factory' },
    { alt: 'VINATECH VINA Bac Ninh campus overview' },
  ],
  greeting: { morning: 'Good morning', noon: 'Good afternoon', afternoon: 'Good afternoon', evening: 'Good evening' },
  cta: { learnMore: 'Learn more', contact: 'Contact' },
  quickTitle: 'Quick access',
  sections: { about: 'About', stats: 'Key figures', products: 'Products', quality: 'Quality', culture: 'Culture', recruit: 'Careers', contact: 'Contact' },
  about: {
    eyebrow: 'About us',
    title: 'VINATECH VINA — a member of Korea’s VINATech Group',
    lead: 'VINATECH VINA is a 100% Korean-invested company and a member of VINATech Co., Ltd. (Jeonju, Korea; KOSDAQ-listed) — a world-leading maker of supercapacitors (EDLC), hybrid capacitors and hydrogen fuel cell materials. From three factories in Bac Ninh, Hung Yen and Ha Nam (VINA ENESOL), we make energy storage components for cars, electronics, power grids and AI data centers worldwide.',
    history: [
      { text: 'VINATech Co., Ltd. was founded in Jeonju, Korea.' },
      { text: 'Started mass production of supercapacitors; certified ISO 9001 and ISO 14001.' },
      { text: 'Listed on the KONEX market (Korea).' },
      { text: 'VINATECH VINA was established, with its factory in Phuong Lieu, Que Vo, Bac Ninh.' },
      { text: 'VINATech moved its listing to KOSDAQ.' },
      { text: 'Acquired Enesol, a maker of aluminium polymer and hybrid polymer capacitors; the VINA ENESOL factory in Ha Nam joined the group.' },
      { text: 'Signed a long-term deal to supply supercapacitors to Bloom Energy for AI data center power.' },
      { text: 'Building the Hung Yen factory in Xuan Truc Clean Industrial Park — 17 ha, invested in 3 phases.' },
    ],
    historyTitle: 'Our journey',
    facts: [
      { label: 'Group founded' },
      { label: 'Listed in Korea' },
      { value: '3 factories', label: 'Bac Ninh · Hung Yen · Ha Nam' },
    ],
    badge: { title: 'VINATech Group', text: 'Member of a Korean group' },
    factories: [
      { name: 'Bac Ninh', alt: 'VINATECH VINA factory in Bac Ninh' },
      { name: 'Hung Yen', alt: 'VINATECH ES factory, Xuan Truc Clean Industrial Park, Hung Yen' },
      { name: 'Ninh Binh', alt: 'Dong Van IV Industrial Park, Ninh Binh — home of the VINA ENESOL factory' },
    ],
    newTag: 'New',
    vision: { title: 'Vision', text: 'To be the region’s leading maker of energy storage components, contributing to a green economy.' },
    mission: { title: 'Mission', text: 'To deliver safe, durable products of consistent quality, and a safe workplace where our people can grow.' },
    values: [
      { title: 'Quality', text: 'Do it right the first time; never pass a defect to the next process.' },
      { title: 'Safety', text: 'People’s safety comes before any production target.' },
      { title: 'Teamwork', text: 'Respect, cooperation and sharing across departments and countries.' },
      { title: 'Innovation', text: 'Continuously improve our processes, equipment and ways of working.' },
    ],
  },
  stats: {
    eyebrow: 'Key figures',
    title: 'VINATECH VINA in numbers',
    items: [
      { label: 'VINATech Group founded' },
      { label: 'VINATECH VINA founded' },
      { label: 'Employees in Vietnam' },
      { suffix: ' factories', label: 'Bac Ninh, Hung Yen and Ha Nam (VINA ENESOL)' },
    ],
  },
  products: {
    eyebrow: 'What we do',
    title: 'Products and capabilities',
    items: [
      { title: 'Supercapacitors (EDLC)', text: 'Double-layer capacitors that charge and discharge hundreds of times faster than lithium-ion batteries, with a long life — for cars, smart meters and ESS.' },
      { title: 'Hybrid and lithium-ion capacitors (LiC)', text: 'About twice the energy density of standard EDLCs; aluminium polymer and hybrid polymer capacitors (VINA ENESOL, Ha Nam).' },
      { title: 'Hydrogen fuel cell materials', text: 'Catalyst supports, Pt/C catalysts and MEAs for hydrogen vehicles and power stations.' },
      { title: 'Supercapacitor modules and systems', text: 'Modules and storage systems for ESS, power grids, vehicles and stable power for AI data centers.' },
    ],
  },
  quality: {
    eyebrow: 'Process and quality',
    title: 'From raw materials to certified products',
    steps: [
      { title: 'Materials', text: 'Incoming inspection (IQC) of every material lot.' },
      { title: 'Electrodes', text: 'Mixing, coating, pressing and slitting electrodes.' },
      { title: 'Assembly', text: 'Winding, electrolyte impregnation and sealing.' },
      { title: 'Aging and testing', text: 'Formation, aging, and 100% capacitance and ESR testing.' },
      { title: 'Shipping', text: 'Outgoing inspection (OQC), packing and delivery.' },
    ],
    certs: [
      { text: 'Quality management' },
      { text: 'Environmental management' },
      { text: 'Automotive quality' },
      { text: 'Occupational health and safety' },
    ],
  },
  culture: {
    eyebrow: 'Culture and life',
    title: 'Working hard, together like a family',
    text: 'Sports, arts, birthdays, trips and holiday events are held regularly for all our employees.',
    gallery: [
      { alt: 'Year End Party — stage performance' },
      { alt: 'Year End Party — group photo' },
      { alt: 'VINATECH Trade Union football tournament, 4th edition, 2025' },
      { alt: 'Weekly charity activity in Que Vo' },
      { alt: 'Our team in the VINATECH lobby' },
      { alt: 'VINATECH VINA training room' },
      { alt: 'Trade Union shared meal program' },
      { alt: 'Beach trip with colleagues' },
      { alt: 'Job fair at Hung Yen University of Technology and Education' },
      { alt: 'Launch of the Hung Yen factory fire brigade' },
      { alt: 'Recruitment day at VINATECH VINA' },
      { alt: 'Planting trees together' },
      { alt: 'Introducing our supercapacitor products and technology' },
      { alt: 'Activities for a greener environment' },
    ],
  },
  recruit: {
    title: 'Grow your career with VINATECH VINA',
    eyebrow: 'Careers',
    text: 'We are always looking for dedicated colleagues. Invite your family and friends to join the VINATECH VINA family.',
    perks: [
      { text: 'A professional Korean company environment' },
      { text: 'Structured training with a mentor (OJT)' },
      { text: 'New factory in Hung Yen — many open positions' },
      { text: 'Shift meals, shuttle buses and team activities' },
    ],
    images: [
      { alt: 'Recruitment session in the VINATECH VINA hall' },
      { alt: 'Welcoming students on a company visit' },
      { alt: 'Company introduction presentation' },
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'VINATECH VINA factories',
    address: 'No. 410, Ha Lieu Quarter, Phuong Lieu Ward, Que Vo Town, Bac Ninh Province, Vietnam',
    address2: 'Lot CN7.4-5, Clean Industrial Park, Xuan Truc Commune, Hung Yen Province, Vietnam',
    address3: '01 Dong Van IV Industrial Park, Le Ho Commune, Ninh Binh Province, Vietnam',
    hours: 'Mon – Sat, 08:00 – 17:00',
    labels: {
      address: 'Bac Ninh factory', address2: 'Hung Yen factory', address3: 'Ha Nam factory — VINA ENESOL (now Ninh Binh)', hotline: 'Hotline', email: 'Email',
      hours: 'Working hours', website: 'Website', socials: 'Follow us', map: 'Map of the VINATECH VINA Bac Ninh factory', map2: 'Map of the VINATECH VINA Hung Yen factory',
      map3: 'Map of the VINA ENESOL Ha Nam factory', mapBn: 'Bac Ninh', mapHy: 'Hung Yen', mapHn: 'Ha Nam',
    },
  },
  footer: {
    copyright: (year: number) => `© ${year} VINATECH VINA Co., Ltd. All rights reserved.`,
    note: 'Internal management system — for VINATECH VINA employees only.',
  },
}

const ko: Override = {
  slogan: '미래를 위한 깨끗한 에너지 — 베트남 사람들이 만드는 품질.',
  heroSlides: [
    { alt: '박닌 VINATECH VINA 공장' },
    { alt: '흥옌 쑤언쭉 클린 산업단지 VINATECH ES 공장' },
    { alt: '흥옌 공장 전경 (마무리 단계, 2026년 7월)' },
    { alt: '하늘에서 본 VINATECH ES 흥옌 공장' },
    { alt: '닌빈 동반 IV 산업단지 — VINA ENESOL 공장 소재지' },
    { alt: 'VINATECH VINA 박닌 공장 전경' },
  ],
  greeting: { morning: '좋은 아침입니다', noon: '좋은 점심입니다', afternoon: '좋은 오후입니다', evening: '좋은 저녁입니다' },
  cta: { learnMore: '더 알아보기', contact: '문의하기' },
  quickTitle: '바로가기',
  sections: { about: '회사 소개', stats: '주요 수치', products: '사업 분야', quality: '품질', culture: '기업 문화', recruit: '채용', contact: '연락처' },
  about: {
    eyebrow: '회사 소개',
    title: 'VINATECH VINA — 한국 비나텍 그룹의 일원',
    lead: 'VINATECH VINA는 한국 100% 투자 법인으로, 슈퍼커패시터(EDLC), 하이브리드 커패시터, 수소 연료전지 소재 분야의 세계적인 기업 비나텍(VINATech Co., Ltd., 전주, 코스닥 상장)의 계열사입니다. 박닌, 흥옌, 하남(VINA ENESOL) 세 공장에서 자동차, 전자, 전력망, AI 데이터센터용 에너지 저장 부품을 생산해 전 세계에 공급합니다.',
    history: [
      { text: '전주에서 (주)비나텍 설립.' },
      { text: '슈퍼커패시터 양산 시작; ISO 9001 및 ISO 14001 인증 취득.' },
      { text: '코넥스(KONEX) 상장.' },
      { text: 'VINATECH VINA 설립, 박닌성 꿰보 프엉리우 공장 가동.' },
      { text: '코스닥(KOSDAQ) 이전 상장.' },
      { text: '알루미늄 폴리머 및 하이브리드 폴리머 커패시터 제조사 에네솔 인수; 하남 VINA ENESOL 공장 그룹 합류.' },
      { text: 'AI 데이터센터 전원용 슈퍼커패시터를 Bloom Energy에 장기 공급하는 계약 체결.' },
      { text: '흥옌 쑤언쭉 클린 산업단지에 흥옌 공장 건설 — 17ha, 3단계 투자.' },
    ],
    historyTitle: '발자취',
    facts: [
      { label: '그룹 설립' },
      { label: '한국 상장' },
      { value: '3개 공장', label: '박닌 · 흥옌 · 하남' },
    ],
    badge: { title: 'VINATech Group', text: '한국 그룹 계열사' },
    factories: [
      { name: '박닌', alt: '박닌 VINATECH VINA 공장' },
      { name: '흥옌', alt: '흥옌 쑤언쭉 클린 산업단지 VINATECH ES 공장' },
      { name: '닌빈', alt: '닌빈 동반 IV 산업단지 — VINA ENESOL 공장 소재지' },
    ],
    newTag: '신규',
    vision: { title: '비전', text: '지역을 대표하는 에너지 저장 부품 제조사로서 녹색 경제에 기여합니다.' },
    mission: { title: '미션', text: '안전하고 내구성 있는 제품을 일관된 품질로 공급하고, 임직원이 안전하게 성장할 수 있는 일터를 만듭니다.' },
    values: [
      { title: '품질', text: '처음부터 올바르게, 불량을 다음 공정으로 넘기지 않습니다.' },
      { title: '안전', text: '사람의 안전이 어떤 생산 목표보다 우선입니다.' },
      { title: '팀워크', text: '부서와 국가를 넘어 존중하고 협력하며 나눕니다.' },
      { title: '혁신', text: '공정, 설비, 일하는 방식을 끊임없이 개선합니다.' },
    ],
  },
  stats: {
    eyebrow: '주요 수치',
    title: '숫자로 보는 VINATECH VINA',
    items: [
      { label: '비나텍 그룹 설립' },
      { label: 'VINATECH VINA 설립' },
      { label: '베트남 임직원' },
      { suffix: '개 공장', label: '박닌, 흥옌, 하남 (VINA ENESOL)' },
    ],
  },
  products: {
    eyebrow: '사업 분야',
    title: '주요 제품과 역량',
    items: [
      { title: '슈퍼커패시터 (EDLC)', text: '리튬이온 배터리보다 수백 배 빠른 충방전과 긴 수명의 전기이중층 커패시터 — 자동차, 스마트 미터, ESS용.' },
      { title: '하이브리드 및 리튬이온 커패시터 (LiC)', text: '일반 EDLC 대비 약 2배의 에너지 밀도; 알루미늄 폴리머·하이브리드 폴리머 커패시터 (VINA ENESOL, 하남).' },
      { title: '수소 연료전지 소재', text: '수소차와 발전소용 촉매 지지체, Pt/C 촉매, MEA.' },
      { title: '슈퍼커패시터 모듈 및 시스템', text: 'ESS, 전력망, 차량, AI 데이터센터 안정 전원용 모듈과 저장 시스템.' },
    ],
  },
  quality: {
    eyebrow: '공정과 품질',
    title: '원자재부터 인증된 제품까지',
    steps: [
      { title: '원자재', text: '모든 자재 로트 수입검사 (IQC).' },
      { title: '전극', text: '전극 혼합, 코팅, 압연, 슬리팅.' },
      { title: '조립', text: '권취, 전해액 함침, 밀봉.' },
      { title: '화성 및 검사', text: '화성, 에이징, 정전용량·내부저항 전수 검사.' },
      { title: '출하', text: '출하검사 (OQC), 포장 및 납품.' },
    ],
    certs: [
      { text: '품질경영시스템' },
      { text: '환경경영시스템' },
      { text: '자동차 품질' },
      { text: '안전보건경영시스템' },
    ],
  },
  culture: {
    eyebrow: '기업 문화',
    title: '열정적으로 일하고, 가족처럼 함께합니다',
    text: '임직원을 위한 체육, 문화 행사, 생일, 여행, 명절 행사를 꾸준히 진행합니다.',
    gallery: [
      { alt: '송년회 Year End Party — 공연' },
      { alt: '송년회 Year End Party — 단체 사진' },
      { alt: '제4회 VINATECH 노동조합 축구 대회 (2025)' },
      { alt: '꿰보 지역 주간 봉사 활동' },
      { alt: 'VINATECH 로비에서 함께한 임직원' },
      { alt: 'VINATECH VINA 교육실' },
      { alt: '노동조합 함께하는 식사 프로그램' },
      { alt: '동료들과 함께한 바다 여행' },
      { alt: '흥옌 기술사범대학교 채용 박람회' },
      { alt: '흥옌 공장 자체 소방대 발대식' },
      { alt: 'VINATECH VINA 채용의 날' },
      { alt: '함께하는 나무 심기' },
      { alt: '슈퍼커패시터 제품 및 기술 소개' },
      { alt: '녹색 환경을 위한 활동' },
    ],
  },
  recruit: {
    title: 'VINATECH VINA와 함께 성장하세요',
    eyebrow: '채용',
    text: '헌신적인 동료를 언제나 찾고 있습니다. 가족과 친구에게 VINATECH VINA 가족이 될 기회를 소개해 주세요.',
    perks: [
      { text: '전문적인 한국 기업 환경' },
      { text: '체계적인 교육과 멘토 (OJT)' },
      { text: '흥옌 신공장 — 다양한 직무 모집 중' },
      { text: '식사, 통근 버스, 사내 행사' },
    ],
    images: [
      { alt: 'VINATECH VINA 강당 채용 설명회' },
      { alt: '대학생 회사 방문' },
      { alt: '회사 소개 발표' },
    ],
  },
  contact: {
    eyebrow: '연락처',
    title: 'VINATECH VINA 공장',
    address: '베트남 박닌성 꿰보시 프엉리우동 하리우 구역 410번지',
    address2: '베트남 흥옌성 쑤언쭉사 클린 산업단지 CN7.4-5 부지',
    address3: '베트남 닌빈성 레호사 동반 IV 산업단지 01',
    hours: '월 – 토, 08:00 – 17:00',
    labels: {
      address: '박닌 공장', address2: '흥옌 공장', address3: '하남 공장 — VINA ENESOL (현 닌빈성)', hotline: '대표 전화', email: '이메일',
      hours: '근무 시간', website: '웹사이트', socials: '팔로우하기', map: 'VINATECH VINA 박닌 공장 지도', map2: 'VINATECH VINA 흥옌 공장 지도',
      map3: 'VINA ENESOL 하남 공장 지도', mapBn: '박닌', mapHy: '흥옌', mapHn: '하남',
    },
  },
  footer: {
    copyright: (year: number) => `© ${year} VINATECH VINA Co., Ltd. All rights reserved.`,
    note: '사내 관리 시스템 — VINATECH VINA 임직원 전용.',
  },
}

/** Ghép bản dịch vào bản gốc: đối tượng ghép theo khóa, mảng ghép theo thứ tự phần tử, giá trị rỗng / thiếu giữ bản gốc. */
function merge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base
  if (Array.isArray(base)) {
    const o = Array.isArray(over) ? over : []
    return base.map((b, i) => merge(b, o[i])) as T
  }
  if (base && typeof base === 'object' && typeof over === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) if (k in out) out[k] = merge(out[k], v)
    return out as T
  }
  return (typeof over === typeof base ? over : base) as T
}

const cache = new Map<string, Landing>()
/** Nội dung landing theo ngôn ngữ giao diện (vi / en / ko; ngôn ngữ khác dùng tiếng Việt). */
export function landingFor(lang: string | undefined): Landing {
  const key = (lang ?? 'vi').slice(0, 2)
  const over = key === 'en' ? en : key === 'ko' ? ko : null
  if (!over) return landing
  let v = cache.get(key)
  if (!v) { v = merge(landing, over); cache.set(key, v) }
  return v
}
