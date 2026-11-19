/** Chữ của bảng Quản lý CV sửa trực tiếp (rg.*) và trạng thái đọc CV. Lỗi lưu dùng rec.err.* (chỉ thêm mã còn thiếu, không đè chữ sẵn có). */
export const REC_GRID_BUNDLES = {
  vi: {
    rg: {
      cvDownload: 'Tải CV', clickEdit: 'Bấm để sửa', edit: 'Sửa trong bảng', editHint: 'Sửa trực tiếp các ô trên bảng (nhiều hồ sơ, nhiều trang), xong bấm Lưu một lần.',
      editing: 'Đang sửa trong bảng', dirty: 'Đã sửa {{n}} hồ sơ', none: 'Chưa sửa ô nào',
      save: 'Lưu ({{n}})', cancel: 'Thoát sửa', discardAsk: 'Bỏ {{n}} hồ sơ đã sửa nhưng chưa lưu?', discard: 'Bỏ thay đổi',
      saved: 'Đã lưu {{n}} hồ sơ', someFailed: 'Một số hồ sơ chưa lưu được (vẫn giữ trên bảng để sửa lại)',
      leaveAsk: 'Có thay đổi chưa lưu trên bảng tuyển dụng.', changedHint: 'Ô đã sửa, chưa lưu',
      email: 'Email', note: 'Ghi chú', phone: 'SĐT', department: 'Bộ phận', factory: 'Nhà máy', position: 'Vị trí',
      cv: {
        col: 'Đọc CV', none: '—', notRead: 'Chưa đọc', auto: 'Đọc từ CV', ai: 'AI đã đọc', hr: 'HR sửa tay',
        queued: 'Chờ AI · thứ {{n}}', queuedKo: 'Chờ dịch tiếng Hàn', reading: 'AI đang đọc… {{s}}s', preparing: 'Đang che lương / dịch', translatingKo: 'Đang dịch tiếng Hàn',
        aiSkip: 'AI không đọc được', aiError: 'AI lỗi',
        tipAuto: 'Thông tin lấy bằng đọc chữ trong CV theo quy tắc (không qua AI).', tipAi: 'Thông tin do AI đọc từ CV.', tipHr: 'HR đã sửa tay, AI đọc lại sẽ không đè.',
        tipNotRead: 'CV chưa được đọc thông tin lần nào.', tipQueued: 'Đang xếp hàng chờ AI đọc (máy chủ đọc lần lượt từng CV).',
        tipReading: 'AI đang đọc CV này, bảng tự cập nhật khi xong.', tipPreparing: 'AI đã đọc xong, đang làm bản che lương / bản dịch.',
        tipSkip: 'Lần AI đọc gần nhất không ra kết quả, đang giữ thông tin đọc theo quy tắc.', tipAt: 'Lúc {{t}}', live: 'Cập nhật trực tiếp',
      },
    },
    rec: { err: { grid_rows: 'Số hồ sơ lưu một lần không hợp lệ (tối đa 200).', grid_field: 'Có ô không được phép sửa.', position: 'Vị trí không được trống và tối đa 100 ký tự.', factory: 'Nhà máy không hợp lệ.', note: 'Ghi chú tối đa 1000 ký tự.' } },
  },
  en: {
    rg: {
      cvDownload: 'Download CV', clickEdit: 'Click to edit', edit: 'Edit in table', editHint: 'Edit cells directly in the table (many rows, many pages), then press Save once.',
      editing: 'Editing in table', dirty: '{{n}} application(s) changed', none: 'No changes yet',
      save: 'Save ({{n}})', cancel: 'Stop editing', discardAsk: 'Discard {{n}} unsaved application change(s)?', discard: 'Discard',
      saved: 'Saved {{n}} application(s)', someFailed: 'Some applications could not be saved (kept in the table to fix)',
      leaveAsk: 'There are unsaved changes in the recruitment table.', changedHint: 'Changed, not saved',
      email: 'Email', note: 'Note', phone: 'Phone', department: 'Department', factory: 'Factory', position: 'Position',
      cv: {
        col: 'CV reading', none: '—', notRead: 'Not read', auto: 'Read from CV', ai: 'Read by AI', hr: 'Edited by HR',
        queued: 'Waiting for AI · #{{n}}', queuedKo: 'Waiting for Korean translation', reading: 'AI reading… {{s}}s', preparing: 'Masking / translating', translatingKo: 'Translating to Korean',
        aiSkip: 'AI could not read', aiError: 'AI error',
        tipAuto: 'Data read from CV text by rules (no AI).', tipAi: 'Data read from the CV by AI.', tipHr: 'Edited by HR; AI re-reads will not overwrite it.',
        tipNotRead: 'This CV has not been read yet.', tipQueued: 'Queued for AI (the server reads CVs one by one).',
        tipReading: 'AI is reading this CV; the table updates when done.', tipPreparing: 'AI finished reading; preparing the masked / translated copy.',
        tipSkip: 'The last AI read gave no result; rule-based data is kept.', tipAt: 'At {{t}}', live: 'Live',
      },
    },
    rec: { err: { grid_rows: 'Invalid number of applications to save (max 200).', grid_field: 'A field cannot be edited.', position: 'Position is required (max 100 characters).', factory: 'Invalid factory.', note: 'Note is at most 1000 characters.' } },
  },
  ko: {
    rg: {
      cvDownload: 'CV 다운로드', clickEdit: '클릭하여 수정', edit: '표에서 수정', editHint: '표에서 바로 수정(여러 행, 여러 페이지)한 뒤 저장을 한 번 누르세요.',
      editing: '표에서 수정 중', dirty: '{{n}}건 수정됨', none: '수정한 항목 없음',
      save: '저장 ({{n}})', cancel: '수정 종료', discardAsk: '저장하지 않은 {{n}}건의 변경을 버릴까요?', discard: '변경 취소',
      saved: '{{n}}건 저장됨', someFailed: '일부 지원서를 저장하지 못했습니다 (수정할 수 있도록 표에 남겨 둠)',
      leaveAsk: '채용 표에 저장하지 않은 변경이 있습니다.', changedHint: '수정됨, 저장 안 됨',
      email: '이메일', note: '메모', phone: '전화번호', department: '부서', factory: '공장', position: '직무',
      cv: {
        col: 'CV 읽기', none: '—', notRead: '읽지 않음', auto: 'CV에서 읽음', ai: 'AI가 읽음', hr: 'HR 직접 수정',
        queued: 'AI 대기 · {{n}}번째', queuedKo: '한국어 번역 대기', reading: 'AI 읽는 중… {{s}}초', preparing: '급여 가림 / 번역 중', translatingKo: '한국어 번역 중',
        aiSkip: 'AI가 읽지 못함', aiError: 'AI 오류',
        tipAuto: '규칙으로 CV 텍스트에서 읽은 정보 (AI 아님).', tipAi: 'AI가 CV에서 읽은 정보.', tipHr: 'HR이 직접 수정함, AI가 다시 읽어도 덮어쓰지 않음.',
        tipNotRead: '아직 CV 정보를 읽지 않았습니다.', tipQueued: 'AI 읽기 대기 중 (서버가 CV를 하나씩 읽음).',
        tipReading: 'AI가 이 CV를 읽는 중, 완료되면 표가 자동 갱신됩니다.', tipPreparing: 'AI 읽기 완료, 급여 가림본 / 번역본 작성 중.',
        tipSkip: '최근 AI 읽기에서 결과가 없어 규칙 기반 정보를 유지합니다.', tipAt: '{{t}}', live: '실시간',
      },
    },
    rec: { err: { grid_rows: '한 번에 저장할 수 있는 지원서 수가 올바르지 않습니다 (최대 200).', grid_field: '수정할 수 없는 항목이 있습니다.', position: '직무는 필수이며 최대 100자입니다.', factory: '공장이 올바르지 않습니다.', note: '메모는 최대 1000자입니다.' } },
  },
} as const
