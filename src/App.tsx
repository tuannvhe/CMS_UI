import { Navigate, Route, Routes } from 'react-router-dom'
import { PERSON_PAY_UI } from './config/features'
import { Spin } from 'antd'
import { useAuth } from './auth/AuthContext'
import { ComingSoon } from './components/ComingSoon'
import { ALL_PAGES, useCurrentNav } from './config/navigation'
import AppShell from './layout/AppShell'
import HomePage from './pages/HomePage'
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
import SwapDaysPage from './pages/other/SwapDaysPage'
import EvaluationHrPage from './pages/evaluation/EvaluationHrPage'
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
import OccasionsPage from './pages/system/OccasionsPage'
import BirthdayMessagePage from './pages/system/BirthdayMessagePage'
import OrgStructurePage from './pages/org/OrgStructurePage'
import AnnouncementsPage from './pages/system/AnnouncementsPage'
import AuditPage from './pages/system/AuditPage'
import TransfersPage from './pages/org/TransfersPage'
import ComplaintsPage from './pages/attendance/ComplaintsPage'
import PayslipPage from './pages/payslip/PayslipPage'
import QaPage from './pages/qa/QaPage'
import QaManagePage from './pages/qa/QaManagePage'
import PayslipImportPage from './pages/payslip/PayslipImportPage'
import PayrollPage from './pages/payroll/PayrollPage'
import PayrollConfigPage from './pages/payroll/PayrollConfigPage'
import PayrollPeoplePage from './pages/payroll/PayrollPeoplePage'
import ClosingAutoPage from './pages/payroll/ClosingAutoPage'
import ComplaintsManagePage from './pages/attendance/ComplaintsManagePage'
import DelegationPage from './pages/requests/DelegationPage'
import ApprovalBacklogPage from './pages/requests/ApprovalBacklogPage'
import OvertimeOverlapPage from './pages/requests/OvertimeOverlapPage'
import DataHealthPage from './pages/org/DataHealthPage'
import HungYenPage from './pages/trips/HungYenPage'
import BusinessTripsPage from './pages/trips/BusinessTripsPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import EmployeeImportPage from './pages/system/EmployeeImportPage'
import { AccountPage, AppearancePage } from './pages/SettingsPages'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash"><img src={logoMark} alt="VINATech" /><Spin size="large" /></div>
  return user ? children : <Navigate to="/login" replace />
}

/** Trang quản trị: quản trị luôn vào được; nhóm khác chỉ vào được khi quản trị đã cấp riêng trang này (màn Phân quyền menu). */
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  const { page } = useCurrentNav()
  return user?.isAdmin || user?.grantedPages?.includes(page.key) ? children : <Navigate to="/attendance" replace />
}

