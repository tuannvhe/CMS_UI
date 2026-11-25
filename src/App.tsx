import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { COMMUNITY_UI, PERSON_PAY_UI } from './config/features'
import { Spin } from 'antd'
import { useAuth } from './auth/AuthContext'
import { ComingSoon } from './components/ComingSoon'
import { ALL_PAGES, useCurrentNav } from './config/navigation'
import AppShell from './layout/AppShell'
import HomePage from './pages/HomePage'
import HnHomePage from './pages/HnHomePage'
import HnProfilePage from './pages/hn/HnProfilePage'
import HnTimeworkPage from './pages/hn/HnTimeworkPage'
import HnTimeworkSheetPage from './pages/hn/HnTimeworkSheetPage'
import HnPayslipPage from './pages/hn/HnPayslipPage'
import HnUploadPage from './pages/hn/HnUploadPage'
import HnFingerAllPage from './pages/hn/HnFingerAllPage'
import HnEmployeesPage from './pages/hn/HnEmployeesPage'
import HnFingerPage from './pages/hn/HnFingerPage'
import HnRequestsPage from './pages/hn/HnRequestsPage'
import HnOtGroupsPage from './pages/hn/HnOtGroupsPage'
import { HN_MODULE } from './config/hnModules'
import logoMark from './assets/logo1.png'
import CommunityPage from './pages/feed/CommunityPage'
import { ThreadPage, TopicPage } from './pages/feed/ThreadPages'
import FeedModerationPage from './pages/feed/FeedModerationPage'
import NotificationSettingsPage from './pages/system/NotificationSettingsPage'
import MailTemplatesPage from './pages/system/MailTemplatesPage'
import ApprovalsPage from './pages/approvals/ApprovalsPage'
import LeavePage from './pages/leave/LeavePage'
import AttendancePage from './pages/AttendancePage'
import ClosedAttendancePage from './pages/attendance/ClosedAttendancePage'
import ClosedImportPage from './pages/attendance/ClosedImportPage'
import AnnualLeavePage from './pages/leave/AnnualLeavePage'
import AnnualLeaveReportPage from './pages/leave/AnnualLeaveReportPage'
import FactoryAttendancePage from './pages/FactoryAttendancePage'
import EvaluationPage from './pages/evaluation/EvaluationPage'
import ApprovalLinePage from './pages/lines/ApprovalLinePage'
import EvaluatorLinePage from './pages/lines/EvaluatorLinePage'
import LineCleanupPage from './pages/lines/LineCleanupPage'
import DataRecoveryPage from './pages/system/DataRecoveryPage'
import AccessPage from './pages/system/AccessPage'
import HrRecipientsPage from './pages/lines/HrRecipientsPage'
import ExerciseSeasonsPage from './pages/evaluation/ExerciseSeasonsPage'
import HolidaysPage from './pages/other/HolidaysPage'
import MealRegisterPage from './pages/meals/MealRegisterPage'
import SwapDaysPage from './pages/other/SwapDaysPage'
import WorkSpecialPage from './pages/other/WorkSpecialPage'
import EvaluationHrPage from './pages/evaluation/EvaluationHrPage'
import RecruitPage from './pages/recruit/RecruitPage'
import RecruitMyPage from './pages/recruit/RecruitMyPage'
import OjtMyPage from './pages/ojt/OjtMyPage'
import OjtTeamPage from './pages/ojt/OjtTeamPage'
import OjtManagePage from './pages/ojt/OjtManagePage'
import RecruitInterviewsPage from './pages/recruit/RecruitInterviewsPage'
import RecruitDashboardPage from './pages/recruit/RecruitDashboardPage'
import RecruitNewHiresPage from './pages/recruit/RecruitNewHiresPage'
import MeetingRoomsPage from './pages/meeting/MeetingRoomsPage'
import MeetingRoomsAdminPage from './pages/meeting/MeetingRoomsAdminPage'
import EvaluationAuditPage from './pages/evaluation/EvaluationAuditPage'
import EvaluationRegisterPage from './pages/evaluation/EvaluationRegisterPage'
import LoginPage from './pages/LoginPage'
import FingerRequestsPage from './pages/requests/FingerRequestsPage'
import OvertimeRequestsPage from './pages/requests/OvertimeRequestsPage'
import DeleteApprovedPage from './pages/requests/DeleteApprovedPage'
import ShortRequestsPage from './pages/requests/ShortRequestsPage'
import RequestStatsPage from './pages/requests/RequestStatsPage'
import SecurityGatePage from './pages/security/SecurityGatePage'
import SecurityLatePage from './pages/security/SecurityLatePage'
import PermissionsPage from './pages/system/PermissionsPage'
import UsersPage from './pages/system/UsersPage'
import UnionAnnouncementsPage from './pages/system/UnionAnnouncementsPage'
import EhsAnnouncementsPage from './pages/system/EhsAnnouncementsPage'
import OccasionsPage from './pages/system/OccasionsPage'
import BirthdayMessagePage from './pages/system/BirthdayMessagePage'
import OrgStructurePage from './pages/org/OrgStructurePage'
import AnnouncementsPage from './pages/system/AnnouncementsPage'
import AuditPage from './pages/system/AuditPage'
import TransfersPage from './pages/org/TransfersPage'
import ComplaintsPage from './pages/attendance/ComplaintsPage'
import PayslipPage from './pages/payslip/PayslipPage'
import YearReviewPage from './pages/yearReview/YearReviewPage'
import MonthReviewPage from './pages/yearReview/MonthReviewPage'
import QaPage from './pages/qa/QaPage'
import QaManagePage from './pages/qa/QaManagePage'
import PayslipImportPage from './pages/payslip/PayslipImportPage'
import PayrollPage from './pages/payroll/PayrollPage'
import PayrollConfigPage from './pages/payroll/PayrollConfigPage'
import PayrollRetroPage from './pages/payroll/PayrollRetroPage'
import RequestWindowsPage from './pages/payroll/RequestWindowsPage'
import OtOpPositionsPage from './pages/payroll/OtOpPositionsPage'
import AttendanceScopesPage from './pages/system/AttendanceScopesPage'
import DataTranslationsPage from './pages/system/DataTranslationsPage'
import PayrollPeoplePage from './pages/payroll/PayrollPeoplePage'
import ClosingAutoPage from './pages/payroll/ClosingAutoPage'
import ComplaintsManagePage from './pages/attendance/ComplaintsManagePage'
import DelegationPage from './pages/requests/DelegationPage'
import ApprovalBacklogPage from './pages/requests/ApprovalBacklogPage'
import OvertimeOverlapPage from './pages/requests/OvertimeOverlapPage'
import DataHealthPage from './pages/org/DataHealthPage'
import HrDashboardPage from './pages/org/HrDashboardPage'
import HyOrdersPage from './pages/trips/HyOrdersPage'
import IdCardsPage from './pages/org/IdCardsPage'
import AdminUnitsPage from './pages/org/AdminUnitsPage'
import BusinessTripsPage from './pages/trips/BusinessTripsPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import EmployeeImportPage from './pages/system/EmployeeImportPage'
import ErpLinkPage from './pages/system/ErpLinkPage'
import AccountReclaimPage from './pages/system/AccountReclaimPage'
import CustomsDeclarationsPage from './pages/customs/CustomsDeclarationsPage'
import CustomsReconcilePage from './pages/customs/CustomsReconcilePage'
import OrgTreePage from './pages/system/OrgTreePage'
import OrgHrPage from './pages/system/OrgHrPage'
import OrgLinePage from './pages/system/OrgLinePage'
import { AccountPage, AppearancePage } from './pages/SettingsPages'
import KpiOverviewPage from './pages/kpi/KpiOverviewPage'
import KpiDepartmentPage from './pages/kpi/KpiDepartmentPage'
import KpiLinesPage from './pages/kpi/KpiLinesPage'
import KpiPeoplePage from './pages/kpi/KpiPeoplePage'
import KpiTargetsPage from './pages/kpi/KpiTargetsPage'
import KpiReportPage from './pages/kpi/KpiReportPage'
import KpiEntryPage from './pages/kpi/KpiEntryPage'
import KpiSetupPage from './pages/kpi/KpiSetupPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <div className="splash"><img src={logoMark} alt="VINATech" /><Spin size="large" /></div>
  if (!user) return <Navigate to="/login" replace />
  // Hai cơ sở tách đường dẫn: người HN chỉ ở /hn/... (đường dẫn VINA -> /hn), người VINA không vào /hn/... (-> /)
  const inHn = pathname === '/hn' || pathname.startsWith('/hn/')
  if (user.site === 'HN' && !inHn) return <Navigate to="/hn" replace />
  if (user.site !== 'HN' && inHn) return <Navigate to="/" replace />
  return children
}

