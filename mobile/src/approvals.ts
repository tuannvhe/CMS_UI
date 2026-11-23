/* 2026-11-23 [Truong] - Mobile app: approval helpers shared by the approvals tab and the group screen */
import type { TFunction } from 'i18next'
import { apiErrorCode } from '@web/api/requests'
import { isSingleApprover, type ApprovalKind } from '@web/api/approvals'

export const APPROVAL_KINDS: ApprovalKind[] = ['overtime', 'finger', 'leave', 'goout', 'late', 'early']

const NAV: Record<ApprovalKind, string> = {
  finger: 'approvalFinger', overtime: 'approvalOvertime', leave: 'approvalLeave', goout: 'approvalGoOut', late: 'approvalLate', early: 'approvalEarly',
}

export const isApprovalKind = (k: unknown): k is ApprovalKind => typeof k === 'string' && (APPROVAL_KINDS as string[]).includes(k)

/** Tên loại đơn (dùng lại nhãn menu của web). */
export const kindName = (t: TFunction, k: ApprovalKind) => t(`nav.${NAV[k]}`)

/** Tên cấp duyệt như màn duyệt của web. */
export const levelName = (t: TFunction, kind: ApprovalKind, l: number) =>
  isSingleApprover(kind) ? t('sh.approver') : l === 1 ? t('req.shortOne') : l === 2 ? t('req.shortTwo') : l === 3 ? t('req.shortThree') : t('leave.shortFour')

/** Thông báo lỗi khi duyệt / từ chối (cùng mã lỗi với web). */
export function approvalError(t: TFunction, e: unknown) {
  const { code } = apiErrorCode(e)
  if (code === 'no_account') return t('apr.noAccount')
  if (code === 'not_found') return t('apr.notFound')
  if (code === 'invalid_input') return t('apr.needReason')
  return t('mobile.err.generic')
}

/** dd/MM/yyyy từ chuỗi ngày ISO của máy chủ. */
export const dmy = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
