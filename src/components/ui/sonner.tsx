import type * as React from 'react'
import { Toaster } from 'sonner'

type SonnerProps = React.ComponentProps<typeof Toaster>

const Sonner = ({ ...props }: SonnerProps) => {
  return <Toaster richColors closeButton position="top-right" {...props} />
}

export { Sonner }
