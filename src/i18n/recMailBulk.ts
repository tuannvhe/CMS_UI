/** Chữ của hộp gửi mẫu mail cho nhiều CV đã chọn (rec.mb.*). */
export const REC_MAIL_BULK_BUNDLES = {
  vi: {
    rec: {
      mb: {
        btn: 'Gửi mail ({{n}})', title: 'Gửi mail cho {{n}} ứng viên', send: 'Gửi {{n}} thư', retry: 'Gửi lại {{n}} thư lỗi',
        replyHint: 'Mỗi ứng viên nhận một thư riêng. Ứng viên bấm Trả lời sẽ về email của bạn (người gửi).',
        common: 'Thông tin chung cho mọi thư', list: 'Người nhận ({{n}}) · bấm để xem trước', preview: 'Xem trước thư gửi {{name}}',
        deadline: 'Hạn phản hồi', noEmail: '{{n}} hồ sơ đã chọn không có email hợp lệ, sẽ bị bỏ qua.',
        sentAll: 'Đã gửi {{n}} thư', someFailed: 'Đã gửi {{ok}} thư, {{n}} thư lỗi (xem lý do trong danh sách)',
      },
    },
  },
  en: {
    rec: {
      mb: {
        btn: 'Send email ({{n}})', title: 'Send email to {{n}} candidates', send: 'Send {{n}} emails', retry: 'Resend {{n}} failed',
        replyHint: 'Each candidate gets a separate email. Replies go to your email (the sender).',
        common: 'Shared values for every email', list: 'Recipients ({{n}}) · click to preview', preview: 'Preview of the email to {{name}}',
        deadline: 'Reply by', noEmail: '{{n}} selected applications have no valid email and will be skipped.',
        sentAll: '{{n}} emails sent', someFailed: '{{ok}} sent, {{n}} failed (see reasons in the list)',
      },
    },
  },
  ko: {
    rec: {
      mb: {
        btn: '메일 발송 ({{n}})', title: '지원자 {{n}}명에게 메일 발송', send: '{{n}}통 발송', retry: '실패한 {{n}}통 재발송',
        replyHint: '지원자마다 개별 메일이 발송됩니다. 지원자의 회신은 보낸 사람(본인) 메일로 갑니다.',
        common: '모든 메일에 공통 적용', list: '수신자 ({{n}}) · 클릭하여 미리보기', preview: '{{name}}에게 보낼 메일 미리보기',
        deadline: '회신 기한', noEmail: '선택한 {{n}}건은 유효한 이메일이 없어 제외됩니다.',
        sentAll: '{{n}}통 발송 완료', someFailed: '{{ok}}통 발송, {{n}}통 실패 (목록에서 사유 확인)',
      },
    },
  },
} as const
