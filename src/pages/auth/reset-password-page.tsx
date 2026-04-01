import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { type UseFormRegisterReturn, useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/layouts/auth-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { useRecoveryRoute } from '@/hooks/use-recovery-route'
import { cn } from '@/lib/utils'
import {
  createFirstLoginSetPasswordSchema,
  type FirstLoginSetPasswordFormValues,
} from '@/schemas/changePasswordSchema'
import { authService } from '@/services/auth'

const PASSWORD_RECOVERY_SESSION_KEY = 'gcb-ems:password-recovery'

type RecoveryStatus = 'checking' | 'ready' | 'invalid'
type PasswordFieldKey = 'newPassword' | 'confirmNewPassword'

function hasRecoveryHintInUrl(search: string, hash: string): boolean {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
  const searchParams = new URLSearchParams(search)
  const hashParams = new URLSearchParams(normalizedHash)
  const recoveryType = searchParams.get('type') ?? hashParams.get('type')

  return (
    recoveryType === 'recovery' ||
    Boolean(
      searchParams.get('code') ||
        searchParams.get('token_hash') ||
        hashParams.get('access_token') ||
        hashParams.get('refresh_token'),
    )
  )
}

function readRecoveryFlag(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.sessionStorage.getItem(PASSWORD_RECOVERY_SESSION_KEY) === 'true'
}

function writeRecoveryFlag(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(PASSWORD_RECOVERY_SESSION_KEY, 'true')
}

function clearRecoveryFlag(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(PASSWORD_RECOVERY_SESSION_KEY)
}

export function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { goBack, primaryActionLabel, recoveryRoute } = useRecoveryRoute()
  const { isLoading, passwordRecoveryActive, user } = useAuth()
  const { isRTL, t } = useI18n()
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>(() => {
    const hasWindowRecoveryHint =
      typeof window !== 'undefined' &&
      hasRecoveryHintInUrl(window.location.search, window.location.hash)

    if (hasWindowRecoveryHint || readRecoveryFlag()) {
      return 'checking'
    }

    return 'invalid'
  })
  const [showPassword, setShowPassword] = useState<Record<PasswordFieldKey, boolean>>({
    newPassword: false,
    confirmNewPassword: false,
  })

  const hasUrlRecoveryHint = useMemo(
    () => hasRecoveryHintInUrl(location.search, location.hash),
    [location.hash, location.search],
  )
  const firstLoginSetPasswordSchema = useMemo(
    () => createFirstLoginSetPasswordSchema(t),
    [t],
  )

  const form = useForm<FirstLoginSetPasswordFormValues>({
    resolver: zodResolver(firstLoginSetPasswordSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  useEffect(() => {
    if (hasUrlRecoveryHint || passwordRecoveryActive) {
      writeRecoveryFlag()
    }
  }, [hasUrlRecoveryHint, passwordRecoveryActive])

  useEffect(() => {
    let cancelled = false

    const resolveRecoveryStatus = async () => {
      const hasRecoveryContext =
        hasUrlRecoveryHint || passwordRecoveryActive || readRecoveryFlag()

      if (!hasRecoveryContext) {
        setRecoveryStatus('invalid')
        return
      }

      if (isLoading) {
        setRecoveryStatus('checking')
        return
      }

      if (user) {
        setRecoveryStatus('ready')
        return
      }

      setRecoveryStatus('checking')

      try {
        const session = await authService.getSession()

        if (cancelled) {
          return
        }

        if (session?.user) {
          setRecoveryStatus('ready')
          return
        }
      } catch {
        if (cancelled) {
          return
        }
      }

      clearRecoveryFlag()
      setRecoveryStatus('invalid')
    }

    void resolveRecoveryStatus()

    return () => {
      cancelled = true
    }
  }, [hasUrlRecoveryHint, isLoading, passwordRecoveryActive, user])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitFeedback(null)

    try {
      await authService.resetPasswordWithRecovery({
        newPassword: values.newPassword,
      })

      clearRecoveryFlag()
      await authService.signOut()
      toast.success(t('auth.reset.successMessage'))

      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          authNotice: {
            type: 'success',
            message: t('auth.reset.successMessage'),
          },
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('auth.reset.genericError')
      toast.error(message)
      setSubmitFeedback({ type: 'error', message })
    }
  })

  const isValidAndDirty = form.formState.isValid && form.formState.isDirty

  const toggleVisibility = (key: PasswordFieldKey) => {
    setShowPassword((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  if (recoveryStatus === 'checking') {
    return (
      <AuthLayout
        badge={t('auth.reset.validatingBadge')}
        title={t('auth.reset.title')}
        description={t('auth.reset.validatingDescription')}
        heroBadge={t('auth.reset.validatingHeroBadge')}
        heroTitle={t('auth.reset.validatingHeroTitle')}
        heroDescription={t('auth.reset.validatingHeroDescription')}
        heroHighlights={[
          t('auth.reset.validatingHighlights.one'),
          t('auth.reset.validatingHighlights.two'),
          t('auth.reset.validatingHighlights.three'),
        ]}
        heroIcon={KeyRound}
        theme="reset"
      >
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('auth.reset.checking')}
        </div>
      </AuthLayout>
    )
  }

  if (recoveryStatus === 'invalid') {
    return (
      <AuthLayout
        badge={t('auth.reset.invalidBadge')}
        title={t('auth.reset.title')}
        description={t('auth.reset.invalidDescription')}
        heroBadge={t('auth.reset.invalidHeroBadge')}
        heroTitle={t('auth.reset.invalidHeroTitle')}
        heroDescription={t('auth.reset.invalidHeroDescription')}
        heroHighlights={[
          t('auth.reset.invalidHighlights.one'),
          t('auth.reset.invalidHighlights.two'),
          t('auth.reset.invalidHighlights.three'),
        ]}
        heroIcon={AlertTriangle}
        theme="reset"
      >
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('auth.reset.invalidTitle')}</AlertTitle>
          <AlertDescription>{t('auth.reset.invalidMessage')}</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="h-11 flex-1 rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95"
          >
            <Link to={ROUTES.FORGOT_PASSWORD}>{t('actions.requestNewResetLink')}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={goBack}
          >
            {primaryActionLabel}
          </Button>
        </div>

        <Button asChild variant="ghost" className="h-11 w-full rounded-xl">
          <Link to={recoveryRoute}>
            <ArrowLeft className={cn(isRTL ? 'ml-2 h-4 w-4 rotate-180' : 'mr-2 h-4 w-4')} />
            {t('common.back')}
          </Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      badge={t('auth.reset.createBadge')}
      title={t('auth.reset.title')}
      description={t('auth.reset.createDescription')}
      heroBadge={t('auth.reset.createHeroBadge')}
      heroTitle={t('auth.reset.createHeroTitle')}
      heroDescription={t('auth.reset.createHeroDescription')}
      heroHighlights={[
        t('auth.reset.createHighlights.one'),
        t('auth.reset.createHighlights.two'),
        t('auth.reset.createHighlights.three'),
      ]}
      heroIcon={KeyRound}
      theme="reset"
    >
      {submitFeedback ? (
        <Alert
          variant={submitFeedback.type === 'error' ? 'destructive' : 'default'}
          className="rounded-2xl"
        >
          <AlertTitle>
            {submitFeedback.type === 'success'
              ? t('common.success')
              : t('auth.reset.alertErrorTitle')}
          </AlertTitle>
          <AlertDescription>{submitFeedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <PasswordField
          id="newPassword"
          label={t('auth.reset.newPassword')}
          error={form.formState.errors.newPassword?.message}
          inputType={showPassword.newPassword ? 'text' : 'password'}
          isSubmitting={form.formState.isSubmitting}
          isVisible={showPassword.newPassword}
          onToggleVisibility={() => toggleVisibility('newPassword')}
          registration={form.register('newPassword')}
        />

        <PasswordField
          id="confirmNewPassword"
          label={t('auth.reset.confirmNewPassword')}
          error={form.formState.errors.confirmNewPassword?.message}
          inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
          isSubmitting={form.formState.isSubmitting}
          isVisible={showPassword.confirmNewPassword}
          onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
          registration={form.register('confirmNewPassword')}
        />

        <p className="text-xs text-slate-600">
          {t('auth.reset.afterResetHint')}
        </p>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95"
          disabled={form.formState.isSubmitting || !isValidAndDirty}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className={cn(isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin')} />
              {t('auth.reset.updating')}
            </>
          ) : (
            <>
              <KeyRound className={cn(isRTL ? 'ml-2 h-4 w-4' : 'mr-2 h-4 w-4')} />
              {t('actions.resetPassword')}
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  error?: string
  inputType: 'text' | 'password'
  isSubmitting: boolean
  isVisible: boolean
  onToggleVisibility: () => void
  registration: UseFormRegisterReturn
}

function PasswordField({
  id,
  label,
  error,
  inputType,
  isSubmitting,
  isVisible,
  onToggleVisibility,
  registration,
}: PasswordFieldProps) {
  const { isRTL, t } = useI18n()

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          disabled={isSubmitting}
          className={cn(
            'h-11 rounded-xl border-slate-200 bg-white/90 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0',
            isRTL ? 'pl-11' : 'pr-11',
          )}
          {...registration}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'absolute top-1 h-9 w-9 text-slate-500 hover:bg-transparent hover:text-slate-800',
            isRTL ? 'left-1' : 'right-1',
          )}
          disabled={isSubmitting}
          onClick={onToggleVisibility}
          aria-label={isVisible ? t('common.hidePassword') : t('common.showPassword')}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
