import { useI18n } from '@/hooks/use-i18n'

interface FullScreenLoaderProps {
  label?: string
}

export function FullScreenLoader({ label }: FullScreenLoaderProps) {
  const { t } = useI18n()
  const resolvedLabel = label ?? t('shell.initializing')

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        <span className="text-sm font-medium">{resolvedLabel}</span>
      </div>
    </div>
  )
}
