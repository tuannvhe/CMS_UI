import { api } from './client'

export interface AuditRow { id: number; at: string; actorId: string; actorName: string; action: string; entity: string; entityKey: string | null; detail: string | null; before: string | null; after: string | null; status: number; ip: string | null; note: string | null; undo?: string | null; undoReason?: string | null; undone?: boolean }
export interface AuditResult { ready: boolean; items: AuditRow[] }
export interface AuditQuery { from: string; to: string; actor?: string; entity?: string; text?: string; failedOnly?: boolean; take?: number }

export const audit = {
  rollback: (id: number) => api.post<{ kind: string; done: number; skipped: number }>(`/admin/audit/rollback/${id}`).then((r) => r.data),
  search: (q: AuditQuery) => api.get<AuditResult>('/admin/audit', { params: q }).then((r) => r.data),
}

