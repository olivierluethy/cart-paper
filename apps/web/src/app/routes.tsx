import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/app/Layout'
import { LibraryPage } from '@/features/library/LibraryPage'
import { NotFoundPage } from '@/app/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LibraryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
