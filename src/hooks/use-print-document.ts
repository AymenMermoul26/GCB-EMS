import { useCallback, useEffect } from 'react'

interface UsePrintDocumentOptions {
  bodyClassName: string
  defaultDocumentTitle: string
  resetDelayMs?: number
}

export function usePrintDocument({
  bodyClassName,
  defaultDocumentTitle,
  resetDelayMs = 200,
}: UsePrintDocumentOptions) {
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove(bodyClassName)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      document.body.classList.remove(bodyClassName)
    }
  }, [bodyClassName])

  const printDocument = useCallback(
    (documentTitle?: string) => {
      const previousTitle = document.title
      document.title = documentTitle ?? defaultDocumentTitle
      document.body.classList.add(bodyClassName)

      window.requestAnimationFrame(() => {
        window.print()
        window.setTimeout(() => {
          document.title = previousTitle
          document.body.classList.remove(bodyClassName)
        }, resetDelayMs)
      })
    },
    [bodyClassName, defaultDocumentTitle, resetDelayMs],
  )

  return {
    printDocument,
  }
}