/** Màn của cơ sở HN: chỉ người HN; có module thì phải có quyền xem module đó (chưa tải xong quyền thì chờ; không có quyền thì về trang chủ HN). */
function RequireHn({ module, children }: { module?: string; children: JSX.Element }) {
  const { user } = useAuth()
  if (!user || user.site !== 'HN') return <Navigate to="/" replace />
  if (!module) return children
  if (user.hnModules === undefined) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  return user.hnModules.includes(module) ? children : <Navigate to="/hn" replace />
}

/** Trang quản trị: quản trị luôn vào được; nhóm khác chỉ vào được khi quản trị đã cấp riêng trang này (màn Phân quyền menu). */
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  const { page } = useCurrentNav()
  const poster = page.key === 'announcements' && !!user?.announcementPoster   // người được thêm riêng vào danh sách đăng thông báo hệ thống
  // Quyền trang chưa tải xong (tải lại trang đang mở): chờ, không đẩy người được cấp riêng về trang chủ
  if (user && !user.isAdmin && user.grantedPages === undefined) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  return user?.isAdmin || user?.grantedPages?.includes(page.key) || poster ? children : <Navigate to="/attendance" replace />
}

function RequireUnion({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user?.unionPoster || user?.isAdmin ? children : <Navigate to="/attendance" replace />
}

function RequireEhs({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user?.ehsPoster || user?.isAdmin ? children : <Navigate to="/attendance" replace />
}

/** Trang Cộng đồng: chỉ người máy chủ cho phép (theo bộ phận). Quyền chưa tải xong thì chờ, không đẩy về trang chủ. */
function RequireCommunity({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (user && user.hiddenPages === undefined) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  return user?.community ? children : <Navigate to="/" replace />
}

/**
 * Màn thường theo quyền nhóm / người (Phân quyền menu): trang bị tắt thì không vào được kể cả gõ thẳng đường dẫn, chuyển về trang chủ
 * (không về /attendance vì chính trang chấm công cũng có thể bị tắt). Quyền chưa tải xong thì chờ.
 */
function RequireStaff({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  const { page } = useCurrentNav()
  if (user && user.hiddenPages === undefined) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  return user && !user.hiddenPages?.includes(page.key) ? children : <Navigate to="/" replace />
}

function RequireSecurity({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user?.isSecurity || user?.isAdmin ? children : <Navigate to="/attendance" replace />
}

// Các trang đã làm xong; mọi trang còn lại trong config/navigation.tsx tự dùng trang "Sắp ra mắt".
const IMPLEMENTED = new Set([
  '/kpi',
  '/kpi/departments',
  '/kpi/lines',
  '/kpi/people',
  '/kpi/targets',
  '/kpi/report',
  '/kpi/entry',
  '/kpi/setup',
  '/org',
  '/system/announcements',
  '/system/occasions',
  '/system/birthday-message',
  '/settings/union-announcements',
  '/settings/ehs-announcements',
  '/system/audit',
  '/system/data',
  '/system/access',
  '/customs/declarations',
  '/customs/reconcile',
  '/org/transfers',
  '/org/health',
  '/org/dashboard',
  '/trips/hy-orders',
  '/org/id-cards',
  '/org/admin-units',
  '/trips/business',
  '/attendance/complaints',
  '/payslip',
  '/payroll',
  '/payroll/config',
  '/payroll/retro',
  '/attendance/request-windows',
  '/attendance/ot-op-positions',
  '/payroll/retro/approve',
  '/payroll/people',
  '/attendance/closing-auto',
  '/qa',
  '/qa/manage',
  '/payslip/import',
  '/attendance/complaints/manage',
  '/approvals/delegation',
  '/requests/backlog',
  '/requests/ot-overlaps',
  '/settings/security',
  '/leave/annual',
  '/leave/annual-report',
  '/system/users',
  '/system/account-reclaim',
  '/system/employee-import',
  '/attendance/closed',
  '/attendance/closing',
  '/attendance',
  '/attendance/factory',
  '/attendance/scoped',
  '/leave',
  '/approvals/finger',
  '/approvals/overtime',
  '/approvals/leave',
  '/approvals/goout',
  '/approvals/late',
  '/approvals/early',
  '/evaluation',
  '/lines/approval',
  '/lines/evaluator',
  '/lines/cleanup',
  '/other/swap-days',
  '/other/work-special',
  '/other/holidays',
  '/meals/register',
  '/exercise/seasons',
  '/lines/hr-recipients',
  '/evaluation/hr',
  '/recruit',
  '/recruit/my',
  '/recruit/interviews',
  '/recruit/dashboard',
  '/recruit/new-hires',
  '/ojt/my',
  '/ojt/team',
  '/ojt/manage',
  '/meeting-rooms',
  '/meeting-rooms/manage',
  '/evaluation/audit',
  '/evaluation/register',
  '/go-out',
  '/late-forms',
  '/early-forms',
  '/system/permissions',
  '/security/gate',
  '/security/late',
  '/requests/stats',
  '/requests/delete',
  '/finger-forms',
  '/overtime',
  '/settings/account',
  '/settings/appearance',
])

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<HomePage />} />
        {COMMUNITY_UI ? (
          <>
            <Route path="feed" element={<RequireCommunity><CommunityPage /></RequireCommunity>} />
            <Route path="feed/topic/:id" element={<RequireCommunity><TopicPage /></RequireCommunity>} />
            <Route path="feed/post/:id" element={<RequireCommunity><ThreadPage /></RequireCommunity>} />
            <Route path="feed/moderation" element={<RequireCommunity><RequireAdmin><FeedModerationPage /></RequireAdmin></RequireCommunity>} />
          </>
        ) : <Route path="feed/*" element={<Navigate to="/" replace />} />}
        <Route path="attendance" element={<RequireStaff><AttendancePage /></RequireStaff>} />
        <Route path="attendance/factory" element={<RequireAdmin><FactoryAttendancePage /></RequireAdmin>} />
        <Route path="attendance/scoped" element={<RequireAdmin><FactoryAttendancePage scoped /></RequireAdmin>} />
        <Route path="attendance/closed" element={<RequireStaff><ClosedAttendancePage /></RequireStaff>} />
        <Route path="attendance/closing" element={<RequireAdmin><ClosedImportPage /></RequireAdmin>} />
        <Route path="leave" element={<RequireStaff><LeavePage /></RequireStaff>} />
        <Route path="leave/annual" element={<RequireStaff><AnnualLeavePage /></RequireStaff>} />
        <Route path="leave/annual-report" element={<RequireAdmin><AnnualLeaveReportPage /></RequireAdmin>} />
        <Route path="approvals" element={<Navigate to="/approvals/finger" replace />} />
        <Route path="approvals/finger" element={<RequireStaff><ApprovalsPage kind="finger" /></RequireStaff>} />
        <Route path="approvals/overtime" element={<RequireStaff><ApprovalsPage kind="overtime" /></RequireStaff>} />
        <Route path="approvals/leave" element={<RequireStaff><ApprovalsPage kind="leave" /></RequireStaff>} />
        <Route path="approvals/goout" element={<RequireStaff><ApprovalsPage kind="goout" /></RequireStaff>} />
        <Route path="approvals/late" element={<RequireStaff><ApprovalsPage kind="late" /></RequireStaff>} />
        <Route path="approvals/early" element={<RequireStaff><ApprovalsPage kind="early" /></RequireStaff>} />
        <Route path="evaluation" element={<RequireStaff><EvaluationPage /></RequireStaff>} />
        <Route path="lines/approval" element={<RequireAdmin><ApprovalLinePage /></RequireAdmin>} />
        <Route path="lines/evaluator" element={<RequireAdmin><EvaluatorLinePage /></RequireAdmin>} />
        <Route path="lines/cleanup" element={<RequireAdmin><LineCleanupPage /></RequireAdmin>} />
        <Route path="org" element={<RequireAdmin><OrgStructurePage /></RequireAdmin>} />
        <Route path="approvals/delegation" element={<RequireStaff><DelegationPage /></RequireStaff>} />
        <Route path="requests/backlog" element={<RequireAdmin><ApprovalBacklogPage /></RequireAdmin>} />
        <Route path="requests/ot-overlaps" element={<RequireAdmin><OvertimeOverlapPage /></RequireAdmin>} />
        <Route path="qa" element={<RequireStaff><QaPage /></RequireStaff>} />
        <Route path="qa/manage" element={<RequireAdmin><QaManagePage /></RequireAdmin>} />
        <Route path="payslip" element={<RequireStaff><PayslipPage /></RequireStaff>} />
        <Route path="payslip/import" element={<RequireAdmin><PayslipImportPage /></RequireAdmin>} />
        <Route path="payroll" element={<RequireAdmin><PayrollPage /></RequireAdmin>} />
        <Route path="payroll/config" element={<RequireAdmin><PayrollConfigPage /></RequireAdmin>} />
        <Route path="attendance/request-windows" element={<RequireAdmin><RequestWindowsPage /></RequireAdmin>} />
        <Route path="attendance/ot-op-positions" element={<RequireAdmin><OtOpPositionsPage /></RequireAdmin>} />
        <Route path="payroll/retro" element={<RequireAdmin><PayrollRetroPage /></RequireAdmin>} />
        <Route path="payroll/retro/approve" element={<RequireAdmin><PayrollRetroPage mode="approve" /></RequireAdmin>} />
        <Route path="payroll/people" element={PERSON_PAY_UI ? <RequireAdmin><PayrollPeoplePage /></RequireAdmin> : <Navigate to="/payroll" replace />} />
        <Route path="attendance/closing-auto" element={<RequireAdmin><ClosingAutoPage /></RequireAdmin>} />
        <Route path="attendance/complaints" element={<RequireStaff><ComplaintsPage /></RequireStaff>} />
        <Route path="attendance/complaints/manage" element={<RequireAdmin><ComplaintsManagePage /></RequireAdmin>} />
        <Route path="trips/hy-orders" element={<RequireStaff><HyOrdersPage /></RequireStaff>} />
        <Route path="org/id-cards" element={<RequireAdmin><IdCardsPage /></RequireAdmin>} />
        <Route path="org/admin-units" element={<RequireAdmin><AdminUnitsPage /></RequireAdmin>} />
        <Route path="trips/business" element={<RequireStaff><BusinessTripsPage /></RequireStaff>} />
        <Route path="org/health" element={<RequireAdmin><DataHealthPage /></RequireAdmin>} />
        <Route path="org/dashboard" element={<RequireAdmin><HrDashboardPage /></RequireAdmin>} />
        <Route path="org/transfers" element={<RequireAdmin><TransfersPage /></RequireAdmin>} />
        <Route path="system/attendance-scopes" element={<RequireAdmin><AttendanceScopesPage /></RequireAdmin>} />
        <Route path="system/mail-templates" element={<RequireAdmin><MailTemplatesPage /></RequireAdmin>} />
        <Route path="system/translations" element={<RequireAdmin><DataTranslationsPage /></RequireAdmin>} />
        <Route path="system/notifications" element={<RequireAdmin><NotificationSettingsPage /></RequireAdmin>} />
        <Route path="system/audit" element={<RequireAdmin><AuditPage /></RequireAdmin>} />
        <Route path="system/data" element={<RequireAdmin><DataRecoveryPage /></RequireAdmin>} />
        <Route path="system/access" element={<RequireAdmin><AccessPage /></RequireAdmin>} />
        <Route path="system/announcements" element={<RequireAdmin><AnnouncementsPage /></RequireAdmin>} />
        <Route path="system/occasions" element={<RequireAdmin><OccasionsPage /></RequireAdmin>} />
        <Route path="system/birthday-message" element={<RequireAdmin><BirthdayMessagePage /></RequireAdmin>} />
        <Route path="lines/coverage" element={<Navigate to="/org" replace />} />
        <Route path="other/swap-days" element={<RequireAdmin><SwapDaysPage /></RequireAdmin>} />
        <Route path="other/work-special" element={<RequireAdmin><WorkSpecialPage /></RequireAdmin>} />
        <Route path="other/holidays" element={<RequireAdmin><HolidaysPage /></RequireAdmin>} />
        <Route path="kpi" element={<RequireStaff><KpiOverviewPage /></RequireStaff>} />
        <Route path="kpi/departments" element={<RequireStaff><KpiDepartmentPage /></RequireStaff>} />
        <Route path="kpi/lines" element={<RequireStaff><KpiLinesPage /></RequireStaff>} />
        <Route path="kpi/people" element={<RequireStaff><KpiPeoplePage /></RequireStaff>} />
        <Route path="kpi/targets" element={<RequireStaff><KpiTargetsPage /></RequireStaff>} />
        <Route path="kpi/report" element={<RequireStaff><KpiReportPage /></RequireStaff>} />
        <Route path="kpi/entry" element={<RequireStaff><KpiEntryPage /></RequireStaff>} />
        <Route path="kpi/setup" element={<RequireAdmin><KpiSetupPage /></RequireAdmin>} />
        <Route path="meals/register" element={<RequireStaff><MealRegisterPage /></RequireStaff>} />
        <Route path="exercise/seasons" element={<RequireAdmin><ExerciseSeasonsPage /></RequireAdmin>} />
        <Route path="lines/hr-recipients" element={<RequireAdmin><HrRecipientsPage /></RequireAdmin>} />
        <Route path="evaluation/hr" element={<RequireAdmin><EvaluationHrPage /></RequireAdmin>} />
        <Route path="recruit" element={<RequireAdmin><RecruitPage /></RequireAdmin>} />
        <Route path="recruit/my" element={<RequireStaff><RecruitMyPage /></RequireStaff>} />
        <Route path="recruit/interviews" element={<RequireStaff><RecruitInterviewsPage /></RequireStaff>} />
        <Route path="recruit/dashboard" element={<RequireAdmin><RecruitDashboardPage /></RequireAdmin>} />
        <Route path="recruit/new-hires" element={<RequireAdmin><RecruitNewHiresPage /></RequireAdmin>} />
        <Route path="ojt/my" element={<RequireStaff><OjtMyPage /></RequireStaff>} />
        <Route path="ojt/team" element={<RequireStaff><OjtTeamPage /></RequireStaff>} />
        <Route path="ojt/manage" element={<RequireAdmin><OjtManagePage /></RequireAdmin>} />
        <Route path="meeting-rooms" element={<RequireStaff><MeetingRoomsPage /></RequireStaff>} />
        <Route path="meeting-rooms/manage" element={<RequireAdmin><MeetingRoomsAdminPage /></RequireAdmin>} />
        <Route path="evaluation/report" element={<Navigate to="/evaluation/hr?tab=done" replace />} />
        <Route path="evaluation/audit" element={<RequireAdmin><EvaluationAuditPage /></RequireAdmin>} />
        <Route path="evaluation/register" element={<RequireAdmin><EvaluationRegisterPage /></RequireAdmin>} />
        <Route path="go-out" element={<RequireStaff><ShortRequestsPage kind="goout" /></RequireStaff>} />
        <Route path="late-forms" element={<RequireStaff><ShortRequestsPage kind="late" /></RequireStaff>} />
        <Route path="early-forms" element={<RequireStaff><ShortRequestsPage kind="early" /></RequireStaff>} />
        <Route path="system/permissions" element={<RequireAdmin><PermissionsPage /></RequireAdmin>} />
        <Route path="system/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
        <Route path="system/departments" element={<Navigate to="/org" replace />} />
        <Route path="system/data-cleanup" element={<Navigate to="/org" replace />} />
        <Route path="settings/security" element={<ChangePasswordPage />} />
        <Route path="year-review" element={<YearReviewPage />} />
        <Route path="my-month" element={<MonthReviewPage />} />
        <Route path="system/employee-import" element={<RequireAdmin><EmployeeImportPage /></RequireAdmin>} />
        <Route path="system/org-tree" element={<RequireAdmin><OrgTreePage /></RequireAdmin>} />
        <Route path="system/org-hr" element={<RequireAdmin><OrgHrPage /></RequireAdmin>} />
        <Route path="system/org-lines" element={<RequireAdmin><OrgLinePage /></RequireAdmin>} />
        <Route path="system/erp-link" element={<RequireAdmin><ErpLinkPage /></RequireAdmin>} />
        <Route path="system/account-reclaim" element={<RequireAdmin><AccountReclaimPage /></RequireAdmin>} />
        <Route path="customs/declarations" element={<RequireAdmin><CustomsDeclarationsPage /></RequireAdmin>} />
        <Route path="customs/reconcile" element={<RequireAdmin><CustomsReconcilePage /></RequireAdmin>} />
        <Route path="security/gate" element={<RequireSecurity><SecurityGatePage /></RequireSecurity>} />
        <Route path="security/late" element={<RequireSecurity><SecurityLatePage /></RequireSecurity>} />
        <Route path="requests/stats" element={<RequireAdmin><RequestStatsPage /></RequireAdmin>} />
        <Route path="requests/delete" element={<RequireAdmin><DeleteApprovedPage /></RequireAdmin>} />
        <Route path="finger-forms" element={<RequireStaff><FingerRequestsPage /></RequireStaff>} />
        <Route path="overtime" element={<RequireStaff><OvertimeRequestsPage /></RequireStaff>} />
        <Route path="settings/account" element={<AccountPage />} />
        <Route path="settings/union-announcements" element={<RequireUnion><UnionAnnouncementsPage /></RequireUnion>} />
        <Route path="settings/ehs-announcements" element={<RequireEhs><EhsAnnouncementsPage /></RequireEhs>} />
        <Route path="settings/appearance" element={<AppearancePage />} />
        <Route path="hn" element={<RequireHn><HnHomePage /></RequireHn>} />
        <Route path="hn/profile" element={<RequireHn module={HN_MODULE.profile}><HnProfilePage /></RequireHn>} />
        <Route path="hn/timework" element={<RequireHn module={HN_MODULE.timework}><HnTimeworkPage /></RequireHn>} />
        <Route path="hn/timework/:period" element={<RequireHn module={HN_MODULE.timework}><HnTimeworkSheetPage /></RequireHn>} />
        <Route path="hn/finger" element={<RequireHn module={HN_MODULE.finger}><HnFingerPage /></RequireHn>} />
        <Route path="hn/payslip" element={<RequireHn module={HN_MODULE.payslip}><HnPayslipPage /></RequireHn>} />
        {/* 2026-11-25 [Truong] - HN HR tools (module rights of CMS_HN: only "Nhân sự") */}
        <Route path="hn/admin/upload-timework" element={<RequireHn module={HN_MODULE.uploadTimework}><HnUploadPage kind="timework" /></RequireHn>} />
        <Route path="hn/admin/upload-payslip" element={<RequireHn module={HN_MODULE.uploadPayslip}><HnUploadPage kind="payslip" /></RequireHn>} />
        <Route path="hn/admin/finger-all" element={<RequireHn module={HN_MODULE.fingerAll}><HnFingerAllPage /></RequireHn>} />
        <Route path="hn/admin/employees" element={<RequireHn module={HN_MODULE.employees}><HnEmployeesPage /></RequireHn>} />
        <Route path="hn/overtime/mine" element={<RequireHn module={HN_MODULE.otMine}><HnRequestsPage kind="overtime" mode="mine" /></RequireHn>} />
        <Route path="hn/overtime/approvals" element={<RequireHn module={HN_MODULE.otApprove}><HnOtGroupsPage /></RequireHn>} />
        <Route path="hn/overtime/summary" element={<RequireHn module={HN_MODULE.otSummary}><HnRequestsPage kind="overtime" mode="summary" /></RequireHn>} />
        <Route path="hn/leave/mine" element={<RequireHn module={HN_MODULE.leaveMine}><HnRequestsPage kind="leave" mode="mine" /></RequireHn>} />
        <Route path="hn/leave/approvals" element={<RequireHn module={HN_MODULE.leaveApprove}><HnRequestsPage kind="leave" mode="approvals" /></RequireHn>} />
        <Route path="hn/leave/summary" element={<RequireHn module={HN_MODULE.leaveSummary}><HnRequestsPage kind="leave" mode="summary" /></RequireHn>} />
        <Route path="hn/finger-register/mine" element={<RequireHn module={HN_MODULE.fingerRegMine}><HnRequestsPage kind="finger-register" mode="mine" /></RequireHn>} />
        <Route path="hn/finger-register/approvals" element={<RequireHn module={HN_MODULE.fingerRegApprove}><HnRequestsPage kind="finger-register" mode="approvals" /></RequireHn>} />
        <Route path="hn/late-early/mine" element={<RequireHn module={HN_MODULE.lateEarlyMine}><HnRequestsPage kind="late-early" mode="mine" /></RequireHn>} />
        <Route path="hn/late-early/approvals" element={<RequireHn module={HN_MODULE.lateEarlyApprove}><HnRequestsPage kind="late-early" mode="approvals" /></RequireHn>} />
        <Route path="hn/*" element={<Navigate to="/hn" replace />} />
        {ALL_PAGES.filter((p) => !IMPLEMENTED.has(p.path)).map((p) => (
          <Route key={p.key} path={p.path.slice(1)} element={<ComingSoon />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
