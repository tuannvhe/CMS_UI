import { QaWorkspace } from '../../components/QaWorkspace'

/** Hỏi đáp của nhân viên: màn chat kiểu Messenger, đặt câu hỏi về lương / công cho nhân sự và xem trả lời. */
export default function QaPage() {
  return (
    <div className="page qa-page">
      <QaWorkspace mode="mine" />
    </div>
  )
}
