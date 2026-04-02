import { Check, Circle, Clock3, X } from 'lucide-react'
import { useMemo } from 'react'

import { StatusBadge } from '@/components/common/status-badge'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import {
  buildPayslipWorkflowTimelineSteps,
  type PayslipWorkflowStepKey,
  type PayslipWorkflowStepState,
  type PayslipWorkflowTimelineSource,
} from '@/types/payroll'

interface PayslipWorkflowTimelineProps {
  source: PayslipWorkflowTimelineSource
  className?: string
}

function getStateTone(
  stepState: PayslipWorkflowStepState,
  stepKey: PayslipWorkflowStepKey,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' {
  switch (stepState) {
    case 'completed':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'current':
      if (stepKey === 'IN_REVIEW') {
        return 'info'
      }

      if (stepKey === 'GENERATED') {
        return 'brand'
      }

      if (stepKey === 'AVAILABLE') {
        return 'success'
      }

      return 'warning'
    case 'pending':
    default:
      return 'neutral'
  }
}

function getTimelineStepClasses(
  stepState: PayslipWorkflowStepState,
  stepKey: PayslipWorkflowStepKey,
) {
  const tone = getStateTone(stepState, stepKey)

  switch (tone) {
    case 'success':
      return {
        line: 'bg-emerald-200',
        icon: 'border-emerald-200 bg-emerald-100 text-emerald-700',
        card: 'border-emerald-200/80 bg-emerald-50/70',
      }
    case 'danger':
      return {
        line: 'bg-rose-200',
        icon: 'border-rose-200 bg-rose-100 text-rose-700',
        card: 'border-rose-200/80 bg-rose-50/70',
      }
    case 'info':
      return {
        line: 'bg-sky-200',
        icon: 'border-sky-200 bg-sky-100 text-sky-700',
        card: 'border-sky-200/80 bg-sky-50/70',
      }
    case 'brand':
      return {
        line: 'bg-orange-200',
        icon: 'border-orange-200 bg-orange-100 text-orange-700',
        card: 'border-orange-200/80 bg-orange-50/70',
      }
    case 'warning':
      return {
        line: 'bg-amber-200',
        icon: 'border-amber-200 bg-amber-100 text-amber-700',
        card: 'border-amber-200/80 bg-amber-50/70',
      }
    case 'neutral':
    default:
      return {
        line: 'bg-slate-200',
        icon: 'border-slate-200 bg-white text-slate-400',
        card: 'border-slate-200/80 bg-white',
      }
  }
}

function getStepIcon(stepState: PayslipWorkflowStepState) {
  switch (stepState) {
    case 'completed':
      return Check
    case 'current':
      return Clock3
    case 'rejected':
      return X
    case 'pending':
    default:
      return Circle
  }
}

function formatTimelineTimestamp(value: string | null, locale: string): string | null {
  if (!value) {
    return null
  }

  return new Date(value).toLocaleString(locale)
}

export function PayslipWorkflowTimeline({
  source,
  className,
}: PayslipWorkflowTimelineProps) {
  const { locale, t } = useI18n()
  const steps = useMemo(
    () => buildPayslipWorkflowTimelineSteps(source, t),
    [source, t],
  )
  const currentStepLabel = t('payroll.payslipWorkflow.currentStep')
  const closedStepLabel = t('payroll.payslipWorkflow.closedStep')

  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const classes = getTimelineStepClasses(step.state, step.key)
        const Icon = getStepIcon(step.state)
        const timestamp = formatTimelineTimestamp(step.timestamp, locale)

        return (
          <div key={step.key} className="relative flex gap-4">
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn('absolute left-[19px] top-11 h-[calc(100%-1.5rem)] w-px', classes.line)}
              />
            ) : null}

            <span
              className={cn(
                'relative z-[1] mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm',
                classes.icon,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>

            <div className={cn('min-w-0 flex-1 rounded-2xl border p-4', classes.card)}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-950">{step.label}</p>
                {step.state === 'current' ? (
                  <StatusBadge tone={getStateTone(step.state, step.key)} emphasis="outline">
                    {currentStepLabel === 'payroll.payslipWorkflow.currentStep'
                      ? 'Current'
                      : currentStepLabel}
                  </StatusBadge>
                ) : null}
                {step.state === 'rejected' ? (
                  <StatusBadge tone="danger" emphasis="outline">
                    {closedStepLabel === 'payroll.payslipWorkflow.closedStep'
                      ? 'Closed'
                      : closedStepLabel}
                  </StatusBadge>
                ) : null}
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>

              {timestamp ? (
                <p className="mt-2 text-xs font-medium text-slate-500">{timestamp}</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
