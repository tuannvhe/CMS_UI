/** Bản dịch bổ sung cho màn Phản hồi công (giờ gửi dưới ngày lỗi). Nạp vào i18n bằng addResourceBundle ở i18n/index.ts. */
export const CMP_EXTRA_BUNDLES = {
  vi: { cmp: { sentAt: 'Gửi lúc' } },
  en: { cmp: { sentAt: 'Sent at' } },
  ko: { cmp: { sentAt: '접수 시각' } },
} as const
