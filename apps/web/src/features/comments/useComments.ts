import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { Anchor, CommentThread, UUID } from '@/lib/types'

const opts = (invite?: string | null) => (invite ? { invite } : undefined)

export const commentKeys = {
  book: (ref: string) => ['comments', ref, 'book'] as const,
  all: (ref: string) => ['comments', ref, 'all'] as const,
}

/** Book-level conversation — the threads with no passage behind them. */
export function useBookComments(ref: string, invite?: string | null) {
  return useQuery({
    queryKey: commentKeys.book(ref),
    queryFn: () => api.get<CommentThread[]>(`/books/${ref}/comments?scope=book`, opts(invite)),
    enabled: Boolean(ref),
  })
}

/** Every thread in the book, anchored ones included — what the reader paints. */
export function useAllComments(ref: string, invite?: string | null) {
  return useQuery({
    queryKey: commentKeys.all(ref),
    queryFn: () => api.get<CommentThread[]>(`/books/${ref}/comments?scope=all`, opts(invite)),
    enabled: Boolean(ref),
  })
}

export function useCommentActions(ref: string, invite?: string | null) {
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['comments', ref] })
    qc.invalidateQueries({ queryKey: ['book', ref] })
    qc.invalidateQueries({ queryKey: ['trail'] })
  }

  const create = useMutation({
    mutationFn: (input: {
      body: string
      page_id?: UUID | null
      parent_id?: UUID | null
      anchor?: Anchor | null
    }) => api.post(`/books/${ref}/comments`, input, opts(invite)),
    onSuccess: refresh,
    onError: () => toast.error('Could not post that comment.'),
  })

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: UUID; body: string }) => api.patch(`/comments/${id}`, { body }),
    onSuccess: refresh,
    onError: () => toast.error('Could not save that edit.'),
  })

  const remove = useMutation({
    mutationFn: (id: UUID) => api.del(`/comments/${id}`),
    onSuccess: refresh,
    onError: () => toast.error('Could not delete that comment.'),
  })

  return { create, edit, remove }
}
