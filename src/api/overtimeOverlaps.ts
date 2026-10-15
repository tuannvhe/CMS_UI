import { api } from './client'

export interface OtPiece {
  id: number; employeeId: string; fullName: string; department: string | null; date: string
  start: string; end: string; hours: string; state: 'approved' | 'pending'; senderName: string
}
export interface OtOverlapPair { a: OtPiece; b: OtPiece; overlapHours: number }

export const overtimeOverlaps = {
  report: (from: string, to: string) => api.get<OtOverlapPair[]>('/admin/overtime-overlaps', { params: { from, to } }).then((r) => r.data),
}
