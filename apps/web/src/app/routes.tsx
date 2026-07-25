import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/app/Layout'
import { LibraryPage } from '@/features/library/LibraryPage'
import { BookDetailPage } from '@/features/library/BookDetailPage'
import { ShelfPage } from '@/features/library/ShelfPage'
import { WriteEntryPage } from '@/features/editor/WriteEntryPage'
import { WorkspacePage } from '@/features/editor/WorkspacePage'
import { NotFoundPage } from '@/app/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LibraryPage />} />
        <Route path="books/:slug" element={<BookDetailPage />} />
        <Route path="shelf" element={<ShelfPage />} />
        <Route path="write" element={<WriteEntryPage />} />
        <Route path="write/:bookId" element={<WorkspacePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
