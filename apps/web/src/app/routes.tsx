import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/app/Layout'
import { LibraryPage } from '@/features/library/LibraryPage'
import { BookDetailPage } from '@/features/library/BookDetailPage'
import { ShelfPage } from '@/features/library/ShelfPage'
import { WriteEntryPage } from '@/features/editor/WriteEntryPage'
import { WorkspacePage } from '@/features/editor/WorkspacePage'
import { ReaderPage } from '@/features/reader/ReaderPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { NotFoundPage } from '@/app/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* The reader is full-bleed: no site chrome competing with the page. */}
      <Route path="read/:slug" element={<ReaderPage />} />

      <Route element={<Layout />}>
        <Route index element={<LibraryPage />} />
        <Route path="books/:slug" element={<BookDetailPage />} />
        <Route path="shelf" element={<ShelfPage />} />
        <Route path="me" element={<ProfilePage me />} />
        <Route path="u/:handle" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="write" element={<WriteEntryPage />} />
        <Route path="write/:bookId" element={<WorkspacePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
