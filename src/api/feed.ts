import { api } from './client'

export type FeedStatus = 'published' | 'pending' | 'hidden'
/** purged = tệp đã bị dọn sau 2 tháng (không còn url, chỉ hiện ghi chú "đã dọn"). */
export interface FeedMedia { id: number; kind: 'image' | 'video'; contentType: string; size: number; purged: boolean; url: string | null }
export interface FeedPost {
  id: number; authorId: string; authorName: string; avatarUrl?: string | null; department: string | null; body: string; status: FeedStatus; hiddenReason: string | null
  createdAt: string; commentCount: number; reports: number; mine: boolean; media: FeedMedia[]
  reactions: Record<string, number>; myReaction: string | null
  /** Diễn đàn kiểu voz: chủ đề, tiêu đề, ghim, lần trả lời cuối, lượt xem. */
  topicId?: number | null; topicName?: string | null; title?: string | null; pinned?: boolean; lastActivity?: string | null; views?: number
}
export interface FeedComment {
  id: number; postId: number; parentId: number | null; authorId: string; authorName: string; avatarUrl?: string | null; department: string | null; body: string; status: FeedStatus
  hiddenReason: string | null; createdAt: string; reports: number; mine: boolean; media: FeedMedia[]
  reactions: Record<string, number>; myReaction: string | null
}
export interface TopicLast { id: number; title: string; authorId: string; authorName: string; avatarUrl: string | null; at: string }
export interface FeedTopic { id: number; name: string; description: string | null; group: string | null; sort: number; active: boolean; threads: number; replies: number; last?: TopicLast | null }
export interface ThreadsPage { ready: boolean; rows: FeedPost[]; total: number; page: number; pageSize: number; topic: { id: number; name: string; description: string | null; group: string | null; active: boolean } | null }
export interface FeedReactor { userId: string; name: string; avatarUrl: string | null; department: string | null; reaction: string; at: string }
export interface FeedPage { ready: boolean; posts: FeedPost[]; mine: FeedPost[]; hasMore: boolean }
export interface FeedQueue {
  pendingPosts: FeedPost[]; reportedPosts: FeedPost[]; reportedComments: FeedComment[]; hiddenPosts: FeedPost[]; hiddenComments: FeedComment[]; pendingComments: FeedComment[]
  /** Ảnh / video mới đăng (3 ngày) của người chưa thuộc nhóm tin cậy, để quản trị xem lại sau. */
  recentPosts: FeedPost[]; recentComments: FeedComment[]
}

export interface FeedTerm { id: number; term: string; action: 'hide' | 'block'; createdBy: string; createdAt: string }

/** Giới hạn phía máy khách (máy chủ kiểm tra lại theo nội dung tệp thật). Bình luận: một ảnh hoặc một video nhẹ. */
export const FEED_LIMITS = { title: 150, body: 2000, comment: 1000, media: 4, image: 8 * 1024 * 1024, video: 40 * 1024 * 1024, commentImage: 3 * 1024 * 1024, commentVideo: 10 * 1024 * 1024 }
/** Diễn đàn tự tải lại dữ liệu mỗi 10 phút khi người dùng còn ở trang (chỉ trang này, không tải lại cả ứng dụng; tab trình duyệt ẩn thì không tải). */
export const FEED_REFRESH_MS = 10 * 60 * 1000
export const FEED_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm'

/** Các cảm xúc (khóa gửi lên máy chủ, biểu tượng và nhãn dịch ở feed.react.*). */
export const FEED_REACTIONS = [
  { key: 'like', emoji: '👍' }, { key: 'love', emoji: '❤️' }, { key: 'haha', emoji: '😂' },
  { key: 'wow', emoji: '😮' }, { key: 'sad', emoji: '😢' }, { key: 'angry', emoji: '😡' },
] as const

