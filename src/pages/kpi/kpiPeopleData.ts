import { DEPTS, achievement, type KpiItem, type L3 } from './kpiDemoData'

/** Dữ liệu MẪU theo từng người và từng line sản xuất (tên và mã DEMO-xxx là giả, sinh cố định; không đọc / ghi CSDL). Đang trong quá trình xây dựng. */
export type Role = 'manager' | 'leader' | 'staff' | 'operator'
export interface DemoPerson { code: string; name: string; dept: string; role: Role; line?: string; kpis: KpiItem[] }
export interface DemoLine { code: string; name: L3; product: L3; shift: L3; leader: string }

export const LINES: DemoLine[] = [
  { code: 'L1', name: { vi: 'Line 1', en: 'Line 1', ko: '라인 1' }, product: { vi: 'Lắp ráp bo mạch', en: 'Board assembly', ko: '보드 조립' }, shift: { vi: 'Ca ngày', en: 'Day shift', ko: '주간' }, leader: '' },
  { code: 'L2', name: { vi: 'Line 2', en: 'Line 2', ko: '라인 2' }, product: { vi: 'Lắp ráp bo mạch', en: 'Board assembly', ko: '보드 조립' }, shift: { vi: 'Ca đêm', en: 'Night shift', ko: '야간' }, leader: '' },
  { code: 'L3', name: { vi: 'Line 3', en: 'Line 3', ko: '라인 3' }, product: { vi: 'Kiểm tra chức năng', en: 'Functional test', ko: '기능 검사' }, shift: { vi: 'Ca ngày', en: 'Day shift', ko: '주간' }, leader: '' },
  { code: 'L4', name: { vi: 'Line 4', en: 'Line 4', ko: '라인 4' }, product: { vi: 'Đóng gói', en: 'Packing', ko: '포장' }, shift: { vi: 'Ca ngày', en: 'Day shift', ko: '주간' }, leader: '' },
]

const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô']
const MID = ['Văn', 'Thị', 'Minh', 'Quốc', 'Ngọc', 'Hữu', 'Thanh', 'Đức']
const FIRST = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hiếu', 'Huy', 'Khoa', 'Lan', 'Linh', 'Mai', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tú', 'Vinh', 'Yến']

function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const r1 = (v: number) => Math.round(v * 10) / 10

/** Chuỗi 6 tháng: quanh `base` (đã nhân năng lực), tăng / giảm nhẹ theo xu hướng, có nhiễu. */
function series(rand: () => number, target: number, skill: number, lowerIsBetter: boolean, spread: number): number[] {
  const out: number[] = []
  const base = lowerIsBetter ? target * (1 - skill * 0.35) : target * (1 + skill * 0.07)
  const trend = (rand() - 0.4) * 0.02
  for (let i = 0; i < 6; i++) {
    const v = base * (1 + trend * (i - 2.5) * (lowerIsBetter ? -1 : 1)) + (rand() - 0.5) * spread * target
    out.push(r1(Math.max(0, v)))
  }
  return out
}

const OP: [string, L3, string, number, number, boolean, number][] = [
  ['out', { vi: 'Sản lượng đạt định mức', en: 'Output vs standard', ko: '표준 대비 생산량' }, '%', 40, 100, false, 0.06],
  ['def', { vi: 'Tỷ lệ lỗi cá nhân', en: 'Personal defect rate', ko: '개인 불량률' }, '%', 30, 1.5, true, 0.25],
  ['att', { vi: 'Chuyên cần', en: 'Attendance', ko: '출근율' }, '%', 30, 96, false, 0.03],
]
const LD: [string, L3, string, number, number, boolean, number][] = [
  ['out', { vi: 'Line đạt kế hoạch', en: 'Line output vs plan', ko: '라인 계획 달성' }, '%', 40, 100, false, 0.05],
  ['def', { vi: 'Tỷ lệ lỗi của line', en: 'Line defect rate', ko: '라인 불량률' }, '%', 30, 1.5, true, 0.2],
  ['att', { vi: 'Chuyên cần', en: 'Attendance', ko: '출근율' }, '%', 30, 96, false, 0.03],
]
const ST: [string, L3, string, number, number, boolean, number][] = [
  ['task', { vi: 'Hoàn thành việc được giao', en: 'Assigned tasks completed', ko: '배정 업무 완료율' }, '%', 40, 95, false, 0.06],
  ['qual', { vi: 'Chất lượng công việc', en: 'Work quality', ko: '업무 품질' }, '%', 30, 97, false, 0.03],
  ['att', { vi: 'Chuyên cần', en: 'Attendance', ko: '출근율' }, '%', 30, 96, false, 0.03],
]

