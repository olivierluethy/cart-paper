import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import type { Anchor, Highlight, HighlightColor, JSONContent, Note, UUID } from '@/lib/types'

const opts = (invite?: string | null) => (invite ? { invite } : undefined)

export const annotationKeys = {
  highlights: (ref: string) => ['highlights', ref] as const,
  notes: (ref: string) => ['notes', ref] as const,
}

export function useHighlights(ref: string, invite?: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: annotationKeys.highlights(ref),
    queryFn: () => api.get<Highlight[]>(`/books/${ref}/highlights`, opts(invite)),
    enabled: Boolean(user && ref),
    staleTime: 60_000,
  })
}

export function useNotes(ref: string, invite?: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: annotationKeys.notes(ref),
    queryFn: () => api.get<Note[]>(`/books/${ref}/notes`, opts(invite)),
    enabled: Boolean(user && ref),
    staleTime: 60_000,
  })
}

/** Optimistic: a highlight has to appear the instant the colour is clicked. */
export function useHighlightActions(ref: string, invite?: string | null) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = annotationKeys.highlights(ref)

  const create = useMutation({
    mutationFn: (input: { page_id: UUID | null; anchor: Anchor; color: HighlightColor }) =>
      api.post<Highlight>(`/books/${ref}/highlights`, input, opts(invite)),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Highlight[]>(key)
      const optimistic: Highlight = {
        id: `pending-${Date.now()}`,
        book_id: ref,
        page_id: input.page_id,
        anchor: input.anchor,
        color: input.color,
        created_at: new Date().toISOString(),
        note_id: null,
      }
      qc.setQueryData<Highlight[]>(key, [...(previous ?? []), optimistic])
      return { previous }
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(key, context?.previous)
      toast.error('Could not save that highlight.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const recolor = useMutation({
    mutationFn: ({ id, color }: { id: UUID; color: HighlightColor }) =>
      api.patch<Highlight>(`/highlights/${id}`, { color }),
    onMutate: async ({ id, color }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Highlight[]>(key)
      qc.setQueryData<Highlight[]>(
        key,
        previous?.map((item) => (item.id === id ? { ...item, color } : item)),
      )
      return { previous }
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(key, context?.previous)
      toast.error('Could not change that colour.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const remove = useMutation({
    mutationFn: (id: UUID) => api.del(`/highlights/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Highlight[]>(key)
      qc.setQueryData<Highlight[]>(key, previous?.filter((item) => item.id !== id))
      return { previous }
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(key, context?.previous)
      toast.error('Could not remove that highlight.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: annotationKeys.notes(ref) })
    },
  })

  return { create, recolor, remove }
}

export function useNoteActions(ref: string, invite?: string | null) {
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: annotationKeys.notes(ref) })
    qc.invalidateQueries({ queryKey: annotationKeys.highlights(ref) })
    qc.invalidateQueries({ queryKey: ['trail'] })
  }

  const create = useMutation({
    mutationFn: (input: {
      highlight_id?: UUID | null
      page_id: UUID | null
      anchor: Anchor | null
      body: JSONContent
      attachments?: { kind: 'link' | 'image' | 'quote'; url?: string; title?: string; preview?: string }[]
    }) => api.post<Note>(`/books/${ref}/notes`, input, opts(invite)),
    onSuccess: refresh,
    onError: () => toast.error('Could not save that note.'),
  })

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: UUID; body?: JSONContent; anchor?: Anchor }) =>
      api.patch<Note>(`/notes/${id}`, patch),
    onSuccess: refresh,
    onError: () => toast.error('Could not update that note.'),
  })

  const remove = useMutation({
    mutationFn: (id: UUID) => api.del(`/notes/${id}`),
    onSuccess: refresh,
    onError: () => toast.error('Could not delete that note.'),
  })

  const addAttachment = useMutation({
    mutationFn: ({
      noteId,
      ...body
    }: {
      noteId: UUID
      kind: 'link' | 'image' | 'quote'
      url?: string
      title?: string
      preview?: string
    }) => api.post(`/notes/${noteId}/attachments`, body),
    onSuccess: refresh,
    onError: () => toast.error('Could not attach that.'),
  })

  const uploadAttachment = useMutation({
    mutationFn: ({ noteId, file }: { noteId: UUID; file: File }) => {
      const body = new FormData()
      body.append('file', file)
      return api.post(`/notes/${noteId}/attachments/file`, body)
    },
    onSuccess: refresh,
    onError: () => toast.error('Could not upload that file.'),
  })

  const removeAttachment = useMutation({
    mutationFn: (id: UUID) => api.del(`/note-attachments/${id}`),
    onSuccess: refresh,
  })

  return { create, update, remove, addAttachment, uploadAttachment, removeAttachment }
}