export const feed = {
  list: (before?: number) => api.get<FeedPage>('/feed', { params: { before } }).then((r) => r.data),
  topics: () => api.get<{ ready: boolean; topics: FeedTopic[] }>('/feed/topics').then((r) => r.data),
  threads: (p: { topicId?: number; sort?: 'new' | 'active'; page?: number }) => api.get<ThreadsPage>('/feed/threads', { params: p }).then((r) => r.data),
  thread: (id: number) => api.get<FeedPost>(`/feed/${id}`).then((r) => r.data),
  view: (id: number) => api.post(`/feed/${id}/view`).then(() => undefined),
  create: (body: string, files: File[], topicId?: number, title?: string) => {
    const fd = new FormData()
    fd.append('body', body)
    if (title) fd.append('title', title)
    if (topicId) fd.append('topicId', String(topicId))
    files.forEach((f) => fd.append('files', f))
    return api.post<FeedPost>('/feed', fd, { timeout: 300000 }).then((r) => r.data)
  },
  remove: (id: number) => api.delete(`/feed/${id}`).then(() => undefined),
  comments: (id: number) => api.get<FeedComment[]>(`/feed/${id}/comments`).then((r) => r.data),
  comment: (id: number, body: string, parentId?: number, file?: File) => {
    const fd = new FormData()
    fd.append('body', body)
    if (parentId) fd.append('parentId', String(parentId))
    if (file) fd.append('files', file)
    return api.post<FeedComment>(`/feed/${id}/comments`, fd, { timeout: 120000 }).then((r) => r.data)
  },
  edit: (id: number, title: string | null, body: string) => api.put<FeedPost>(`/feed/${id}`, { title, body }).then((r) => r.data),
  editComment: (id: number, body: string) => api.put<FeedComment>(`/feed/comments/${id}`, { body }).then((r) => r.data),
  person: (userId: string) => api.get<FeedPerson>(`/feed/people/${encodeURIComponent(userId.trim())}`).then((r) => r.data),
  removeComment: (id: number) => api.delete(`/feed/comments/${id}`).then(() => undefined),
  react: (target: 'post' | 'comment', id: number, reaction: string | null) =>
    api.post<{ reactions: Record<string, number>; myReaction: string | null }>('/feed/react', { target, id, reaction }).then((r) => r.data),
  reactors: (target: 'post' | 'comment', id: number) => api.get<FeedReactor[]>(`/feed/react/${target}/${id}`).then((r) => r.data),
  report: (target: 'post' | 'comment', id: number, reason?: string) => api.post<{ hidden: boolean }>('/feed/report', { target, id, reason }).then((r) => r.data),
  queue: () => api.get<FeedQueue>('/admin/feed/queue').then((r) => r.data),
  setPost: (id: number, status: 'published' | 'hidden', reason?: string) => api.post(`/admin/feed/posts/${id}/status`, { status, reason }).then(() => undefined),
  setComment: (id: number, status: 'published' | 'hidden', reason?: string) => api.post(`/admin/feed/comments/${id}/status`, { status, reason }).then(() => undefined),
  terms: () => api.get<FeedTerm[]>('/admin/feed/terms').then((r) => r.data),
  addTerm: (term: string, action: 'hide' | 'block') => api.post('/admin/feed/terms', { term, action }).then(() => undefined),
  removeTerm: (id: number) => api.delete(`/admin/feed/terms/${id}`).then(() => undefined),
  adminTopics: () => api.get<FeedTopic[]>('/admin/feed/topics').then((r) => r.data),
  addTopic: (b: { name: string; description?: string; group?: string; sort: number; active: boolean }) => api.post<{ id: number }>('/admin/feed/topics', b).then((r) => r.data),
  updateTopic: (id: number, b: { name: string; description?: string; group?: string; sort: number; active: boolean }) => api.put(`/admin/feed/topics/${id}`, b).then(() => undefined),
  deleteTopic: (id: number) => api.delete(`/admin/feed/topics/${id}`).then(() => undefined),
  pin: (id: number, pinned: boolean) => api.post(`/admin/feed/posts/${id}/pin`, { pinned }).then(() => undefined),
  movePost: (id: number, topicId: number) => api.post(`/admin/feed/posts/${id}/topic`, { topicId }).then(() => undefined),
  dismiss: (target: 'posts' | 'comments', id: number) => api.post(`/admin/feed/${target}/${id}/dismiss`).then(() => undefined),
}

/** Mã lỗi (title / detail của ProblemDetails). */
export function feedError(e: unknown): { code: string; detail: string } {
  const d = (e as { response?: { data?: { title?: string; detail?: string } } }).response?.data
  return { code: d?.title ?? '', detail: d?.detail ?? '' }
}

