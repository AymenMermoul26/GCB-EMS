import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-xl border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'h5'>) {
  return <h5 className={cn('mb-1 font-semibold leading-none', className)} {...props} />
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  )
}

export { Alert, AlertTitle, AlertDescription }
