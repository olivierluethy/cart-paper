import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { ModalProvider } from '@/lib/modal'
import { ToastProvider } from '@/lib/toast'
import { AppRoutes } from '@/app/routes'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { ScrollToTop } from '@/lib/page-meta'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reading is a long-lived tab; refetching on every focus is noise.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <ToastProvider>
          <AuthProvider>
            <ModalProvider>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </ModalProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
