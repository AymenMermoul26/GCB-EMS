import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  className?: string
  imageClassName?: string
  withName?: boolean
}

export function CompanyLogo({
  className,
  imageClassName,
  withName = true,
}: CompanyLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/gcb-logo.svg"
        alt="GCB company logo"
        className={cn('h-10 w-10 rounded-md object-cover', imageClassName)}
      />
      {withName ? (
        <div className="leading-tight">
          <p className="text-sm font-semibold">GCB</p>
          <p className="text-xs text-muted-foreground">Employee Management System</p>
        </div>
      ) : null}
    </div>
  )
}
