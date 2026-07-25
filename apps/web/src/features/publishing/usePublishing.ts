import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { bookKeys } from '@/lib/books'
import { useToast } from '@/lib/toast'
import type { BookDetail } from '@/lib/types'

export function usePublishing(bookId: string) {
  const qc = useQueryClient()
  const toast = useToast()

  const settle = (updated: BookDetail) => {
    qc.setQueryData(bookKeys.detail(updated.id), updated)
    qc.setQueryData(bookKeys.detail(updated.slug), updated)
    qc.invalidateQueries({ queryKey: bookKeys.mine() })
    qc.invalidateQueries({ queryKey: ['library'] })
  }

  const publish = useMutation({
    mutationFn: () => api.post<BookDetail>(`/books/${bookId}/publish`),
    onSuccess: (updated) => {
      settle(updated)
      toast.success(`“${updated.title}” is published — it is in the library now.`)
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not publish this book.'),
  })

  const unpublish = useMutation({
    mutationFn: () => api.post<BookDetail>(`/books/${bookId}/unpublish`),
    onSuccess: (updated) => {
      settle(updated)
      toast.info('Back to a private draft. Nothing was deleted.')
    },
    onError: () => toast.error('Could not unpublish this book.'),
  })

  return { publish, unpublish }
}
