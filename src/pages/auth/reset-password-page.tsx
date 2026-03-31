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
import { useRecoveryRoute } from '@/hooks/use-recovery-route'
import {
  firstLoginSetPasswordSchema,
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
      toast.success('Your password has been reset. Sign in with your new password.')

      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          authNotice: {
            type: 'success',
            message: 'Your password has been reset. Sign in with your new password.',
          },
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reset your password right now.'
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
        badge="Validating link"
        title="Reset Password"
        description="Validating your password reset link."
        heroBadge="Reset session"
        heroTitle="We are verifying your reset session securely."
        heroDescription="Use the latest reset link from your email. Once the recovery session is confirmed, you can set a new password."
        heroHighlights={[
          'Recovery links are checked before password updates are allowed.',
          'Only the latest valid reset session should be used.',
          'You will return to sign-in after the password is updated.',
        ]}
        heroIcon={KeyRound}
        theme="reset"
      >
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your reset session...
        </div>
      </AuthLayout>
    )
  }

  if (recoveryStatus === 'invalid') {
    return (
      <AuthLayout
        badge="Recovery expired"
        title="Reset Password"
        description="This password reset link is invalid, expired, or no longer active."
        heroBadge="Reset unavailable"
        heroTitle="Request a new password reset email and use the latest link."
        heroDescription="Expired or reused links should not be trusted. Start a new recovery request and continue with the newest email you receive."
        heroHighlights={[
          'Use only the most recent reset email in your inbox.',
          'Expired or invalid links cannot update your password.',
          'You can request a fresh recovery link at any time.',
        ]}
        heroIcon={AlertTriangle}
        theme="reset"
      >
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid reset session</AlertTitle>
          <AlertDescription>
            Request a new password reset email and use the latest link from your inbox.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="h-11 flex-1 rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95"
          >
            <Link to={ROUTES.FORGOT_PASSWORD}>Request a new reset link</Link>
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      badge="Create new password"
      title="Set a New Password"
      description="Choose a strong password with at least 8 characters."
      heroBadge="Secure reset"
      heroTitle="Set a new password and return to your secure sign-in flow."
      heroDescription="Once the recovery session is valid, choose a strong password and continue with the updated credentials on the login page."
      heroHighlights={[
        'Use a strong password with at least eight characters.',
        'Confirm the new password before the update is applied.',
        'After the reset, sign in again with the new credentials.',
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
            {submitFeedback.type === 'success' ? 'Success' : 'Unable to reset password'}
          </AlertTitle>
          <AlertDescription>{submitFeedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <PasswordField
          id="newPassword"
          label="New password"
          error={form.formState.errors.newPassword?.message}
          inputType={showPassword.newPassword ? 'text' : 'password'}
          isSubmitting={form.formState.isSubmitting}
          isVisible={showPassword.newPassword}
          onToggleVisibility={() => toggleVisibility('newPassword')}
          registration={form.register('newPassword')}
        />

        <PasswordField
          id="confirmNewPassword"
          label="Confirm new password"
          error={form.formState.errors.confirmNewPassword?.message}
          inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
          isSubmitting={form.formState.isSubmitting}
          isVisible={showPassword.confirmNewPassword}
          onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
          registration={form.register('confirmNewPassword')}
        />

        <p className="text-xs text-slate-600">
          After resetting your password, you will be returned to the login screen.
        </p>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95"
          disabled={form.formState.isSubmitting || !isValidAndDirty}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating password...
            </>
          ) : (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Reset password
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
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          disabled={isSubmitting}
          className="h-11 rounded-xl border-slate-200 bg-white/90 pr-11 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0"
          {...registration}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-9 w-9 text-slate-500 hover:bg-transparent hover:text-slate-800"
          disabled={isSubmitting}
          onClick={onToggleVisibility}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
