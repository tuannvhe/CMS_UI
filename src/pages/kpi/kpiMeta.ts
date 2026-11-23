import type { L3 } from './kpiDemoData'

/** Thông tin mô tả chi tiết của từng chỉ tiêu KPI (dữ liệu MẪU, đang trong quá trình xây dựng). */
export type Cat = 'Q' | 'D' | 'C' | 'S' | 'P'
export type Freq = 'daily' | 'weekly' | 'monthly'
export interface KpiMeta { cat: Cat; freq: Freq; formula: L3; source: L3 }

export const CATS: Record<Cat, { color: string; name: L3 }> = {
  Q: { color: '#0F6B3E', name: { vi: 'Chất lượng', en: 'Quality', ko: '품질' } },
  D: { color: '#2F7DD1', name: { vi: 'Giao hàng', en: 'Delivery', ko: '납기' } },
  C: { color: '#E0A526', name: { vi: 'Chi phí', en: 'Cost', ko: '원가' } },
  S: { color: '#D92D20', name: { vi: 'An toàn', en: 'Safety', ko: '안전' } },
  P: { color: '#7A4FC2', name: { vi: 'Con người', en: 'People', ko: '인력' } },
}

const m = (cat: Cat, freq: Freq, fv: string, fe: string, fk: string, sv: string, se: string, sk: string): KpiMeta =>
  ({ cat, freq, formula: { vi: fv, en: fe, ko: fk }, source: { vi: sv, en: se, ko: sk } })

const META: Record<string, KpiMeta> = {
  'prod-out': m('D', 'daily', 'Sản lượng thực tế / Sản lượng kế hoạch × 100', 'Actual output / planned output × 100', '실제 생산량 / 계획 생산량 × 100', 'Báo cáo sản lượng cuối ca (MES)', 'End-of-shift output report (MES)', '교대 종료 생산 보고(MES)'),
  'prod-oee': m('Q', 'daily', 'Tỷ lệ sẵn sàng × Hiệu suất × Chất lượng', 'Availability × Performance × Quality', '가동률 × 성능 × 품질', 'Dữ liệu máy và báo cáo dừng máy', 'Machine data and downtime reports', '설비 데이터 및 정지 보고'),
  'prod-ot': m('C', 'monthly', 'Tổng giờ tăng ca / số người trong tháng', 'Total overtime hours / headcount in the month', '월 총 연장근무 / 인원수', 'Chấm công và đơn tăng ca đã duyệt', 'Attendance and approved overtime forms', '근태 및 승인된 연장근무 신청'),
  'prod-ontime': m('D', 'weekly', 'Số lô giao đúng hạn / Tổng số lô giao × 100', 'On-time lots / total lots shipped × 100', '납기 내 로트 / 전체 출하 로트 × 100', 'Phiếu giao hàng', 'Delivery notes', '출하 전표'),
  'qc-defect': m('Q', 'daily', 'Số sản phẩm lỗi / Tổng sản phẩm kiểm × 100', 'Defective units / inspected units × 100', '불량 수 / 검사 수 × 100', 'Phiếu kiểm tra cuối chuyền', 'End-of-line inspection sheets', '라인 말단 검사표'),
  'qc-claim': m('Q', 'monthly', 'Đếm khiếu nại khách hàng có xác nhận trong tháng', 'Count of confirmed customer complaints in the month', '월간 확인된 고객 클레임 수', 'Hệ thống quản lý khiếu nại', 'Complaint management system', '클레임 관리 시스템'),
  'qc-fpy': m('Q', 'daily', 'Số đạt ngay lần đầu / Tổng sản xuất × 100', 'First-pass good units / total produced × 100', '직행 양품 수 / 총 생산 × 100', 'Báo cáo kiểm tra và sửa lại', 'Inspection and rework reports', '검사 및 재작업 보고'),
  'wh-acc': m('Q', 'monthly', '1 − (Số lượng lệch / Số lượng kiểm kê) × 100', '1 − (variance qty / counted qty) × 100', '1 − (차이 수량 / 실사 수량) × 100', 'Biên bản kiểm kê', 'Stock count records', '재고 실사 기록'),
  'wh-days': m('C', 'monthly', 'Giá trị tồn kho / Giá vốn bình quân ngày', 'Inventory value / average daily COGS', '재고 금액 / 일평균 매출원가', 'Sổ kho và kế toán', 'Warehouse ledger and accounting', '창고 원장 및 회계'),
  'wh-ship': m('D', 'daily', 'Số đơn xuất đúng hẹn / Tổng đơn xuất × 100', 'On-time shipments / total shipments × 100', '납기 내 출하 / 전체 출하 × 100', 'Lệnh xuất kho', 'Shipping orders', '출고 지시서'),
  'mt-down': m('D', 'daily', 'Tổng giờ máy dừng ngoài kế hoạch trong tháng', 'Total unplanned stop hours in the month', '월 비계획 정지시간 합계', 'Nhật ký dừng máy', 'Downtime log', '정지 기록'),
  'mt-pm': m('Q', 'monthly', 'Số lần bảo trì định kỳ đã làm / Kế hoạch × 100', 'PM done / PM planned × 100', '완료된 예방보전 / 계획 × 100', 'Kế hoạch bảo trì', 'Maintenance schedule', '보전 계획'),
  'mt-mttr': m('C', 'monthly', 'Tổng giờ sửa chữa / Số lần hỏng', 'Total repair hours / number of failures', '총 수리시간 / 고장 횟수', 'Phiếu sửa chữa', 'Repair work orders', '수리 작업 지시서'),
  'pur-save': m('C', 'monthly', '(Giá chuẩn − Giá mua thực tế) / Giá chuẩn × 100', '(Standard price − actual price) / standard price × 100', '(표준가 − 실구매가) / 표준가 × 100', 'Đơn mua hàng (PO)', 'Purchase orders', '구매 발주서'),
  'pur-ontime': m('D', 'weekly', 'Số lô nhà cung cấp giao đúng hạn / Tổng lô × 100', 'Supplier lots on time / total lots × 100', '공급사 납기 내 로트 / 전체 로트 × 100', 'Phiếu nhập kho', 'Goods receipts', '입고 전표'),
  'pur-lead': m('D', 'monthly', 'Trung bình số ngày từ yêu cầu đến phát hành PO', 'Average days from request to PO release', '요청부터 PO 발행까지 평균 일수', 'Hệ thống mua hàng', 'Purchasing system', '구매 시스템'),
  'hr-turn': m('P', 'monthly', 'Số người nghỉ trong tháng / Nhân sự bình quân × 100', 'Leavers in the month / average headcount × 100', '월 퇴사자 / 평균 인원 × 100', 'Dashboard nhân sự', 'HR dashboard', '인사 대시보드'),
  'hr-fill': m('P', 'monthly', 'Vị trí tuyển đủ đúng hạn / Tổng vị trí yêu cầu × 100', 'Positions filled on time / requested × 100', '기한 내 충원 / 요청 포지션 × 100', 'Màn tuyển dụng', 'Recruitment screens', '채용 화면'),
  'hr-att': m('P', 'daily', 'Số công thực tế / Số công phải đi × 100', 'Days worked / scheduled days × 100', '실제 근무일 / 소정 근무일 × 100', 'Chấm công vân tay', 'Fingerprint attendance', '지문 근태'),
  'ppc-plan': m('D', 'weekly', 'Số lệnh chạy đúng kế hoạch / Tổng lệnh × 100', 'Orders run as planned / total orders × 100', '계획대로 진행된 오더 / 전체 오더 × 100', 'Lệnh sản xuất', 'Production orders', '생산 오더'),
  'ppc-fc': m('D', 'monthly', '1 − |Dự báo − Thực tế| / Thực tế', '1 − |forecast − actual| / actual', '1 − |예측 − 실적| / 실적', 'Dự báo nhu cầu và đơn hàng', 'Demand forecast and orders', '수요 예측 및 주문'),
  'ehs-acc': m('S', 'monthly', 'Số vụ tai nạn có ngày nghỉ trong tháng', 'Lost-time accidents in the month', '월 휴업 재해 건수', 'Báo cáo tai nạn EHS', 'EHS accident reports', 'EHS 재해 보고'),
  'ehs-train': m('S', 'monthly', 'Số người đã huấn luyện / Số người phải huấn luyện × 100', 'Trained / required to train × 100', '교육 이수 / 대상자 × 100', 'Danh sách huấn luyện', 'Training rosters', '교육 명단'),
  'ehs-insp': m('S', 'weekly', 'Số lần kiểm tra đã làm / Kế hoạch × 100', 'Inspections done / planned × 100', '실시 점검 / 계획 × 100', 'Biên bản kiểm tra an toàn', 'Safety inspection records', '안전 점검 기록'),
}