function makeKpis(prefix: string, defs: typeof OP, rand: () => number, skill: number): KpiItem[] {
  return defs.map(([id, name, unit, weight, target, lower, spread]) => ({
    id: `${prefix}-${id}`, name, unit, weight, target, lowerIsBetter: lower,
    actual: series(rand, target, skill, lower, spread).map((v) => (unit === '%' && !lower ? Math.min(v, 110) : v)),
  }))
}

function build(): DemoPerson[] {
  const rand = rng(20261105)
  const used = new Set<string>()
  let seq = 0
  const nameOf = () => {
    for (;;) {
      const n = `${LAST[Math.floor(rand() * LAST.length)]} ${MID[Math.floor(rand() * MID.length)]} ${FIRST[Math.floor(rand() * FIRST.length)]}`
      if (!used.has(n)) { used.add(n); return n }
    }
  }
  const people: DemoPerson[] = []
  const add = (dept: string, role: Role, defs: typeof OP, line?: string) => {
    seq++
    const code = `DEMO-${String(seq).padStart(3, '0')}`
    const skill = rand() * 2 - 1
    people.push({ code, name: nameOf(), dept, role, line, kpis: makeKpis(code, defs, rand, skill) })
    return code
  }
  for (const d of DEPTS) {
    add(d.code, 'manager', ST)
    if (d.code === 'PROD') continue
    const n = d.code === 'QC' || d.code === 'WH' ? 5 : 3
    for (let i = 0; i < n; i++) add(d.code, 'staff', ST)
  }
  // Sản xuất: mỗi line 1 tổ trưởng + 7 công nhân
  for (const l of LINES) {
    l.leader = add('PROD', 'leader', LD, l.code)
    for (let i = 0; i < 7; i++) add('PROD', 'operator', OP, l.code)
  }
  return people
}

export const PEOPLE: DemoPerson[] = build()

/** Điểm KPI từ một danh sách chỉ tiêu ở tháng thứ m: trung bình có trọng số của % đạt. */
export function kpisScore(kpis: KpiItem[], m: number): number {
  const w = kpis.reduce((s, i) => s + i.weight, 0) || 1
  return Math.round((kpis.reduce((s, i) => s + achievement(i, i.actual[m]) * i.weight, 0) / w) * 10) / 10
}
export const personScore = (p: DemoPerson, m: number) => kpisScore(p.kpis, m)

/** Chỉ tiêu của line = trung bình các thành viên (mỗi chỉ tiêu), cộng giờ dừng máy riêng của line. */
export function lineKpis(code: string): KpiItem[] {
  const ms = PEOPLE.filter((p) => p.line === code && p.role === 'operator')
  const avg = (idx: number) => Array.from({ length: 6 }, (_, m) => r1(ms.reduce((s, p) => s + p.kpis[idx].actual[m], 0) / (ms.length || 1)))
  const rand = rng(code.charCodeAt(1) * 977)
  return [
    { ...ms[0].kpis[0], id: `${code}-out`, name: { vi: 'Sản lượng đạt kế hoạch', en: 'Output vs plan', ko: '계획 대비 생산량' }, actual: avg(0) },
    { ...ms[0].kpis[1], id: `${code}-def`, name: { vi: 'Tỷ lệ phế phẩm', en: 'Scrap rate', ko: '불량률' }, actual: avg(1) },
    { ...ms[0].kpis[2], id: `${code}-att`, name: { vi: 'Chuyên cần của line', en: 'Line attendance', ko: '라인 출근율' }, actual: avg(2) },
    { id: `${code}-down`, name: { vi: 'Giờ dừng máy ngoài kế hoạch', en: 'Unplanned downtime', ko: '비계획 정지시간' }, unit: 'h', weight: 25, target: 10, lowerIsBetter: true, actual: series(rand, 10, rand() * 2 - 1, true, 0.3) },
  ]
}
export const lineScore = (code: string, m: number) => kpisScore(lineKpis(code), m)
export const ROLE_LABEL: Record<Role, L3> = {
  manager: { vi: 'Trưởng phòng', en: 'Manager', ko: '부서장' },
  leader: { vi: 'Tổ trưởng', en: 'Line leader', ko: '라인 리더' },
  staff: { vi: 'Nhân viên', en: 'Staff', ko: '사원' },
  operator: { vi: 'Công nhân', en: 'Operator', ko: '작업자' },
}
