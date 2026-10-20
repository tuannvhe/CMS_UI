import type { ReactNode } from 'react'
import { PERSON_PAY_UI } from './features'
import { useLocation } from 'react-router-dom'
import {
  AuditOutlined, ClockCircleOutlined, CheckSquareOutlined, FieldTimeOutlined, FileTextOutlined, HomeOutlined,
  SafetyCertificateOutlined, TeamOutlined, EditOutlined, ScheduleOutlined, SettingOutlined, SkinOutlined, UserOutlined, DashboardOutlined, FormOutlined, ApartmentOutlined, BellOutlined, MailOutlined, SolutionOutlined, ThunderboltOutlined, AppstoreOutlined, CalendarOutlined, RetweetOutlined, DeleteOutlined, LogoutOutlined, RollbackOutlined, BarChartOutlined, KeyOutlined, IdcardOutlined, FileDoneOutlined, UploadOutlined, NotificationOutlined, CustomerServiceOutlined, WalletOutlined, MessageOutlined, UserSwitchOutlined, HourglassOutlined, SwapOutlined, CarryOutOutlined, FundOutlined, MedicineBoxOutlined, CarOutlined, CalculatorOutlined, LockOutlined, RobotOutlined, BlockOutlined, CompassOutlined, ClearOutlined, DatabaseOutlined, LineChartOutlined, GiftOutlined } from '@ant-design/icons'

/**
 * Cấu hình điều hướng duy nhất của ứng dụng.
 * Thêm một trang/phân hệ mới = thêm 1 dòng ở đây (+ khoá dịch trong i18n); menu, breadcrumb, tìm kiếm (Ctrl+K)
 * và route placeholder đều tự cập nhật.
 */
export interface NavPage {
  key: string
  path: string
  labelKey: string
  descKey: string
  icon: ReactNode
  /** Chỉ hiện và cho vào với tài khoản quản trị */
  adminOnly?: boolean
  /** Chỉ hiện và cho vào với bảo vệ (quản trị cũng vào được) */
  securityOnly?: boolean
  /** Chỉ hiện với người được cho phép đăng thông báo công đoàn (quản trị đã có màn Thông báo riêng) */
  unionOnly?: boolean
}

export interface Workspace {
  key: string
  labelKey: string
  subKey: string
  icon: ReactNode
  /** Trang mặc định khi bấm icon trên left rail */
  home: string
  pages: NavPage[]
}