/** Chỉ tiêu cá nhân / line (id dạng DEMO-xxx-out, L1-down…) dùng mô tả chung theo đuôi id. */
const GENERIC: Record<string, KpiMeta> = {
  out: m('D', 'daily', 'Sản lượng thực tế / Định mức giao × 100', 'Actual output / assigned standard × 100', '실제 생산량 / 배정 표준 × 100', 'Báo cáo sản lượng cuối ca', 'End-of-shift output report', '교대 종료 생산 보고'),
  def: m('Q', 'daily', 'Số sản phẩm lỗi / Tổng sản phẩm làm × 100', 'Defective units / units made × 100', '불량 수 / 생산 수 × 100', 'Phiếu kiểm tra cuối chuyền', 'End-of-line inspection sheets', '라인 말단 검사표'),
  att: m('P', 'daily', 'Số công thực tế / Số công phải đi × 100', 'Days worked / scheduled days × 100', '실제 근무일 / 소정 근무일 × 100', 'Chấm công vân tay', 'Fingerprint attendance', '지문 근태'),
  task: m('D', 'weekly', 'Việc hoàn thành đúng hạn / Việc được giao × 100', 'Tasks done on time / tasks assigned × 100', '기한 내 완료 업무 / 배정 업무 × 100', 'Bảng giao việc của quản lý', "Manager's task board", '관리자 업무 보드'),
  qual: m('Q', 'monthly', '1 − Việc bị trả lại / Việc đã nộp', '1 − tasks returned / tasks submitted', '1 − 반려 업무 / 제출 업무', 'Đánh giá của người duyệt', "Approver's review", '승인자 평가'),
  down: m('D', 'daily', 'Tổng giờ line dừng ngoài kế hoạch trong tháng', 'Total unplanned line stop hours in the month', '월 라인 비계획 정지시간 합계', 'Nhật ký dừng máy của line', 'Line downtime log', '라인 정지 기록'),
}

export function metaOf(id: string): KpiMeta {
  return META[id] ?? GENERIC[id.slice(id.lastIndexOf('-') + 1)] ?? GENERIC.task
}
export const FREQ_LABEL: Record<Freq, L3> = {
  daily: { vi: 'Hằng ngày', en: 'Daily', ko: '매일' },
  weekly: { vi: 'Hằng tuần', en: 'Weekly', ko: '매주' },
  monthly: { vi: 'Hằng tháng', en: 'Monthly', ko: '매월' },
}
