import type { ReactNode } from 'react'
import { COMMUNITY_UI, PERSON_PAY_UI } from './features'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { HN_MODULE } from './hnModules'
import {
  AuditOutlined, ClockCircleOutlined, CheckSquareOutlined, FieldTimeOutlined, FileTextOutlined, HomeOutlined,
  SafetyCertificateOutlined, TeamOutlined, EditOutlined, ScheduleOutlined, SettingOutlined, SkinOutlined, UserOutlined, DashboardOutlined, FormOutlined, ApartmentOutlined, BellOutlined, MailOutlined, SolutionOutlined, ThunderboltOutlined, AppstoreOutlined, CalendarOutlined, RetweetOutlined, DeleteOutlined, LogoutOutlined, RollbackOutlined, BarChartOutlined, KeyOutlined, IdcardOutlined, FileDoneOutlined, UploadOutlined, NotificationOutlined, CustomerServiceOutlined, WalletOutlined, MessageOutlined, UserSwitchOutlined, HourglassOutlined, SwapOutlined, CarryOutOutlined, FundOutlined, MedicineBoxOutlined, CarOutlined, CalculatorOutlined, LockOutlined, RobotOutlined, BlockOutlined, CompassOutlined, ClearOutlined, DatabaseOutlined, LineChartOutlined, GiftOutlined, CoffeeOutlined, ReadOutlined, LaptopOutlined, EnvironmentOutlined, AimOutlined, ControlOutlined, TranslationOutlined, FileSearchOutlined, UserDeleteOutlined, DiffOutlined, EyeOutlined } from '@ant-design/icons'

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
  /** Chỉ hiện với người được cho phép đăng thông báo EHS (quản trị đã đăng EHS được ở màn Thông báo hệ thống) */
  ehsOnly?: boolean
  /** Chỉ hiện với người được dùng trang Cộng đồng (máy chủ quyết định theo bộ phận) */
  communityOnly?: boolean
  /** Quản trị không thấy mục này (đã có bản đầy đủ ở màn khác) */
  notAdmin?: boolean
  /** Trang của cơ sở Ninh Bình (Hà Nam): chỉ hiện khi quyền /api/hn/me có `view` đúng module này */
  hnModule?: string
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
      ...(COMMUNITY_UI ? [
        { key: 'feed', path: '/feed', labelKey: 'nav.feed', descKey: 'nav.feedDesc', icon: <NotificationOutlined />, communityOnly: true },
        { key: 'feedModeration', path: '/feed/moderation', labelKey: 'nav.feedModeration', descKey: 'nav.feedModerationDesc', icon: <SafetyCertificateOutlined />, adminOnly: true, communityOnly: true },
      ] : []),
    ],
  },
  {
    key: 'attendance', labelKey: 'ws.attendance', subKey: 'ws.attendanceSub', icon: <ClockCircleOutlined />, home: '/attendance',
    pages: [
      { key: 'attendance', path: '/attendance', labelKey: 'nav.attendance', descKey: 'nav.attendanceDesc', icon: <ClockCircleOutlined /> },
      { key: 'factoryAttendance', path: '/attendance/factory', labelKey: 'nav.factoryAttendance', descKey: 'nav.factoryAttendanceDesc', icon: <TeamOutlined />, adminOnly: true },
      { key: 'attendanceScoped', path: '/attendance/scoped', labelKey: 'nav.attendanceScoped', descKey: 'nav.attendanceScopedDesc', icon: <EyeOutlined />, adminOnly: true, notAdmin: true },
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
      { key: 'requestWindows', path: '/attendance/request-windows', labelKey: 'nav.requestWindows', descKey: 'nav.requestWindowsDesc', icon: <ControlOutlined />, adminOnly: true },
      { key: 'otOpPositions', path: '/attendance/ot-op-positions', labelKey: 'nav.otOpPositions', descKey: 'nav.otOpPositionsDesc', icon: <ThunderboltOutlined />, adminOnly: true },
      { key: 'closingAuto', path: '/attendance/closing-auto', labelKey: 'nav.closingAuto', descKey: 'nav.closingAutoDesc', icon: <RobotOutlined />, adminOnly: true },
      { key: 'closingImport', path: '/attendance/closing', labelKey: 'nav.closingImport', descKey: 'nav.closingImportDesc', icon: <UploadOutlined />, adminOnly: true },
      { key: 'payslip', path: '/payslip', labelKey: 'nav.payslip', descKey: 'nav.payslipDesc', icon: <WalletOutlined /> },
      { key: 'payslipImport', path: '/payslip/import', labelKey: 'nav.payslipImport', descKey: 'nav.payslipImportDesc', icon: <WalletOutlined />, adminOnly: true },
      { key: 'payroll', path: '/payroll', labelKey: 'nav.payroll', descKey: 'nav.payrollDesc', icon: <CalculatorOutlined />, adminOnly: true },
      ...(PERSON_PAY_UI ? [{ key: 'payrollPeople', path: '/payroll/people', labelKey: 'nav.payrollPeople', descKey: 'nav.payrollPeopleDesc', icon: <LockOutlined />, adminOnly: true }] : []),
      { key: 'payrollConfig', path: '/payroll/config', labelKey: 'nav.payrollConfig', descKey: 'nav.payrollConfigDesc', icon: <SettingOutlined />, adminOnly: true },
      { key: 'payrollRetro', path: '/payroll/retro', labelKey: 'nav.payrollRetro', descKey: 'nav.payrollRetroDesc', icon: <FieldTimeOutlined />, adminOnly: true },
      { key: 'payrollRetroApprove', path: '/payroll/retro/approve', labelKey: 'nav.payrollRetroApprove', descKey: 'nav.payrollRetroApproveDesc', icon: <AuditOutlined />, adminOnly: true },
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
      { key: 'hyOrders', path: '/trips/hy-orders', labelKey: 'nav.hyOrders', descKey: 'nav.hyOrdersDesc', icon: <CarOutlined /> },
      { key: 'mealRegister', path: '/meals/register', labelKey: 'nav.mealRegister', descKey: 'nav.mealRegisterDesc', icon: <CoffeeOutlined /> },
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
      { key: 'ojtMy', path: '/ojt/my', labelKey: 'nav.ojtMy', descKey: 'nav.ojtMyDesc', icon: <ReadOutlined /> },
      { key: 'ojtTeam', path: '/ojt/team', labelKey: 'nav.ojtTeam', descKey: 'nav.ojtTeamDesc', icon: <TeamOutlined /> },
      { key: 'ojtManage', path: '/ojt/manage', labelKey: 'nav.ojtManage', descKey: 'nav.ojtManageDesc', icon: <SolutionOutlined />, adminOnly: true },
      { key: 'hrRecipients', path: '/lines/hr-recipients', labelKey: 'nav.hrRecipients', descKey: 'nav.hrRecipientsDesc', icon: <BellOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'recruit', labelKey: 'ws.recruit', subKey: 'ws.recruitSub', icon: <SolutionOutlined />, home: '/recruit',
    // Cả nhóm Tuyển dụng chỉ hiện cho HR / quản trị, trừ 2 mục "của tôi": máy chủ (api/auth/access) cho vào grantedPages khi người đó đang có CV / phỏng vấn được giao.
    pages: [
      { key: 'recruitMy', path: '/recruit/my', labelKey: 'nav.recruitMy', descKey: 'nav.recruitMyDesc', icon: <AuditOutlined />, adminOnly: true },
      { key: 'recruitInterviews', path: '/recruit/interviews', labelKey: 'nav.recruitInterviews', descKey: 'nav.recruitInterviewsDesc', icon: <CalendarOutlined />, adminOnly: true },
      { key: 'recruitManage', path: '/recruit', labelKey: 'nav.recruit', descKey: 'nav.recruitDesc', icon: <SolutionOutlined />, adminOnly: true },
      { key: 'recruitDashboard', path: '/recruit/dashboard', labelKey: 'nav.recruitDashboard', descKey: 'nav.recruitDashboardDesc', icon: <FundOutlined />, adminOnly: true },
      // Bộ phận DX/EA (cấp trang ở Phân quyền): người sắp nhận việc để chuẩn bị thiết bị, tài khoản
      { key: 'recruitNewHires', path: '/recruit/new-hires', labelKey: 'nav.recruitNewHires', descKey: 'nav.recruitNewHiresDesc', icon: <LaptopOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'meeting', labelKey: 'ws.meeting', subKey: 'ws.meetingSub', icon: <CalendarOutlined />, home: '/meeting-rooms',
    pages: [
      { key: 'meetingRooms', path: '/meeting-rooms', labelKey: 'nav.meetingRooms', descKey: 'nav.meetingRoomsDesc', icon: <CalendarOutlined /> },
      { key: 'meetingRoomsManage', path: '/meeting-rooms/manage', labelKey: 'nav.meetingRoomsManage', descKey: 'nav.meetingRoomsManageDesc', icon: <SettingOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'org', labelKey: 'ws.org', subKey: 'ws.orgSub', icon: <ApartmentOutlined />, home: '/org',
    pages: [
      { key: 'hrDashboard', path: '/org/dashboard', labelKey: 'nav.hrDashboard', descKey: 'nav.hrDashboardDesc', icon: <DashboardOutlined />, adminOnly: true },
      { key: 'orgStructure', path: '/org', labelKey: 'nav.orgStructure', descKey: 'nav.orgStructureDesc', icon: <ApartmentOutlined />, adminOnly: true },
      { key: 'dataHealth', path: '/org/health', labelKey: 'nav.dataHealth', descKey: 'nav.dataHealthDesc', icon: <MedicineBoxOutlined />, adminOnly: true },
      { key: 'transfers', path: '/org/transfers', labelKey: 'nav.transfers', descKey: 'nav.transfersDesc', icon: <SwapOutlined />, adminOnly: true },
      { key: 'idCards', path: '/org/id-cards', labelKey: 'nav.idCards', descKey: 'nav.idCardsDesc', icon: <IdcardOutlined />, adminOnly: true },
      { key: 'adminUnits', path: '/org/admin-units', labelKey: 'nav.adminUnits', descKey: 'nav.adminUnitsDesc', icon: <EnvironmentOutlined />, adminOnly: true },
      { key: 'approvalLine', path: '/lines/approval', labelKey: 'nav.approvalLine', descKey: 'nav.approvalLineDesc', icon: <CheckSquareOutlined />, adminOnly: true },
      { key: 'evaluatorLine', path: '/lines/evaluator', labelKey: 'nav.evaluatorLine', descKey: 'nav.evaluatorLineDesc', icon: <TeamOutlined />, adminOnly: true },
      { key: 'lineCleanup', path: '/lines/cleanup', labelKey: 'nav.lineCleanup', descKey: 'nav.lineCleanupDesc', icon: <ClearOutlined />, adminOnly: true },
      { key: 'employeeImport', path: '/system/employee-import', labelKey: 'nav.employeeImport', descKey: 'nav.employeeImportDesc', icon: <UploadOutlined />, adminOnly: true },
      { key: 'orgTree', path: '/system/org-tree', labelKey: 'nav.orgTree', descKey: 'nav.orgTreeDesc', icon: <ApartmentOutlined />, adminOnly: true },
      { key: 'orgHr', path: '/system/org-hr', labelKey: 'nav.orgHr', descKey: 'nav.orgHrDesc', icon: <TeamOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'kpi', labelKey: 'ws.kpi', subKey: 'ws.kpiSub', icon: <AimOutlined />, home: '/kpi',
    pages: [
      { key: 'kpiOverview', path: '/kpi', labelKey: 'nav.kpiOverview', descKey: 'nav.kpiOverviewDesc', icon: <DashboardOutlined /> },
      { key: 'kpiDepartment', path: '/kpi/departments', labelKey: 'nav.kpiDepartment', descKey: 'nav.kpiDepartmentDesc', icon: <ApartmentOutlined /> },
      { key: 'kpiLines', path: '/kpi/lines', labelKey: 'nav.kpiLines', descKey: 'nav.kpiLinesDesc', icon: <BlockOutlined /> },
      { key: 'kpiPeople', path: '/kpi/people', labelKey: 'nav.kpiPeople', descKey: 'nav.kpiPeopleDesc', icon: <TeamOutlined /> },
      { key: 'kpiTargets', path: '/kpi/targets', labelKey: 'nav.kpiTargets', descKey: 'nav.kpiTargetsDesc', icon: <ControlOutlined /> },
      { key: 'kpiReport', path: '/kpi/report', labelKey: 'nav.kpiReport', descKey: 'nav.kpiReportDesc', icon: <LineChartOutlined /> },
      { key: 'kpiEntry', path: '/kpi/entry', labelKey: 'nav.kpiEntry', descKey: 'nav.kpiEntryDesc', icon: <FormOutlined /> },
      { key: 'kpiAdmin', path: '/kpi/setup', labelKey: 'nav.kpiAdmin', descKey: 'nav.kpiAdminDesc', icon: <SettingOutlined />, adminOnly: true },
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
    // Logistic: đọc tờ khai từ phần mềm ECUS (chỉ đọc). Trang quản trị cấp được cho nhóm / từng người ở Phân quyền menu.
    key: 'customs', labelKey: 'ws.customs', subKey: 'ws.customsSub', icon: <FileSearchOutlined />, home: '/customs/declarations',
    pages: [
      { key: 'customsDeclarations', path: '/customs/declarations', labelKey: 'nav.customsDeclarations', descKey: 'nav.customsDeclarationsDesc', icon: <FileSearchOutlined />, adminOnly: true },
      { key: 'customsReconcile', path: '/customs/reconcile', labelKey: 'nav.customsReconcile', descKey: 'nav.customsReconcileDesc', icon: <DiffOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'system', labelKey: 'ws.system', subKey: 'ws.systemSub', icon: <KeyOutlined />, home: '/system/permissions',
    pages: [
      { key: 'permissions', path: '/system/permissions', labelKey: 'nav.permissions', descKey: 'nav.permissionsDesc', icon: <KeyOutlined />, adminOnly: true },
      { key: 'announcements', path: '/system/announcements', labelKey: 'nav.announcements', descKey: 'nav.announcementsDesc', icon: <NotificationOutlined />, adminOnly: true },
      { key: 'notificationSettings', path: '/system/notifications', labelKey: 'nav.notificationSettings', descKey: 'nav.notificationSettingsDesc', icon: <BellOutlined />, adminOnly: true },
      { key: 'attendanceScopes', path: '/system/attendance-scopes', labelKey: 'nav.attendanceScopes', descKey: 'nav.attendanceScopesDesc', icon: <EyeOutlined />, adminOnly: true },
      { key: 'mailTemplates', path: '/system/mail-templates', labelKey: 'nav.mailTemplates', descKey: 'nav.mailTemplatesDesc', icon: <MailOutlined />, adminOnly: true },
      { key: 'dataTranslations', path: '/system/translations', labelKey: 'nav.dataTranslations', descKey: 'nav.dataTranslationsDesc', icon: <TranslationOutlined />, adminOnly: true },
      { key: 'dataRecovery', path: '/system/data', labelKey: 'nav.dataRecovery', descKey: 'nav.dataRecoveryDesc', icon: <DatabaseOutlined />, adminOnly: true },
      { key: 'access', path: '/system/access', labelKey: 'nav.access', descKey: 'nav.accessDesc', icon: <LineChartOutlined />, adminOnly: true },
      { key: 'audit', path: '/system/audit', labelKey: 'nav.audit', descKey: 'nav.auditDesc', icon: <AuditOutlined />, adminOnly: true },
      { key: 'birthdayMessage', path: '/system/birthday-message', labelKey: 'nav.birthdayMessage', descKey: 'nav.birthdayMessageDesc', icon: <GiftOutlined />, adminOnly: true },
      { key: 'occasions', path: '/system/occasions', labelKey: 'nav.occasions', descKey: 'nav.occasionsDesc', icon: <CalendarOutlined />, adminOnly: true },
      { key: 'users', path: '/system/users', labelKey: 'nav.users', descKey: 'nav.usersDesc', icon: <IdcardOutlined />, adminOnly: true },
      { key: 'accountReclaim', path: '/system/account-reclaim', labelKey: 'nav.accountReclaim', descKey: 'nav.accountReclaimDesc', icon: <UserDeleteOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'other', labelKey: 'ws.other', subKey: 'ws.otherSub', icon: <AppstoreOutlined />, home: '/other/holidays',
    pages: [
      { key: 'holidays', path: '/other/holidays', labelKey: 'nav.holidays', descKey: 'nav.holidaysDesc', icon: <CalendarOutlined />, adminOnly: true },
      { key: 'swapDays', path: '/other/swap-days', labelKey: 'nav.swapDays', descKey: 'nav.swapDaysDesc', icon: <RetweetOutlined />, adminOnly: true },
      { key: 'workSpecial', path: '/other/work-special', labelKey: 'nav.workSpecial', descKey: 'nav.workSpecialDesc', icon: <TeamOutlined />, adminOnly: true },
      { key: 'exerciseSeasons', path: '/exercise/seasons', labelKey: 'nav.exerciseSeasons', descKey: 'nav.exerciseSeasonsDesc', icon: <ThunderboltOutlined />, adminOnly: true },
    ],
  },
  {
    key: 'settings', labelKey: 'ws.settings', subKey: 'ws.settingsSub', icon: <SettingOutlined />, home: '/settings/account',
    pages: [
      { key: 'account', path: '/settings/account', labelKey: 'nav.account', descKey: 'nav.accountDesc', icon: <UserOutlined /> },
      { key: 'appearance', path: '/settings/appearance', labelKey: 'nav.appearance', descKey: 'nav.appearanceDesc', icon: <SkinOutlined /> },
      { key: 'unionAnnouncements', path: '/settings/union-announcements', labelKey: 'nav.unionAnnouncements', descKey: 'nav.unionAnnouncementsDesc', icon: <NotificationOutlined />, unionOnly: true },
      { key: 'ehsAnnouncements', path: '/settings/ehs-announcements', labelKey: 'nav.ehsAnnouncements', descKey: 'nav.ehsAnnouncementsDesc', icon: <NotificationOutlined />, ehsOnly: true },
      { key: 'security', path: '/settings/security', labelKey: 'nav.security', descKey: 'nav.securityDesc', icon: <SafetyCertificateOutlined /> },
    ],
  },
]

/** Menu của cơ sở Ninh Bình (Hà Nam): route dưới /hn. Mục chỉ hiện khi người dùng có quyền xem module tương ứng (trang chủ luôn hiện). */
export const HN_WORKSPACES: Workspace[] = [
  {
    key: 'hnHome', labelKey: 'hn.ws.home', subKey: 'hn.ws.homeSub', icon: <HomeOutlined />, home: '/hn',
    pages: [
      { key: 'hnHome', path: '/hn', labelKey: 'hn.nav.home', descKey: 'hn.nav.homeDesc', icon: <DashboardOutlined /> },
      { key: 'hnProfile', path: '/hn/profile', labelKey: 'hn.nav.profile', descKey: 'hn.nav.profileDesc', icon: <IdcardOutlined />, hnModule: HN_MODULE.profile },
    ],
  },
  {
    key: 'hnWork', labelKey: 'hn.ws.work', subKey: 'hn.ws.workSub', icon: <ClockCircleOutlined />, home: '/hn/timework',
    pages: [
      { key: 'hnTimework', path: '/hn/timework', labelKey: 'hn.nav.timework', descKey: 'hn.nav.timeworkDesc', icon: <FileDoneOutlined />, hnModule: HN_MODULE.timework },
      { key: 'hnFinger', path: '/hn/finger', labelKey: 'hn.nav.finger', descKey: 'hn.nav.fingerDesc', icon: <ClockCircleOutlined />, hnModule: HN_MODULE.finger },
      { key: 'hnPayslip', path: '/hn/payslip', labelKey: 'hn.nav.payslip', descKey: 'hn.nav.payslipDesc', icon: <WalletOutlined />, hnModule: HN_MODULE.payslip },
    ],
  },
  {
    key: 'hnRequests', labelKey: 'hn.ws.requests', subKey: 'hn.ws.requestsSub', icon: <FormOutlined />, home: '/hn/overtime/mine',
    pages: [
      { key: 'hnOtMine', path: '/hn/overtime/mine', labelKey: 'hn.nav.otMine', descKey: 'hn.nav.otMineDesc', icon: <FieldTimeOutlined />, hnModule: HN_MODULE.otMine },
      { key: 'hnOtApprove', path: '/hn/overtime/approvals', labelKey: 'hn.nav.otApprove', descKey: 'hn.nav.otApproveDesc', icon: <CheckSquareOutlined />, hnModule: HN_MODULE.otApprove },
      { key: 'hnOtSummary', path: '/hn/overtime/summary', labelKey: 'hn.nav.otSummary', descKey: 'hn.nav.otSummaryDesc', icon: <ScheduleOutlined />, hnModule: HN_MODULE.otSummary },
      { key: 'hnLeaveMine', path: '/hn/leave/mine', labelKey: 'hn.nav.leaveMine', descKey: 'hn.nav.leaveMineDesc', icon: <CalendarOutlined />, hnModule: HN_MODULE.leaveMine },
      { key: 'hnLeaveApprove', path: '/hn/leave/approvals', labelKey: 'hn.nav.leaveApprove', descKey: 'hn.nav.leaveApproveDesc', icon: <CheckSquareOutlined />, hnModule: HN_MODULE.leaveApprove },
      { key: 'hnLeaveSummary', path: '/hn/leave/summary', labelKey: 'hn.nav.leaveSummary', descKey: 'hn.nav.leaveSummaryDesc', icon: <AuditOutlined />, hnModule: HN_MODULE.leaveSummary },
      { key: 'hnFingerRegMine', path: '/hn/finger-register/mine', labelKey: 'hn.nav.fingerRegMine', descKey: 'hn.nav.fingerRegMineDesc', icon: <FormOutlined />, hnModule: HN_MODULE.fingerRegMine },
      { key: 'hnFingerRegApprove', path: '/hn/finger-register/approvals', labelKey: 'hn.nav.fingerRegApprove', descKey: 'hn.nav.fingerRegApproveDesc', icon: <CheckSquareOutlined />, hnModule: HN_MODULE.fingerRegApprove },
      { key: 'hnLateEarlyMine', path: '/hn/late-early/mine', labelKey: 'hn.nav.lateEarlyMine', descKey: 'hn.nav.lateEarlyMineDesc', icon: <SolutionOutlined />, hnModule: HN_MODULE.lateEarlyMine },
      { key: 'hnLateEarlyApprove', path: '/hn/late-early/approvals', labelKey: 'hn.nav.lateEarlyApprove', descKey: 'hn.nav.lateEarlyApproveDesc', icon: <FileTextOutlined />, hnModule: HN_MODULE.lateEarlyApprove },
    ],
  },
]

export const ALL_PAGES: (NavPage & { workspace: Workspace })[] = WORKSPACES.flatMap((w) =>
  w.pages.map((p) => ({ ...p, workspace: w })),
)
export const HN_ALL_PAGES: (NavPage & { workspace: Workspace })[] = HN_WORKSPACES.flatMap((w) =>
  w.pages.map((p) => ({ ...p, workspace: w })),
)

/** Danh sách phân hệ / trang theo cơ sở của người đăng nhập. */
export const isHnUser = (user: { site?: string } | null | undefined) => user?.site === 'HN'
export const workspacesOf = (user: { site?: string } | null | undefined) => (isHnUser(user) ? HN_WORKSPACES : WORKSPACES)
export const allPagesOf = (user: { site?: string } | null | undefined) => (isHnUser(user) ? HN_ALL_PAGES : ALL_PAGES)
/** Trang chủ của cơ sở. */
export const siteHome = (user: { site?: string } | null | undefined) => (isHnUser(user) ? '/hn' : '/')

function matchPage(pathname: string, list: (NavPage & { workspace: Workspace })[]) {
  // Khớp chính xác trước, sau đó khớp tiền tố dài nhất (trừ '/')
  const exact = list.find((p) => p.path === pathname)
  if (exact) return exact
  return [...list].filter((p) => p.path !== '/' && pathname.startsWith(p.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]
}

/** Trang + workspace hiện tại theo URL (mặc định: Trang chủ của cơ sở). */
export function useCurrentNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const list = allPagesOf(user)
  const page = matchPage(pathname, list) ?? list[0]
  return { page, workspace: page.workspace }
}

/** Trang người dùng hiện tại được phép thấy. */
type Viewer = { isAdmin?: boolean; isSecurity?: boolean; unionPoster?: boolean; announcementPoster?: boolean; ehsPoster?: boolean; community?: boolean; hiddenPages?: string[]; grantedPages?: string[]; hnModules?: string[] } | null | undefined

/** Trang người dùng được phép thấy: trang quản trị chỉ cho quản trị; trang bảo vệ cho bảo vệ và quản trị. */
export const canSee = (p: { key?: string; adminOnly?: boolean; securityOnly?: boolean; unionOnly?: boolean; ehsOnly?: boolean; communityOnly?: boolean; notAdmin?: boolean; hnModule?: string }, user: Viewer) =>
  (!p.notAdmin || !user?.isAdmin) && (!p.hnModule || !!user?.hnModules?.includes(p.hnModule)) && (!p.communityOnly || !!user?.community) && (!p.unionOnly || (!!user?.unionPoster && !user?.isAdmin)) && (!p.ehsOnly || (!!user?.ehsPoster && !user?.isAdmin)) && (!p.adminOnly || !!user?.isAdmin || !!(p.key && user?.grantedPages?.includes(p.key)) || (p.key === 'announcements' && !!user?.announcementPoster)) && (!p.securityOnly || !!user?.isAdmin || !!user?.isSecurity) && !(p.key && user?.hiddenPages?.includes(p.key))

/** Trang vào khi bấm một workspace: trang mặc định nếu người dùng được thấy, không thì trang đầu tiên họ được thấy (nhóm được cấp riêng một trang quản trị không vào được trang mặc định dành cho quản trị). */
export const homeOf = (w: Workspace, user: Viewer) =>
  w.pages.find((p) => p.path === w.home && canSee(p, user)) ? w.home : (w.pages.find((p) => canSee(p, user))?.path ?? w.home)
