import { api } from './client'

export interface NoticeCaseState {
  key: string; group: string; hasMail: boolean; mailEnabled: boolean; bellEnabled: boolean
  mailDefault: boolean; bellDefault: boolean; updatedBy: string | null; updatedAt: string | null
  /** Thông báo đẩy (điện thoại / máy tính) của loại này; chỉ gửi khi chuông cũng bật. */
  pushEnabled: boolean
}
export interface NoticeMaster { mail: boolean; bell: boolean; push: boolean; updatedBy: string | null; updatedAt: string | null }
export type NoticeChannel = 'mail' | 'bell' | 'push'
export interface PushStatus { serverReady: boolean; tableReady: boolean; devices: number; users: number }
export type MailRouteMode = 'default' | 'only' | 'also'
export interface MailRecipient { userId: string | null; email: string; fullName: string | null }
export interface NoticeSettings { master: NoticeMaster; cases: NoticeCaseState[]; routes: Record<string, { mode: MailRouteMode; count: number }>; push?: PushStatus }

export const noticeSettings = {
  get: () => api.get<NoticeSettings>('/admin/notification-settings').then((r) => r.data),
  setMaster: (channel: NoticeChannel, active: boolean) => api.put(`/admin/notification-settings/master/${channel}`, { active }).then(() => undefined),
  getRecipients: (key: string) => api.get<{ mode: MailRouteMode; recipients: MailRecipient[] }>(`/admin/notification-settings/cases/${encodeURIComponent(key)}/recipients`).then((r) => r.data),
  setRecipients: (key: string, mode: MailRouteMode, recipients: MailRecipient[]) => api.put(`/admin/notification-settings/cases/${encodeURIComponent(key)}/recipients`, { mode, recipients }).then(() => undefined),
  setCase: (key: string, channel: NoticeChannel, active: boolean) => api.put(`/admin/notification-settings/cases/${encodeURIComponent(key)}/${channel}`, { active }).then(() => undefined),
}

