import { api } from './client'

export interface MailTemplateDraft { subject: string; heading: string; intro: string; buttonText: string; footer: string }
export interface MailLayoutDraft { brand: string; color: string; buttonText: string; footer: string }
export interface MailTemplateInfo {
  key: string; group: string
  custom: { subject: string | null; heading: string | null; intro: string | null; buttonText: string | null; footer: string | null; updatedBy: string | null; updatedAt: string | null } | null
}
export interface MailTemplates {
  ready: boolean
  layout: { brand: string; color: string; buttonText: string; footer: string; custom: boolean }
  defaults: { subject: string; heading: string; buttonText: string; footer: string; brand: string; color: string; placeholders: string[] }
  templates: MailTemplateInfo[]
}

const body = (t: MailTemplateDraft) => ({ subject: t.subject, heading: t.heading, intro: t.intro, buttonText: t.buttonText, footer: t.footer })

export const mailTemplates = {
  get: () => api.get<MailTemplates>('/admin/mail-templates').then((r) => r.data),
  save: (key: string, t: MailTemplateDraft) => api.put(`/admin/mail-templates/${encodeURIComponent(key)}`, body(t)).then(() => undefined),
  reset: (key: string) => api.delete(`/admin/mail-templates/${encodeURIComponent(key)}`).then(() => undefined),
  saveLayout: (l: MailLayoutDraft) => api.put('/admin/mail-templates/layout', l).then(() => undefined),
  resetLayout: () => api.delete('/admin/mail-templates/layout').then(() => undefined),
  preview: (key: string | null, template: MailTemplateDraft | null, layout: MailLayoutDraft | null) =>
    api.post<{ subject: string; html: string }>('/admin/mail-templates/preview', { key, template: template && body(template), layout }).then((r) => r.data),
  test: (key: string | null, to: string, template: MailTemplateDraft | null, layout: MailLayoutDraft | null) =>
    api.post<{ ok: boolean }>('/admin/mail-templates/test', { key, to, template: template && body(template), layout }).then((r) => r.data),
}

/** Script tạo bảng lưu mẫu email (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const MAIL_TEMPLATE_SQL = `CREATE TABLE dbo.Tbl_MailTemplates (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, CASEKEY varchar(40) NOT NULL, SUBJECT nvarchar(200) NULL, HEADING nvarchar(200) NULL,
    INTRO nvarchar(1000) NULL, BUTTONTEXT nvarchar(60) NULL, FOOTER nvarchar(500) NULL, BRAND nvarchar(60) NULL, COLOR varchar(7) NULL,
    UPDATEDBY nvarchar(50) NULL, UPDATEDATE datetime NULL, CONSTRAINT UQ_Tbl_MailTemplates_CASEKEY UNIQUE (CASEKEY));`