/** Script tạo bảng của bảng tin (chạy một lần trên CMS_VINA; chỉ hệ thống mới dùng). */
export const FEED_TABLE_SQL = `CREATE TABLE dbo.Tbl_FeedPosts (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, AUTHORID nvarchar(50) NOT NULL, AUTHORNAME nvarchar(100) NOT NULL, DEPARTMENT nvarchar(100) NULL,
    BODY nvarchar(2000) NOT NULL, STATUS varchar(10) NOT NULL DEFAULT 'published', HIDDENREASON nvarchar(200) NULL,
    CREATEDATE datetime NOT NULL, UPDATEDBY nvarchar(50) NULL, UPDATEDATE datetime NULL);
CREATE INDEX IX_Tbl_FeedPosts_STATUS_ID ON dbo.Tbl_FeedPosts (STATUS, ID DESC);
CREATE INDEX IX_Tbl_FeedPosts_AUTHOR ON dbo.Tbl_FeedPosts (AUTHORID, STATUS);
CREATE TABLE dbo.Tbl_FeedMedia (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, POSTID int NOT NULL, COMMENTID int NULL, KIND varchar(5) NOT NULL, STOREDNAME varchar(60) NOT NULL,
    CONTENTTYPE varchar(40) NOT NULL, SIZE bigint NOT NULL, SORT int NOT NULL, CREATEDATE datetime NOT NULL,
    RESIZED bit NOT NULL DEFAULT 0, PURGED bit NOT NULL DEFAULT 0);
CREATE INDEX IX_Tbl_FeedMedia_POST ON dbo.Tbl_FeedMedia (POSTID);
CREATE INDEX IX_Tbl_FeedMedia_COMMENT ON dbo.Tbl_FeedMedia (COMMENTID);
CREATE INDEX IX_Tbl_FeedMedia_AGE ON dbo.Tbl_FeedMedia (PURGED, RESIZED, CREATEDATE);
CREATE TABLE dbo.Tbl_FeedComments (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, POSTID int NOT NULL, PARENTID int NULL, AUTHORID nvarchar(50) NOT NULL, AUTHORNAME nvarchar(100) NOT NULL,
    BODY nvarchar(1000) NOT NULL, STATUS varchar(10) NOT NULL DEFAULT 'published', HIDDENREASON nvarchar(200) NULL,
    CREATEDATE datetime NOT NULL, UPDATEDBY nvarchar(50) NULL, UPDATEDATE datetime NULL);
CREATE INDEX IX_Tbl_FeedComments_POST ON dbo.Tbl_FeedComments (POSTID, ID);
CREATE TABLE dbo.Tbl_FeedTerms (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, TERM nvarchar(60) NOT NULL, ACTION varchar(5) NOT NULL, CREATEDBY nvarchar(50) NOT NULL,
    CREATEDATE datetime NOT NULL, CONSTRAINT UQ_Tbl_FeedTerms_TERM UNIQUE (TERM));
CREATE TABLE dbo.Tbl_FeedReactions (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, TARGETTYPE varchar(7) NOT NULL, TARGETID int NOT NULL, USERID nvarchar(50) NOT NULL,
    REACTION varchar(10) NOT NULL, CREATEDATE datetime NOT NULL, CONSTRAINT UQ_Tbl_FeedReactions UNIQUE (TARGETTYPE, TARGETID, USERID));
CREATE TABLE dbo.Tbl_FeedReports (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY, TARGETTYPE varchar(7) NOT NULL, TARGETID int NOT NULL, REPORTERID nvarchar(50) NOT NULL,
    REASON nvarchar(200) NULL, CREATEDATE datetime NOT NULL, CONSTRAINT UQ_Tbl_FeedReports UNIQUE (TARGETTYPE, TARGETID, REPORTERID));
GO
-- ----- Tbl_FeedTopics (chu de cua Dien dan) -----
IF OBJECT_ID(N'dbo.Tbl_FeedTopics', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[Tbl_FeedTopics] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [NAME] nvarchar(80) NOT NULL,
    [DESCRIPTION] nvarchar(300) NULL,
    [GROUPNAME] nvarchar(60) NULL,
    [SORT] int NOT NULL CONSTRAINT [DF_Tbl_FeedTopics_SORT] DEFAULT 0,
    [ACTIVE] bit NOT NULL CONSTRAINT [DF_Tbl_FeedTopics_ACTIVE] DEFAULT 1,
    [CREATEBY] nvarchar(50) NULL,
    [CREATEDATE] datetime NULL,
    CONSTRAINT [PK_Tbl_FeedTopics] PRIMARY KEY CLUSTERED ([ID])
    );
END
GO

-- ----- Tbl_FeedPosts: them cot cho chu de / tieu de / ghim / luot xem -----
IF COL_LENGTH(N'dbo.Tbl_FeedPosts', N'TOPICID') IS NULL ALTER TABLE dbo.Tbl_FeedPosts ADD [TOPICID] int NULL;
IF COL_LENGTH(N'dbo.Tbl_FeedPosts', N'TITLE') IS NULL ALTER TABLE dbo.Tbl_FeedPosts ADD [TITLE] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.Tbl_FeedPosts', N'PINNED') IS NULL ALTER TABLE dbo.Tbl_FeedPosts ADD [PINNED] bit NOT NULL CONSTRAINT [DF_Tbl_FeedPosts_PINNED] DEFAULT 0;
IF COL_LENGTH(N'dbo.Tbl_FeedPosts', N'LASTACTIVITY') IS NULL ALTER TABLE dbo.Tbl_FeedPosts ADD [LASTACTIVITY] datetime NULL;
IF COL_LENGTH(N'dbo.Tbl_FeedPosts', N'VIEWS') IS NULL ALTER TABLE dbo.Tbl_FeedPosts ADD [VIEWS] int NOT NULL CONSTRAINT [DF_Tbl_FeedPosts_VIEWS] DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Tbl_FeedPosts_TOPIC' AND object_id = OBJECT_ID(N'dbo.Tbl_FeedPosts'))
    CREATE INDEX [IX_Tbl_FeedPosts_TOPIC] ON dbo.[Tbl_FeedPosts] ([TOPICID], [STATUS], [PINNED], [ID] DESC);
GO
`

export interface FeedPerson { userId: string; name: string; department: string | null; position: string | null; avatarUrl: string | null; posts: number; comments: number; reactionsReceived: number; reactionsGiven: number }
