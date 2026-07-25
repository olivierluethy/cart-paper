export type UUID = string

export type JSONContent = {
  type?: string
  attrs?: Record<string, unknown>
  content?: JSONContent[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
  [k: string]: unknown
}

export type UserPublic = {
  id: UUID
  handle: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  stats_visible: boolean
  created_at: string
}

export type ReadingSettings = {
  font_size: number
  line_height: number
  width: number
  typeface: 'serif' | 'sans'
  hide_statistics: boolean
}

export type UserMe = UserPublic & {
  email: string
  reading_settings: ReadingSettings
}

export type BookStatus = 'draft' | 'published'

export type CoverDesign = {
  kind: 'color' | 'gradient' | 'image'
  color?: string
  gradient?: [string, string]
  angle?: number
  image_url?: string
  preset?: 'classic' | 'modern' | 'plate' | 'stamp'
  title_color?: string
  show_author?: boolean
  text?: string
}

export type BookSummary = {
  id: UUID
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  status: BookStatus
  language: string
  tags: string[]
  published_at: string | null
  created_at: string
  updated_at: string
  front_cover: CoverDesign | null
  author: UserPublic
  page_count: number
  rating_average: number
  rating_count: number
  comment_count: number
  favorite_count: number
  is_favorite: boolean
  my_rating: number | null
}

export type BookDetail = BookSummary & {
  back_cover: CoverDesign | null
  rating_distribution: Record<string, number>
  can_edit: boolean
  progress: ReadingProgress | null
  import_source: ImportedDocumentRef | null
}

export type PageSummary = {
  id: UUID
  index: number
  title: string | null
  updated_at: string
}

export type BookPage = PageSummary & {
  book_id: UUID
  content: JSONContent
  created_at: string
}

export type Anchor = {
  page_id?: UUID | null
  from?: number | null
  to?: number | null
  quote: string
  prefix?: string
  suffix?: string
  pdf?: { page: number; rects: [number, number, number, number][] } | null
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'red' | 'purple' | 'black'

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  'yellow',
  'green',
  'blue',
  'pink',
  'red',
  'purple',
  'black',
]

export type Highlight = {
  id: UUID
  book_id: UUID
  page_id: UUID | null
  anchor: Anchor
  color: HighlightColor
  created_at: string
  note_id: UUID | null
}

export type AttachmentKind = 'link' | 'image' | 'quote' | 'file'

export type NoteAttachment = {
  id: UUID
  kind: AttachmentKind
  url: string | null
  title: string | null
  preview: string | null
  storage_key: string | null
}

export type Note = {
  id: UUID
  highlight_id: UUID | null
  book_id: UUID
  page_id: UUID | null
  anchor: Anchor | null
  body: JSONContent
  attachments: NoteAttachment[]
  created_at: string
  updated_at: string
  highlight_color: HighlightColor | null
}

export type Comment = {
  id: UUID
  book_id: UUID
  page_id: UUID | null
  parent_id: UUID | null
  thread_id: UUID | null
  author: UserPublic | null
  body: string
  anchor: Anchor | null
  is_deleted: boolean
  created_at: string
  edited_at: string | null
  reply_count: number
  replies?: Comment[]
}

export type CommentThread = {
  root: Comment
  replies: Comment[]
}

export type ReadingProgress = {
  book_id: UUID
  page_id: UUID | null
  page_index: number
  anchor: Anchor | null
  percent: number
  updated_at: string
}

export type ContinueReading = ReadingProgress & { book: BookSummary }

export type NotificationType =
  | 'comment_reply'
  | 'book_comment'
  | 'book_rating'
  | 'invite_accepted'

export type AppNotification = {
  id: UUID
  type: NotificationType
  actor: UserPublic | null
  book: { id: UUID; slug: string; title: string } | null
  comment_id: UUID | null
  page_id: UUID | null
  page_index: number | null
  excerpt: string | null
  quote: string | null
  read_at: string | null
  created_at: string
}

export type BookInvite = {
  id: UUID
  token: string
  url: string
  label: string | null
  invited_email: string | null
  accepted_count: number
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export type Asset = {
  id: UUID
  url: string
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
}

export type ImportedDocumentRef = {
  id: UUID
  filename: string
  source_type: 'pdf' | 'docx'
  conversion_status: 'pending' | 'processing' | 'converted' | 'low_confidence' | 'failed'
  original_url: string
}

export type ConversionReport = {
  pages_total: number
  pages_clean: number
  images: number
  warnings: string[]
  confidence: number
}

export type ImportResult = {
  document: ImportedDocumentRef
  book: BookSummary | null
  report: ConversionReport
}

export type BookStats = {
  book: { id: UUID; slug: string; title: string }
  active_seconds: number
  sessions: number
  pages_turned: number
  last_read_at: string | null
}

export type ReadingStats = {
  total_seconds: number
  sessions: number
  pages_turned: number
  longest_streak_days: number
  current_streak_days: number
  average_session_seconds: number
  books_started: number
  books: BookStats[]
}

export type TrailEntry =
  | { kind: 'comment'; at: string; comment: Comment; book: BookSummary; page_index: number | null }
  | { kind: 'note'; at: string; note: Note; book: BookSummary; page_index: number | null }

export type Paged<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}