function RequireUnion({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user?.unionPoster || user?.isAdmin ? children : <Navigate to="/attendance" replace />
}

function RequireSecurity({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  return user?.isSecurity || user?.isAdmin ? children : <Navigate to="/attendance" replace />
}

// Các trang đã làm xong; mọi trang còn lại trong config/navigation.tsx tự dùng trang "Sắp ra mắt".
const IMPLEMENTED = new Set([
  '/org',
  '/system/announcements',
  '/system/occasions',
  '/system/birthday-message',
  '/settings/union-announcements',
  '/system/audit',
  '/system/data',
  '/system/access',
  '/org/transfers',
  '/org/health',
  '/trips/hung-yen',
  '/trips/business',
  '/attendance/complaints',
  '/payslip',
  '/payroll',
  '/payroll/config',
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
  '/system/employee-import',
  '/attendance/closed',
  '/attendance/closing',
  '/attendance',
  '/attendance/factory',
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
  '/other/holidays',
  '/exercise/seasons',
  '/lines/hr-recipients',
  '/evaluation/hr',
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
        <Route path="feed" element={<CommunityPage />} />
        <Route path="feed/topic/:id" element={<TopicPage />} />
        <Route path="feed/post/:id" element={<ThreadPage />} />
        <Route path="feed/moderation" element={<RequireAdmin><FeedModerationPage /></RequireAdmin>} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/factory" element={<RequireAdmin><FactoryAttendancePage /></RequireAdmin>} />
        <Route path="attendance/closed" element={<ClosedAttendancePage />} />
        <Route path="attendance/closing" element={<RequireAdmin><ClosedImportPage /></RequireAdmin>} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="leave/annual" element={<AnnualLeavePage />} />
        <Route path="leave/annual-report" element={<RequireAdmin><AnnualLeaveReportPage /></RequireAdmin>} />
        <Route path="approvals" element={<Navigate to="/approvals/finger" replace />} />
        <Route path="approvals/finger" element={<ApprovalsPage kind="finger" />} />
        <Route path="approvals/overtime" element={<ApprovalsPage kind="overtime" />} />
        <Route path="approvals/leave" element={<ApprovalsPage kind="leave" />} />
        <Route path="approvals/goout" element={<ApprovalsPage kind="goout" />} />
        <Route path="approvals/late" element={<ApprovalsPage kind="late" />} />
        <Route path="approvals/early" element={<ApprovalsPage kind="early" />} />
        <Route path="evaluation" element={<EvaluationPage />} />
        <Route path="lines/approval" element={<RequireAdmin><ApprovalLinePage /></RequireAdmin>} />
        <Route path="lines/evaluator" element={<RequireAdmin><EvaluatorLinePage /></RequireAdmin>} />
        <Route path="lines/cleanup" element={<RequireAdmin><LineCleanupPage /></RequireAdmin>} />
        <Route path="org" element={<RequireAdmin><OrgStructurePage /></RequireAdmin>} />
        <Route path="approvals/delegation" element={<DelegationPage />} />
        <Route path="requests/backlog" element={<RequireAdmin><ApprovalBacklogPage /></RequireAdmin>} />
        <Route path="requests/ot-overlaps" element={<RequireAdmin><OvertimeOverlapPage /></RequireAdmin>} />
        <Route path="qa" element={<QaPage />} />
        <Route path="qa/manage" element={<RequireAdmin><QaManagePage /></RequireAdmin>} />
        <Route path="payslip" element={<PayslipPage />} />
        <Route path="payslip/import" element={<RequireAdmin><PayslipImportPage /></RequireAdmin>} />
        <Route path="payroll" element={<RequireAdmin><PayrollPage /></RequireAdmin>} />
        <Route path="payroll/config" element={<RequireAdmin><PayrollConfigPage /></RequireAdmin>} />
        <Route path="payroll/people" element={PERSON_PAY_UI ? <RequireAdmin><PayrollPeoplePage /></RequireAdmin> : <Navigate to="/payroll" replace />} />
        <Route path="attendance/closing-auto" element={<RequireAdmin><ClosingAutoPage /></RequireAdmin>} />
        <Route path="attendance/complaints" element={<ComplaintsPage />} />
        <Route path="attendance/complaints/manage" element={<RequireAdmin><ComplaintsManagePage /></RequireAdmin>} />
        <Route path="trips/hung-yen" element={<HungYenPage />} />
        <Route path="trips/business" element={<BusinessTripsPage />} />
        <Route path="org/health" element={<RequireAdmin><DataHealthPage /></RequireAdmin>} />
        <Route path="org/transfers" element={<RequireAdmin><TransfersPage /></RequireAdmin>} />
        <Route path="system/mail-templates" element={<RequireAdmin><MailTemplatesPage /></RequireAdmin>} />
        <Route path="system/notifications" element={<RequireAdmin><NotificationSettingsPage /></RequireAdmin>} />
        <Route path="system/audit" element={<RequireAdmin><AuditPage /></RequireAdmin>} />
        <Route path="system/data" element={<RequireAdmin><DataRecoveryPage /></RequireAdmin>} />
        <Route path="system/access" element={<RequireAdmin><AccessPage /></RequireAdmin>} />
        <Route path="system/announcements" element={<RequireAdmin><AnnouncementsPage /></RequireAdmin>} />
        <Route path="system/occasions" element={<RequireAdmin><OccasionsPage /></RequireAdmin>} />
        <Route path="system/birthday-message" element={<RequireAdmin><BirthdayMessagePage /></RequireAdmin>} />
        <Route path="lines/coverage" element={<Navigate to="/org" replace />} />
        <Route path="other/swap-days" element={<RequireAdmin><SwapDaysPage /></RequireAdmin>} />
        <Route path="other/holidays" element={<RequireAdmin><HolidaysPage /></RequireAdmin>} />
        <Route path="exercise/seasons" element={<RequireAdmin><ExerciseSeasonsPage /></RequireAdmin>} />
        <Route path="lines/hr-recipients" element={<RequireAdmin><HrRecipientsPage /></RequireAdmin>} />
        <Route path="evaluation/hr" element={<RequireAdmin><EvaluationHrPage /></RequireAdmin>} />
        <Route path="evaluation/report" element={<Navigate to="/evaluation/hr?tab=done" replace />} />
        <Route path="evaluation/audit" element={<RequireAdmin><EvaluationAuditPage /></RequireAdmin>} />
        <Route path="evaluation/register" element={<RequireAdmin><EvaluationRegisterPage /></RequireAdmin>} />
        <Route path="go-out" element={<ShortRequestsPage kind="goout" />} />
        <Route path="late-forms" element={<ShortRequestsPage kind="late" />} />
        <Route path="early-forms" element={<ShortRequestsPage kind="early" />} />
        <Route path="system/permissions" element={<RequireAdmin><PermissionsPage /></RequireAdmin>} />
        <Route path="system/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
        <Route path="system/departments" element={<Navigate to="/org" replace />} />
        <Route path="system/data-cleanup" element={<Navigate to="/org" replace />} />
        <Route path="settings/security" element={<ChangePasswordPage />} />
        <Route path="system/employee-import" element={<RequireAdmin><EmployeeImportPage /></RequireAdmin>} />
        <Route path="security/gate" element={<RequireSecurity><SecurityGatePage /></RequireSecurity>} />
        <Route path="security/late" element={<RequireSecurity><SecurityLatePage /></RequireSecurity>} />
        <Route path="requests/stats" element={<RequireAdmin><RequestStatsPage /></RequireAdmin>} />
        <Route path="requests/delete" element={<RequireAdmin><DeleteApprovedPage /></RequireAdmin>} />
        <Route path="finger-forms" element={<FingerRequestsPage />} />
        <Route path="overtime" element={<OvertimeRequestsPage />} />
        <Route path="settings/account" element={<AccountPage />} />
        <Route path="settings/union-announcements" element={<RequireUnion><UnionAnnouncementsPage /></RequireUnion>} />
        <Route path="settings/appearance" element={<AppearancePage />} />
        {ALL_PAGES.filter((p) => !IMPLEMENTED.has(p.path)).map((p) => (
          <Route key={p.key} path={p.path.slice(1)} element={<ComingSoon />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
