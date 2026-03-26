import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
type StatusEmphasis = 'soft' | 'outline' | 'solid'

const SOFT_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-transparent bg-slate-100 text-slate-700',
  success: 'border-transparent bg-emerald-100 text-emerald-700',
  warning: 'border-transparent bg-amber-100 text-amber-700',
  danger: 'border-transparent bg-rose-100 text-rose-700',
  info: 'border-transparent bg-sky-100 text-sky-700',
  brand: 'border-transparent bg-orange-100 text-orange-700',
}

const OUTLINE_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-slate-300 text-slate-700',
  success: 'border-emerald-300 text-emerald-700',
  warning: 'border-amber-300 text-amber-700',
  danger: 'border-rose-300 text-rose-700',
  info: 'border-sky-300 text-sky-700',
  brand: 'border-[#ff6b35]/40 text-[#d35b2d]',
}

const SOLID_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-transparent bg-slate-700 text-white',
  success: 'border-transparent bg-emerald-600 text-white',
  warning: 'border-transparent bg-amber-600 text-white',
  danger: 'border-transparent bg-rose-600 text-white',
  info: 'border-transparent bg-sky-600 text-white',
  brand: 'border-transparent bg-[#ff6b35] text-white',
}

interface StatusBadgeProps
  extends Omit<ComponentPropsWithoutRef<typeof Badge>, 'children'> {
  children: ReactNode
  tone?: StatusTone
  emphasis?: StatusEmphasis
}

export function StatusBadge({
  children,
  tone = 'neutral',
  emphasis = 'soft',
  className,
  variant = 'outline',
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        emphasis === 'soft'
          ? SOFT_CLASSES[tone]
          : emphasis === 'solid'
            ? SOLID_CLASSES[tone]
            : OUTLINE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  )
}
