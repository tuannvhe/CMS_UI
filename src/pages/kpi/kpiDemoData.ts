import { achieve as calcAchieve } from './kpiCalc'

/** Dữ liệu MẪU cho các tab Demo KPI (chỉ chạy ở trình duyệt, không đọc / ghi CSDL). Tính năng đang trong quá trình xây dựng. */
export type L3 = { vi: string; en: string; ko: string }
export interface KpiItem {
  id: string
  name: L3
  unit: string
  /** true: càng thấp càng tốt (phế phẩm, dừng máy, tai nạn…) */
  lowerIsBetter?: boolean
  weight: number
  target: number
  /** Thực tế 6 tháng gần nhất (cũ → mới) */
  actual: number[]
}
export interface KpiDept { code: string; name: L3; owner: string; kpis: KpiItem[] }

const k = (id: string, vi: string, en: string, ko: string, unit: string, weight: number, target: number, actual: number[], lowerIsBetter = false): KpiItem =>
  ({ id, name: { vi, en, ko }, unit, weight, target, actual, lowerIsBetter })

export const MONTHS = ['06/2026', '07/2026', '08/2026', '09/2026', '10/2026', '11/2026']

export const DEPTS: KpiDept[] = [
  { code: 'PROD', name: { vi: 'Sản xuất', en: 'Production', ko: '생산' }, owner: 'Nguyễn Văn A', kpis: [
    k('prod-out', 'Sản lượng đạt kế hoạch', 'Output vs plan', '계획 대비 생산량', '%', 35, 100, [96, 98, 97, 101, 103, 99]),
    k('prod-oee', 'Hiệu suất thiết bị (OEE)', 'Overall equipment effectiveness (OEE)', '설비종합효율(OEE)', '%', 25, 85, [78, 80, 82, 83, 84, 86]),
    k('prod-ot', 'Giờ tăng ca / người / tháng', 'Overtime hours / person / month', '인당 월 연장근무', 'h', 20, 30, [38, 36, 33, 31, 29, 28], true),
    k('prod-ontime', 'Giao hàng đúng hạn', 'On-time delivery', '납기 준수율', '%', 20, 98, [94, 95, 97, 96, 98, 98]),
  ] },
  { code: 'QC', name: { vi: 'Chất lượng', en: 'Quality', ko: '품질' }, owner: 'Trần Thị B', kpis: [
    k('qc-defect', 'Tỷ lệ phế phẩm', 'Scrap rate', '불량률', '%', 40, 1.5, [2.4, 2.2, 2.0, 1.8, 1.6, 1.4], true),
    k('qc-claim', 'Khiếu nại khách hàng', 'Customer complaints', '고객 클레임', 'case', 30, 3, [6, 5, 4, 4, 3, 2], true),
    k('qc-fpy', 'Đạt ngay lần đầu (FPY)', 'First pass yield (FPY)', '직행률(FPY)', '%', 30, 97, [93, 94, 95, 96, 96, 97]),
  ] },
  { code: 'WH', name: { vi: 'Kho vận', en: 'Warehouse & logistics', ko: '창고·물류' }, owner: 'Lê Văn C', kpis: [
    k('wh-acc', 'Độ chính xác tồn kho', 'Inventory accuracy', '재고 정확도', '%', 40, 99, [97.5, 98, 98.4, 98.9, 99.1, 99.3]),
    k('wh-days', 'Số ngày tồn kho', 'Days of inventory', '재고 일수', 'day', 30, 20, [26, 25, 24, 23, 22, 21], true),
    k('wh-ship', 'Xuất hàng đúng hẹn', 'On-time shipment', '출하 납기 준수', '%', 30, 98, [95, 96, 95, 97, 97, 96]),
  ] },
  { code: 'MT', name: { vi: 'Bảo trì', en: 'Maintenance', ko: '설비보전' }, owner: 'Phạm Văn D', kpis: [
    k('mt-down', 'Giờ dừng máy ngoài kế hoạch', 'Unplanned downtime', '비계획 정지시간', 'h', 45, 40, [62, 58, 52, 47, 44, 41], true),
    k('mt-pm', 'Hoàn thành bảo trì định kỳ', 'Preventive maintenance done', '예방보전 완료율', '%', 35, 95, [88, 90, 91, 93, 95, 96]),
    k('mt-mttr', 'Thời gian sửa trung bình (MTTR)', 'Mean time to repair (MTTR)', '평균 수리시간(MTTR)', 'h', 20, 2, [3.1, 2.9, 2.7, 2.4, 2.3, 2.2], true),
  ] },
  { code: 'PUR', name: { vi: 'Mua hàng', en: 'Purchasing', ko: '구매' }, owner: 'Hoàng Thị E', kpis: [
    k('pur-save', 'Tiết kiệm chi phí mua', 'Purchase cost savings', '구매 원가 절감', '%', 40, 3, [1.8, 2.1, 2.4, 2.6, 3.1, 3.4]),
    k('pur-ontime', 'Nhà cung cấp giao đúng hạn', 'Supplier on-time delivery', '공급사 납기 준수', '%', 40, 95, [89, 91, 92, 93, 94, 93]),
    k('pur-lead', 'Thời gian xử lý PO', 'PO processing time', 'PO 처리시간', 'day', 20, 2, [3.2, 3.0, 2.8, 2.5, 2.3, 2.1], true),
  ] },
  { code: 'HR', name: { vi: 'Nhân sự', en: 'Human resources', ko: '인사' }, owner: 'Đỗ Thị F', kpis: [
    k('hr-turn', 'Tỷ lệ nghỉ việc tháng', 'Monthly turnover', '월 이직률', '%', 40, 3, [4.8, 4.5, 4.1, 3.8, 3.4, 3.1], true),
    k('hr-fill', 'Tuyển đủ người đúng hạn', 'Positions filled on time', '채용 적기 충원', '%', 30, 90, [72, 78, 80, 84, 88, 91]),
    k('hr-att', 'Tỷ lệ đi làm đủ', 'Attendance rate', '출근율', '%', 30, 96, [94.5, 95, 95.4, 95.8, 96.2, 96.4]),
  ] },
  { code: 'PPC', name: { vi: 'Kế hoạch', en: 'Planning', ko: '생산계획' }, owner: 'Vũ Văn G', kpis: [
    k('ppc-plan', 'Tuân thủ kế hoạch sản xuất', 'Production plan adherence', '생산계획 준수율', '%', 50, 95, [86, 88, 90, 91, 92, 90]),
    k('ppc-fc', 'Độ chính xác dự báo', 'Forecast accuracy', '예측 정확도', '%', 50, 85, [74, 76, 78, 80, 79, 81]),
  ] },
  { code: 'EHS', name: { vi: 'An toàn - Môi trường', en: 'EHS', ko: '안전·환경' }, owner: 'Bùi Văn H', kpis: [
    k('ehs-acc', 'Số vụ tai nạn lao động', 'Lost-time accidents', '산업재해 건수', 'case', 50, 0, [1, 0, 1, 0, 0, 0], true),
    k('ehs-train', 'Huấn luyện an toàn đủ người', 'Safety training coverage', '안전교육 이수율', '%', 30, 100, [92, 95, 96, 98, 100, 100]),
    k('ehs-insp', 'Kiểm tra an toàn đã thực hiện', 'Safety inspections done', '안전점검 실시율', '%', 20, 100, [90, 92, 95, 95, 98, 97]),
  ] },
]

/** % đạt của một chỉ tiêu mẫu (tối đa 120%), theo quy tắc chung ở kpiCalc.ts. */
export function achievement(it: KpiItem, actual: number): number {
  return calcAchieve('number', !!it.lowerIsBetter, it.target, actual) ?? 0
}

export { STATUS_COLOR, statusOf, type KpiStatus } from './kpiCalc'

/** Điểm KPI của phòng ban ở tháng thứ m (0-5) = trung bình có trọng số của % đạt (mỗi chỉ tiêu tối đa 120%). */
export function deptScore(d: KpiDept, m: number): number {
  const w = d.kpis.reduce((s, i) => s + i.weight, 0) || 1
  return Math.round(d.kpis.reduce((s, i) => s + achievement(i, i.actual[m]) * i.weight, 0) / w * 10) / 10
}

export const pick = (l: L3, lang: string) => (lang.startsWith('ko') ? l.ko : lang.startsWith('en') ? l.en : l.vi)
export const fmtVal = (v: number, unit: string) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit === '%' ? '%' : ' ' + unit}`
