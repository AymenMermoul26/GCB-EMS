import { Languages } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  variant?: 'auth' | 'sidebar'
  compact?: boolean
  className?: string
}

export function LanguageSwitcher({
  variant = 'auth',
  compact = false,
  className,
}: LanguageSwitcherProps) {
  const { language, languages, setLanguage, t } = useI18n()

  if (variant === 'sidebar') {
    return (
      <div className={cn('space-y-2', className)}>
        {!compact ? (
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            <Languages className="h-3.5 w-3.5" />
            <span>{t('language.label')}</span>
          </div>
        ) : null}

        <div
          className={cn(
            'grid gap-1.5',
            compact ? 'grid-cols-1' : 'grid-cols-3',
          )}
        >
          {languages.map((option) => {
            const isActive = option.value === language

            return (
              <Button
                key={option.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'rounded-xl border-slate-200 text-xs font-semibold',
                  compact ? 'h-9 w-full px-0' : 'h-9 px-2',
                  isActive
                    ? 'bg-slate-900 text-white hover:bg-slate-900'
                    : 'bg-white text-slate-700',
                )}
                aria-pressed={isActive}
                aria-label={`${t('language.label')}: ${option.label}`}
                onClick={() => setLanguage(option.value)}
              >
                {compact ? option.shortLabel : option.label}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 shadow-lg shadow-slate-950/20 backdrop-blur-md',
        className,
      )}
      aria-label={t('language.label')}
    >
      {languages.map((option) => {
        const isActive = option.value === language

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            aria-pressed={isActive}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
              isActive
                ? 'bg-white text-slate-900'
                : 'text-white/75 hover:bg-white/10 hover:text-white',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
