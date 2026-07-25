import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  BookDetail,
  BookPage,
  BookSummary,
  JSONContent,
  Paged,
  PageSummary,
  UUID,
} from '@/lib/types'

export const bookKeys = {
  library: (params?: unknown) => ['library', params ?? {}] as const,
  mine: () => ['books', 'mine'] as const,
  detail: (ref: string) => ['book', ref] as const,
  pages: (ref: string) => ['book', ref, 'pages'] as const,
  pagesFull: (ref: string) => ['book', ref, 'pages', 'full'] as const,
}

const inviteOpts = (invite?: string | null) => (invite ? { invite } : undefined)

export type LibraryQuery = {
  q?: string
  tag?: string
  sort?: 'newest' | 'top_rated' | 'most_discussed' | 'title'
  limit?: number
  offset?: number
}

export function useLibrary(params: LibraryQuery = {}) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.tag) search.set('tag', params.tag)
  if (params.sort && params.sort !== 'newest') search.set('sort', params.sort)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  const qs = search.toString()
  return useQuery({
    queryKey: bookKeys.library(params),
    queryFn: () => api.get<Paged<BookSummary>>(`/books${qs ? `?${qs}` : ''}`),
    placeholderData: (previous) => previous,
  })
}

export function useTags() {
  return useQuery({
    queryKey: ['library', 'tags'],
    queryFn: () => api.get<{ tag: string; count: number }[]>('/books/tags'),
    staleTime: 5 * 60_000,
  })
}

export function useMyBooks() {
  return useQuery({
    queryKey: bookKeys.mine(),
    queryFn: () => api.get<BookSummary[]>('/books/mine'),
  })
}

export function useBook(ref: string | undefined, invite?: string | null) {
  return useQuery({
    queryKey: bookKeys.detail(ref ?? ''),
    queryFn: () => api.get<BookDetail>(`/books/${ref}`, inviteOpts(invite)),
    enabled: Boolean(ref),
  })
}

export function usePages(ref: string | undefined, invite?: string | null) {
  return useQuery({
    queryKey: bookKeys.pages(ref ?? ''),
    queryFn: () => api.get<PageSummary[]>(`/books/${ref}/pages`, inviteOpts(invite)),
    enabled: Boolean(ref),
  })
}

/** Every page with its document — what the reader and the print view need. */
export function usePagesFull(ref: string | undefined, invite?: string | null) {
  return useQuery({
    queryKey: bookKeys.pagesFull(ref ?? ''),
    queryFn: () => api.get<BookPage[]>(`/books/${ref}/pages/full`, inviteOpts(invite)),
    enabled: Boolean(ref),
  })
}

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { title?: string; subtitle?: string; description?: string }) =>
      api.post<BookDetail>('/books', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookKeys.mine() }),
  })
}

export function useUpdateBook(ref: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<BookDetail>(`/books/${ref}`, patch),
    onSuccess: (book) => {
      qc.setQueryData(bookKeys.detail(ref), book)
      qc.setQueryData(bookKeys.detail(book.id), book)
      qc.invalidateQueries({ queryKey: bookKeys.mine() })
      qc.invalidateQueries({ queryKey: ['library'] })
    },
  })
}

export function useDeleteBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ref: string) => api.del(`/books/${ref}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookKeys.mine() })
      qc.invalidateQueries({ queryKey: ['library'] })
    },
  })
}

// ------------------------------------------------------------------- pages
export function useCreatePage(ref: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { index?: number; title?: string; content?: JSONContent }) =>
      api.post<BookPage>(`/books/${ref}/pages`, input),
    onSuccess: () => invalidatePages(qc, ref),
  })
}

export function useDuplicatePage(ref: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: UUID) => api.post<BookPage>(`/books/${ref}/pages/${pageId}/duplicate`),
    onSuccess: () => invalidatePages(qc, ref),
  })
}

export function useDeletePage(ref: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: UUID) => api.del(`/books/${ref}/pages/${pageId}`),
    onSuccess: () => invalidatePages(qc, ref),
  })
}

export function useReorderPages(ref: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageIds: UUID[]) =>
      api.post<PageSummary[]>(`/books/${ref}/pages/reorder`, { page_ids: pageIds }),
    onMutate: async (pageIds) => {
      await qc.cancelQueries({ queryKey: bookKeys.pages(ref) })
      const previous = qc.getQueryData<PageSummary[]>(bookKeys.pages(ref))
      if (previous) {
        const byId = new Map(previous.map((page) => [page.id, page]))
        qc.setQueryData(
          bookKeys.pages(ref),
          pageIds.map((id, index) => ({ ...byId.get(id)!, index })),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(bookKeys.pages(ref), context.previous)
    },
    onSettled: () => invalidatePages(qc, ref),
  })
}

export function useSavePage(ref: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pageId, ...patch }: { pageId: UUID; title?: string | null; content?: JSONContent }) =>
      api.patch<BookPage>(`/books/${ref}/pages/${pageId}`, patch),
    onSuccess: (page) => {
      qc.setQueryData<PageSummary[]>(bookKeys.pages(ref), (current) =>
        current?.map((item) =>
          item.id === page.id ? { ...item, title: page.title, updated_at: page.updated_at } : item,
        ),
      )
    },
  })
}

function invalidatePages(qc: ReturnType<typeof useQueryClient>, ref: string) {
  qc.invalidateQueries({ queryKey: bookKeys.pages(ref) })
  qc.invalidateQueries({ queryKey: bookKeys.pagesFull(ref) })
  qc.invalidateQueries({ queryKey: bookKeys.detail(ref) })
}

export function usePage(ref: string | undefined, pageId: UUID | undefined, invite?: string | null) {
  return useQuery({
    queryKey: ['book', ref, 'page', pageId],
    queryFn: () => api.get<BookPage>(`/books/${ref}/pages/${pageId}`, inviteOpts(invite)),
    enabled: Boolean(ref && pageId),
  })
}
