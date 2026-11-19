import { QaWorkspace } from '../../components/QaWorkspace'

/** Nhân sự trả lời hỏi đáp: màn chat kiểu Messenger, mọi chủ đề, mặc định lọc các chủ đề chưa được trả lời. */
export default function QaManagePage() {
  return (
    <div className="page qa-page">
      <QaWorkspace mode="manage" />
    </div>
  )
}
