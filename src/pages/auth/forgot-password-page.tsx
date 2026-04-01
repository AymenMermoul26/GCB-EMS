import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { AuthLayout } from '@/layouts/auth-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { useI18n } from '@/hooks/use-i18n'
import {
  createForgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/schemas/auth/forgot-password.schema'
import { authService } from '@/services/auth'

function getForgotPasswordErrorMessage(error: Error, t: (key: string) => string): string {
  const normalizedMessage = error.message.toLowerCase()

  if (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('timeout')
  ) {
    return t('auth.forgot.networkError')
  }

  return t('auth.forgot.submitError')
}

export function ForgotPasswordPage() {
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const { isRTL, t } = useI18n()
  const forgotPasswordSchema = useMemo(() => createForgotPasswordSchema(t), [t])

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const requestResetMutation = useMutation({
    mutationFn: authService.requestPasswordReset,
    onSuccess: (_, email) => {
      setHasSubmitted(true)
      form.clearErrors()
      form.reset({ email })
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    await requestResetMutation.mutateAsync(values.email)
  })

  return (
    <AuthLayout
      badge={t('auth.forgot.badge')}
      title={t('auth.forgot.title')}
      description={t('auth.forgot.description')}
      heroBadge={t('auth.forgot.heroBadge')}
      heroTitle={t('auth.forgot.heroTitle')}
      heroDescription={t('auth.forgot.heroDescription')}
      heroHighlights={[
        t('auth.forgot.heroHighlights.one'),
        t('auth.forgot.heroHighlights.two'),
        t('auth.forgot.heroHighlights.three'),
      ]}
      heroIcon={MailCheck}
      theme="recovery"
    >
      {requestResetMutation.error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>{t('auth.forgot.errorTitle')}</AlertTitle>
          <AlertDescription>
            {getForgotPasswordErrorMessage(requestResetMutation.error, t)}
          </AlertDescription>
        </Alert>
      ) : null}

      {hasSubmitted ? (
        <Alert className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-900">
          <MailCheck className="h-4 w-4" />
          <AlertTitle>{t('auth.forgot.successTitle')}</AlertTitle>
          <AlertDescription>{t('auth.forgot.successMessage')}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('common.email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.forgot.emailPlaceholder')}
            disabled={requestResetMutation.isPending}
            className="h-11 rounded-xl border-slate-200 bg-white/90 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
          <p className="text-xs text-slate-500">
            {t('auth.forgot.emailHelper')}
          </p>
        </div>

        <p className="text-sm leading-6 text-slate-600">
          {t('auth.forgot.formHint')}
        </p>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95"
          disabled={requestResetMutation.isPending}
        >
          {requestResetMutation.isPending ? (
            <>
              <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />
              {t('auth.forgot.sending')}
            </>
          ) : hasSubmitted ? (
            t('actions.sendAnotherResetLink')
          ) : (
            t('actions.sendResetLink')
          )}
        </Button>
      </form>

      <Button asChild variant="outline" className="h-11 w-full rounded-xl">
        <Link to={ROUTES.LOGIN}>
          <ArrowLeft className={isRTL ? 'ml-2 h-4 w-4' : 'mr-2 h-4 w-4'} />
          {t('common.backToLogin')}
        </Link>
      </Button>
    </AuthLayout>
  )
}
