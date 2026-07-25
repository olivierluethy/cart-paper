import { useCallback, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import type { Asset } from '@/lib/types'

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/

/**
 * Upload first, insert second. An image only enters the document once the
 * server has stored it, so a failed upload never leaves a broken node behind.
 */
export function useImageUpload(bookId: string) {
  const toast = useToast()
  const [uploading, setUploading] = useState(0)

  const upload = useCallback(
    async (file: File): Promise<Asset | null> => {
      if (!IMAGE_TYPES.test(file.type)) {
        toast.error(`${file.name} is not an image CART Paper can read.`)
        return null
      }
      const body = new FormData()
      body.append('file', file)
      setUploading((n) => n + 1)
      try {
        return await api.post<Asset>(`/books/${bookId}/assets`, body)
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : `Could not upload ${file.name}.`)
        return null
      } finally {
        setUploading((n) => n - 1)
      }
    },
    [bookId, toast],
  )

  const insertFiles = useCallback(
    async (editor: Editor, files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const asset = await upload(file)
        if (!asset) continue
        editor
          .chain()
          .focus()
          .insertCartImage({
            src: asset.url,
            alt: null,
            caption: null,
            align: 'center',
            width: 100,
            wrap: false,
          })
          .run()
      }
    },
    [upload],
  )

  return { upload, insertFiles, uploading }
}