export const WORKSPACES: Workspace[] = [
  {
    key: 'home', labelKey: 'ws.home', subKey: 'ws.homeSub', icon: <HomeOutlined />, home: '/',
    pages: [
      { key: 'overview', path: '/', labelKey: 'nav.overview', descKey: 'nav.overviewDesc', icon: <DashboardOutlined /> },
      { key: 'feed', path: '/feed', labelKey: 'nav.feed', descKey: 'nav.feedDesc', icon: <NotificationOutlined /> },
      { key: 'feedModeration', path: '/feed/moderation', labelKey: 'nav.feedModeration', descKey: 'nav.feedModerationDesc', icon: <SafetyCertificateOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'attendance', labelKey: 'ws.attendance', subKey: 'ws.attendanceSub', icon: <ClockCircleOutlined />, home: '/attendance',
    pages: [
      { key: 'attendance', path: '/attendance', labelKey: 'nav.attendance', descKey: 'nav.attendanceDesc', icon: <ClockCircleOutlined /> },
      { key: 'factoryAttendance', path: '/attendance/factory', labelKey: 'nav.factoryAttendance', descKey: 'nav.factoryAttendanceDesc', icon: <TeamOutlined />, adminOnly: true },
      { key: 'complaints', path: '/attendance/complaints', labelKey: 'nav.complaints', descKey: 'nav.complaintsDesc', icon: <MessageOutlined /> },
      { key: 'complaintsManage', path: '/attendance/complaints/manage', labelKey: 'nav.complaintsManage', descKey: 'nav.complaintsManageDesc', icon: <MessageOutlined />, adminOnly: true },
      { key: 'qa', path: '/qa', labelKey: 'nav.qa', descKey: 'nav.qaDesc', icon: <MessageOutlined /> },
      { key: 'qaManage', path: '/qa/manage', labelKey: 'nav.qaManage', descKey: 'nav.qaManageDesc', icon: <CustomerServiceOutlined />, adminOnly: true },
      { key: 'annualLeave', path: '/leave/annual', labelKey: 'nav.annualLeave', descKey: 'nav.annualLeaveDesc', icon: <CarryOutOutlined /> },
      { key: 'annualReport', path: '/leave/annual-report', labelKey: 'nav.annualReport', descKey: 'nav.annualReportDesc', icon: <FundOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'payroll', labelKey: 'ws.payroll', subKey: 'ws.payrollSub', icon: <WalletOutlined />, home: '/attendance/closed',
    pages: [
      { key: 'closedAttendance', path: '/attendance/closed', labelKey: 'nav.closedAttendance', descKey: 'nav.closedAttendanceDesc', icon: <FileDoneOutlined /> },
      { key: 'closingAuto', path: '/attendance/closing-auto', labelKey: 'nav.closingAuto', descKey: 'nav.closingAutoDesc', icon: <RobotOutlined />, adminOnly: true },
      { key: 'closingImport', path: '/attendance/closing', labelKey: 'nav.closingImport', descKey: 'nav.closingImportDesc', icon: <UploadOutlined />, adminOnly: true },
      { key: 'payslip', path: '/payslip', labelKey: 'nav.payslip', descKey: 'nav.payslipDesc', icon: <WalletOutlined /> },
      { key: 'payslipImport', path: '/payslip/import', labelKey: 'nav.payslipImport', descKey: 'nav.payslipImportDesc', icon: <WalletOutlined />, adminOnly: true },
      { key: 'payroll', path: '/payroll', labelKey: 'nav.payroll', descKey: 'nav.payrollDesc', icon: <CalculatorOutlined />, adminOnly: true },
      ...(PERSON_PAY_UI ? [{ key: 'payrollPeople', path: '/payroll/people', labelKey: 'nav.payrollPeople', descKey: 'nav.payrollPeopleDesc', icon: <LockOutlined />, adminOnly: true }] : []),
      { key: 'payrollConfig', path: '/payroll/config', labelKey: 'nav.payrollConfig', descKey: 'nav.payrollConfigDesc', icon: <SettingOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'forms', labelKey: 'ws.forms', subKey: 'ws.formsSub', icon: <FormOutlined />, home: '/overtime',
    pages: [
      { key: 'overtime', path: '/overtime', labelKey: 'nav.overtime', descKey: 'nav.overtimeDesc', icon: <FieldTimeOutlined /> },
      { key: 'leave', path: '/leave', labelKey: 'nav.leave', descKey: 'nav.leaveDesc', icon: <ScheduleOutlined /> },
      { key: 'fingerForm', path: '/finger-forms', labelKey: 'nav.fingerForm', descKey: 'nav.fingerFormDesc', icon: <EditOutlined /> },
      { key: 'goOut', path: '/go-out', labelKey: 'nav.goOut', descKey: 'nav.goOutDesc', icon: <LogoutOutlined /> },
      { key: 'lateForm', path: '/late-forms', labelKey: 'nav.lateForm', descKey: 'nav.lateFormDesc', icon: <ClockCircleOutlined /> },
      { key: 'earlyForm', path: '/early-forms', labelKey: 'nav.earlyForm', descKey: 'nav.earlyFormDesc', icon: <RollbackOutlined /> },
      { key: 'hungYenTrips', path: '/trips/hung-yen', labelKey: 'nav.hungYenTrips', descKey: 'nav.hungYenTripsDesc', icon: <CarOutlined /> },
      { key: 'businessTrips', path: '/trips/business', labelKey: 'nav.businessTrips', descKey: 'nav.businessTripsDesc', icon: <CompassOutlined /> },
    ],
  },
  {
    key: 'requests', labelKey: 'ws.requests', subKey: 'ws.requestsSub', icon: <FileTextOutlined />, home: '/approvals/finger',
    pages: [
      { key: 'approvalFinger', path: '/approvals/finger', labelKey: 'nav.approvalFinger', descKey: 'nav.approvalFingerDesc', icon: <CheckSquareOutlined /> },
      { key: 'approvalOvertime', path: '/approvals/overtime', labelKey: 'nav.approvalOvertime', descKey: 'nav.approvalOvertimeDesc', icon: <FieldTimeOutlined /> },
      { key: 'approvalLeave', path: '/approvals/leave', labelKey: 'nav.approvalLeave', descKey: 'nav.approvalLeaveDesc', icon: <ScheduleOutlined /> },
      { key: 'approvalGoOut', path: '/approvals/goout', labelKey: 'nav.approvalGoOut', descKey: 'nav.approvalGoOutDesc', icon: <LogoutOutlined /> },
      { key: 'approvalLate', path: '/approvals/late', labelKey: 'nav.approvalLate', descKey: 'nav.approvalLateDesc', icon: <ClockCircleOutlined /> },
      { key: 'approvalEarly', path: '/approvals/early', labelKey: 'nav.approvalEarly', descKey: 'nav.approvalEarlyDesc', icon: <RollbackOutlined /> },
      { key: 'delegation', path: '/approvals/delegation', labelKey: 'nav.delegation', descKey: 'nav.delegationDesc', icon: <UserSwitchOutlined /> },
      { key: 'backlog', path: '/requests/backlog', labelKey: 'nav.backlog', descKey: 'nav.backlogDesc', icon: <HourglassOutlined />, adminOnly: true },
      { key: 'otOverlaps', path: '/requests/ot-overlaps', labelKey: 'nav.otOverlaps', descKey: 'nav.otOverlapsDesc', icon: <BlockOutlined />, adminOnly: true },
      { key: 'requestStats', path: '/requests/stats', labelKey: 'nav.requestStats', descKey: 'nav.requestStatsDesc', icon: <BarChartOutlined />, adminOnly: true },
      { key: 'deleteApproved', path: '/requests/delete', labelKey: 'nav.deleteApproved', descKey: 'nav.deleteApprovedDesc', icon: <DeleteOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'evaluation', labelKey: 'ws.evaluation', subKey: 'ws.evaluationSub', icon: <AuditOutlined />, home: '/evaluation',
    pages: [
      { key: 'evaluation', path: '/evaluation', labelKey: 'nav.evaluation', descKey: 'nav.evaluationDesc', icon: <AuditOutlined /> },
      { key: 'evaluationRegister', path: '/evaluation/register', labelKey: 'nav.evaluationRegister', descKey: 'nav.evaluationRegisterDesc', icon: <FormOutlined />, adminOnly: true },
      { key: 'evaluationHr', path: '/evaluation/hr', labelKey: 'nav.evaluationHr', descKey: 'nav.evaluationHrDesc', icon: <SolutionOutlined />, adminOnly: true },
      { key: 'evaluationAudit', path: '/evaluation/audit', labelKey: 'nav.evaluationAudit', descKey: 'nav.evaluationAuditDesc', icon: <SafetyCertificateOutlined />, adminOnly: true },
      { key: 'hrRecipients', path: '/lines/hr-recipients', labelKey: 'nav.hrRecipients', descKey: 'nav.hrRecipientsDesc', icon: <BellOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'recruit', labelKey: 'ws.recruit', subKey: 'ws.recruitSub', icon: <SolutionOutlined />, home: '/recruit/my',
    pages: [
      { key: 'recruitMy', path: '/recruit/my', labelKey: 'nav.recruitMy', descKey: 'nav.recruitMyDesc', icon: <AuditOutlined /> },
      { key: 'recruitManage', path: '/recruit', labelKey: 'nav.recruit', descKey: 'nav.recruitDesc', icon: <SolutionOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'org', labelKey: 'ws.org', subKey: 'ws.orgSub', icon: <ApartmentOutlined />, home: '/org',
    pages: [
      { key: 'orgStructure', path: '/org', labelKey: 'nav.orgStructure', descKey: 'nav.orgStructureDesc', icon: <ApartmentOutlined />, adminOnly: true },
      { key: 'dataHealth', path: '/org/health', labelKey: 'nav.dataHealth', descKey: 'nav.dataHealthDesc', icon: <MedicineBoxOutlined />, adminOnly: true },
      { key: 'transfers', path: '/org/transfers', labelKey: 'nav.transfers', descKey: 'nav.transfersDesc', icon: <SwapOutlined />, adminOnly: true },
      { key: 'approvalLine', path: '/lines/approval', labelKey: 'nav.approvalLine', descKey: 'nav.approvalLineDesc', icon: <CheckSquareOutlined />, adminOnly: true },
      { key: 'evaluatorLine', path: '/lines/evaluator', labelKey: 'nav.evaluatorLine', descKey: 'nav.evaluatorLineDesc', icon: <TeamOutlined />, adminOnly: true },
      { key: 'lineCleanup', path: '/lines/cleanup', labelKey: 'nav.lineCleanup', descKey: 'nav.lineCleanupDesc', icon: <ClearOutlined />, adminOnly: true },
      { key: 'employeeImport', path: '/system/employee-import', labelKey: 'nav.employeeImport', descKey: 'nav.employeeImportDesc', icon: <UploadOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'security', labelKey: 'ws.security', subKey: 'ws.securitySub', icon: <SafetyCertificateOutlined />, home: '/security/gate',
    pages: [
      { key: 'securityGate', path: '/security/gate', labelKey: 'nav.securityGate', descKey: 'nav.securityGateDesc', icon: <SafetyCertificateOutlined />, securityOnly: true },
      { key: 'securityLate', path: '/security/late', labelKey: 'nav.securityLate', descKey: 'nav.securityLateDesc', icon: <ClockCircleOutlined />, securityOnly: true },
    ],
  },
  {
    key: 'system', labelKey: 'ws.system', subKey: 'ws.systemSub', icon: <KeyOutlined />, home: '/system/permissions',
    pages: [
      { key: 'permissions', path: '/system/permissions', labelKey: 'nav.permissions', descKey: 'nav.permissionsDesc', icon: <KeyOutlined />, adminOnly: true },
      { key: 'announcements', path: '/system/announcements', labelKey: 'nav.announcements', descKey: 'nav.announcementsDesc', icon: <NotificationOutlined />, adminOnly: true },
      { key: 'notificationSettings', path: '/system/notifications', labelKey: 'nav.notificationSettings', descKey: 'nav.notificationSettingsDesc', icon: <BellOutlined />, adminOnly: true },
      { key: 'mailTemplates', path: '/system/mail-templates', labelKey: 'nav.mailTemplates', descKey: 'nav.mailTemplatesDesc', icon: <MailOutlined />, adminOnly: true },
      { key: 'dataRecovery', path: '/system/data', labelKey: 'nav.dataRecovery', descKey: 'nav.dataRecoveryDesc', icon: <DatabaseOutlined />, adminOnly: true },
      { key: 'access', path: '/system/access', labelKey: 'nav.access', descKey: 'nav.accessDesc', icon: <LineChartOutlined />, adminOnly: true },
      { key: 'audit', path: '/system/audit', labelKey: 'nav.audit', descKey: 'nav.auditDesc', icon: <AuditOutlined />, adminOnly: true },
      { key: 'birthdayMessage', path: '/system/birthday-message', labelKey: 'nav.birthdayMessage', descKey: 'nav.birthdayMessageDesc', icon: <GiftOutlined />, adminOnly: true },
      { key: 'occasions', path: '/system/occasions', labelKey: 'nav.occasions', descKey: 'nav.occasionsDesc', icon: <CalendarOutlined />, adminOnly: true },
      { key: 'users', path: '/system/users', labelKey: 'nav.users', descKey: 'nav.usersDesc', icon: <IdcardOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'other', labelKey: 'ws.other', subKey: 'ws.otherSub', icon: <AppstoreOutlined />, home: '/other/holidays',
    pages: [
      { key: 'holidays', path: '/other/holidays', labelKey: 'nav.holidays', descKey: 'nav.holidaysDesc', icon: <CalendarOutlined />, adminOnly: true },
      { key: 'swapDays', path: '/other/swap-days', labelKey: 'nav.swapDays', descKey: 'nav.swapDaysDesc', icon: <RetweetOutlined />, adminOnly: true },
      { key: 'exerciseSeasons', path: '/exercise/seasons', labelKey: 'nav.exerciseSeasons', descKey: 'nav.exerciseSeasonsDesc', icon: <ThunderboltOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'settings', labelKey: 'ws.settings', subKey: 'ws.settingsSub', icon: <SettingOutlined />, home: '/settings/account',
    pages: [
      { key: 'account', path: '/settings/account', labelKey: 'nav.account', descKey: 'nav.accountDesc', icon: <UserOutlined /> },
      { key: 'appearance', path: '/settings/appearance', labelKey: 'nav.appearance', descKey: 'nav.appearanceDesc', icon: <SkinOutlined /> },
      { key: 'unionAnnouncements', path: '/settings/union-announcements', labelKey: 'nav.unionAnnouncements', descKey: 'nav.unionAnnouncementsDesc', icon: <NotificationOutlined />, unionOnly: true },
      { key: 'security', path: '/settings/security', labelKey: 'nav.security', descKey: 'nav.securityDesc', icon: <SafetyCertificateOutlined /> },
    ],
  },
]

export const ALL_PAGES: (NavPage & { workspace: Workspace })[] = WORKSPACES.flatMap((w) =>
  w.pages.map((p) => ({ ...p, workspace: w })),
)

function matchPage(pathname: string) {
  // Khớp chính xác trước, sau đó khớp tiền tố dài nhất (trừ '/')
  const exact = ALL_PAGES.find((p) => p.path === pathname)
  if (exact) return exact
  return [...ALL_PAGES].filter((p) => p.path !== '/' && pathname.startsWith(p.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]
}

/** Trang + workspace hiện tại theo URL (mặc định: Trang chủ). */
export function useCurrentNav() {
  const { pathname } = useLocation()
  const page = matchPage(pathname) ?? ALL_PAGES[0]
  return { page, workspace: page.workspace }
}

/** Trang người dùng hiện tại được phép thấy. */
type Viewer = { isAdmin?: boolean; isSecurity?: boolean; unionPoster?: boolean; hiddenPages?: string[]; grantedPages?: string[] } | null | undefined

/** Trang người dùng được phép thấy: trang quản trị chỉ cho quản trị; trang bảo vệ cho bảo vệ và quản trị. */
export const canSee = (p: { key?: string; adminOnly?: boolean; securityOnly?: boolean; unionOnly?: boolean }, user: Viewer) =>
  (!p.unionOnly || (!!user?.unionPoster && !user?.isAdmin)) && (!p.adminOnly || !!user?.isAdmin || !!(p.key && user?.grantedPages?.includes(p.key))) && (!p.securityOnly || !!user?.isAdmin || !!user?.isSecurity) && !(p.key && user?.hiddenPages?.includes(p.key))

/** Trang vào khi bấm một workspace: trang mặc định nếu người dùng được thấy, không thì trang đầu tiên họ được thấy (nhóm được cấp riêng một trang quản trị không vào được trang mặc định dành cho quản trị). */
export const homeOf = (w: Workspace, user: Viewer) =>
  w.pages.find((p) => p.path === w.home && canSee(p, user)) ? w.home : (w.pages.find((p) => canSee(p, user))?.path ?? w.home)
