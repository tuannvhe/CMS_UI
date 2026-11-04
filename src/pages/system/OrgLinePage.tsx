import { Navigate, useSearchParams } from 'react-router-dom'

/** Line duyệt / đánh giá nay nằm trong tab "Line" của màn Cây Dept / Team / Part; giữ route cũ để link cũ vẫn chạy. */
export default function OrgLinePage() {
  const [params] = useSearchParams()
  const node = params.get('node')
  return <Navigate to={node ? `/system/org-tree?node=${encodeURIComponent(node)}` : '/system/org-tree'} replace />
}
