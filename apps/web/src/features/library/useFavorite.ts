import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { bookKeys } from '@/lib/books'
import { useToast } from '@/lib/toast'
import type { BookDetail, BookSummary } from '@/lib/types'

export function useFavorites(enabled: boolean) {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get<BookSummary[]>('/favorites'),
    enabled,
  })
}

/** Optimistic, with rollback — a favourite should feel instant. */
export function useToggleFavorite(book: Pick<BookSummary, 'id' | 'slug' | 'is_favorite'>) {
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (next: boolean) =>
      next ? api.post(`/books/${book.id}/favorite`) : api.del(`/books/${book.id}/favorite`),
    onMutate: async (next) => {
      const keys = [bookKeys.detail(book.id), bookKeys.detail(book.slug)]
      await Promise.all(keys.map((key) => qc.cancelQueries({ queryKey: key })))
      const snapshots = keys.map((key) => [key, qc.getQueryData(key)] as const)
      for (const key of keys) {
        qc.setQueryData<BookDetail | undefined>(key, (current) =>
          current
            ? {
                ...current,
                is_favorite: next,
                favorite_count: Math.max(0, current.favorite_count + (next ? 1 : -1)),
              }
            : current,
        )
      }
      return { snapshots }
    },
    onError: (_error, _next, context) => {
      context?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value))
      toast.error('Could not update your favourites.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] })
      qc.invalidateQueries({ queryKey: ['library'] })
      qc.invalidateQueries({ queryKey: bookKeys.detail(book.id) })
      qc.invalidateQueries({ queryKey: bookKeys.detail(book.slug) })
    },
  })
}
