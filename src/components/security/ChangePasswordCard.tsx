import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type UseFormRegisterReturn, useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  BRAND_BUTTON_CLASS_NAME,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_ROLES } from '@/constants/roles'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import {
  createChangePasswordSchema,
  type ChangePasswordFormValues,
  createFirstLoginSetPasswordSchema,
  type FirstLoginSetPasswordFormValues,
} from '@/schemas/changePasswordSchema'
import { authService } from '@/services/auth'

interface ChangePasswordCardProps {
  className?: string
  title?: string
  description?: string
  anchorId?: string
}

type PasswordFieldKey = 'currentPassword' | 'newPassword' | 'confirmNewPassword'

interface SecurityLocationState {
  from?: {
    pathname?: string
  }
}

export function ChangePasswordCard({
  className,
  title,
  description,
  anchorId,
}: ChangePasswordCardProps) {
  const { isRTL, t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as SecurityLocationState | null
  const { refreshAuthState, mustChangePassword, role } = useAuth()
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [showPassword, setShowPassword] = useState<Record<PasswordFieldKey, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  })
  const regularSchema = useMemo(() => createChangePasswordSchema(t), [t])
  const firstLoginSchema = useMemo(() => createFirstLoginSetPasswordSchema(t), [t])

  const regularForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(regularSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const firstLoginForm = useForm<FirstLoginSetPasswordFormValues>({
    resolver: zodResolver(firstLoginSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const onSubmitRegular = regularForm.handleSubmit(async (values) => {
    setSubmitFeedback(null)

    try {
      await authService.changePasswordWithReauth({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      await refreshAuthState()

      toast.success(t('security.feedback.updated'))
      setSubmitFeedback({ type: 'success', message: t('security.feedback.updated') })
      regularForm.clearErrors()
      regularForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error) {
      const message = translatePasswordError(
        error instanceof Error ? error.message : null,
        t,
        t('security.feedback.updateError'),
      )
      toast.error(message)
      setSubmitFeedback({ type: 'error', message })
    }
  })

  const onSubmitFirstLogin = firstLoginForm.handleSubmit(async (values) => {
    setSubmitFeedback(null)

    try {
      await authService.setPasswordOnFirstLogin({
        newPassword: values.newPassword,
      })
      await refreshAuthState()

      toast.success(t('security.feedback.set'))
      setSubmitFeedback({ type: 'success', message: t('security.feedback.set') })
      firstLoginForm.clearErrors()
      firstLoginForm.reset({
        newPassword: '',
        confirmNewPassword: '',
      })

      const fallbackRoute =
        role === APP_ROLES.PAYROLL_AGENT ? ROUTES.PAYROLL_DASHBOARD : ROUTES.EMPLOYEE_PROFILE
      const currentSecurityRoute =
        role === APP_ROLES.PAYROLL_AGENT ? ROUTES.PAYROLL_SECURITY : ROUTES.EMPLOYEE_SECURITY
      const nextRoute =
        locationState?.from?.pathname &&
        locationState.from.pathname !== currentSecurityRoute
          ? locationState.from.pathname
          : fallbackRoute

      navigate(nextRoute, { replace: true })
    } catch (error) {
      const message = translatePasswordError(
        error instanceof Error ? error.message : null,
        t,
        t('security.feedback.setError'),
      )
      toast.error(message)
      setSubmitFeedback({ type: 'error', message })
    }
  })

  const isSubmitting = mustChangePassword
    ? firstLoginForm.formState.isSubmitting
    : regularForm.formState.isSubmitting

  const isValidAndDirty = mustChangePassword
    ? firstLoginForm.formState.isValid && firstLoginForm.formState.isDirty
    : regularForm.formState.isValid && regularForm.formState.isDirty

  const toggleVisibility = (key: PasswordFieldKey) => {
    setShowPassword((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  const effectiveTitle = title ?? t('security.title')
  const effectiveDescription =
    description ??
    (mustChangePassword
      ? t('security.firstLoginDescription')
      : t('security.changePasswordDescription'))

  return (
    <Card id={anchorId} className={cn(SURFACE_CARD_CLASS_NAME, className)}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{effectiveTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{effectiveDescription}</p>
        <p className="text-xs text-muted-foreground">
          {t('security.passwordHint')}
        </p>
      </CardHeader>
      <CardContent>
        {submitFeedback ? (
          <Alert
            variant={submitFeedback.type === 'error' ? 'destructive' : 'default'}
            className="mb-4"
          >
            <AlertTitle>
              {submitFeedback.type === 'success'
                ? t('common.success')
                : t('security.feedback.couldNotUpdateTitle')}
            </AlertTitle>
            <AlertDescription>{submitFeedback.message}</AlertDescription>
          </Alert>
        ) : null}

        {mustChangePassword ? (
          <form className="space-y-4" onSubmit={onSubmitFirstLogin}>
            <PasswordField
              id="newPassword"
              label={t('security.fields.newPassword')}
              error={firstLoginForm.formState.errors.newPassword?.message}
              inputType={showPassword.newPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('newPassword')}
              isVisible={showPassword.newPassword}
              registration={firstLoginForm.register('newPassword')}
              isRTL={isRTL}
              showPasswordLabel={t('common.showPassword')}
              hidePasswordLabel={t('common.hidePassword')}
            />

            <PasswordField
              id="confirmNewPassword"
              label={t('security.fields.confirmNewPassword')}
              error={firstLoginForm.formState.errors.confirmNewPassword?.message}
              inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
              isVisible={showPassword.confirmNewPassword}
              registration={firstLoginForm.register('confirmNewPassword')}
              isRTL={isRTL}
              showPasswordLabel={t('common.showPassword')}
              hidePasswordLabel={t('common.hidePassword')}
            />

            <Button
              type="submit"
              disabled={isSubmitting || !isValidAndDirty}
              className={cn('w-full', BRAND_BUTTON_CLASS_NAME)}
            >
              {isSubmitting ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <KeyRound className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {isSubmitting ? t('security.updating') : t('actions.changePassword')}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onSubmitRegular}>
            <PasswordField
              id="currentPassword"
              label={t('security.fields.currentPassword')}
              error={regularForm.formState.errors.currentPassword?.message}
              inputType={showPassword.currentPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('currentPassword')}
              isVisible={showPassword.currentPassword}
              registration={regularForm.register('currentPassword')}
              isRTL={isRTL}
              showPasswordLabel={t('common.showPassword')}
              hidePasswordLabel={t('common.hidePassword')}
            />

            <PasswordField
              id="newPassword"
              label={t('security.fields.newPassword')}
              error={regularForm.formState.errors.newPassword?.message}
              inputType={showPassword.newPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('newPassword')}
              isVisible={showPassword.newPassword}
              registration={regularForm.register('newPassword')}
              isRTL={isRTL}
              showPasswordLabel={t('common.showPassword')}
              hidePasswordLabel={t('common.hidePassword')}
            />

            <PasswordField
              id="confirmNewPassword"
              label={t('security.fields.confirmNewPassword')}
              error={regularForm.formState.errors.confirmNewPassword?.message}
              inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
              isVisible={showPassword.confirmNewPassword}
              registration={regularForm.register('confirmNewPassword')}
              isRTL={isRTL}
              showPasswordLabel={t('common.showPassword')}
              hidePasswordLabel={t('common.hidePassword')}
            />

            <Button
              type="submit"
              disabled={isSubmitting || !isValidAndDirty}
              className={cn('w-full', BRAND_BUTTON_CLASS_NAME)}
            >
              {isSubmitting ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <KeyRound className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {isSubmitting ? t('security.updating') : t('actions.changePassword')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  error?: string
  inputType: 'text' | 'password'
  isSubmitting: boolean
  isRTL: boolean
  isVisible: boolean
  hidePasswordLabel: string
  onToggleVisibility: () => void
  registration: UseFormRegisterReturn
  showPasswordLabel: string
}

function PasswordField({
  id,
  label,
  error,
  inputType,
  isSubmitting,
  isRTL,
  isVisible,
  hidePasswordLabel,
  onToggleVisibility,
  registration,
  showPasswordLabel,
}: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={inputType} disabled={isSubmitting} {...registration} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('absolute top-1 h-8 w-8', isRTL ? 'left-1' : 'right-1')}
          disabled={isSubmitting}
          onClick={onToggleVisibility}
          aria-label={isVisible ? hidePasswordLabel : showPasswordLabel}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function translatePasswordError(
  message: string | null,
  t: ReturnType<typeof useI18n>['t'],
  fallbackMessage: string,
) {
  if (!message) {
    return fallbackMessage
  }

  switch (message) {
    case 'This account does not have an email address. Contact an administrator.':
      return t('security.feedback.noAccountEmail')
    case 'Current password is incorrect.':
      return t('security.feedback.incorrectCurrentPassword')
    case 'Please sign in again and retry changing your password.':
      return t('security.feedback.sessionRetry')
    case 'Session expired. Please sign in again from your invite link.':
      return t('security.feedback.firstLoginExpired')
    case 'Password updated, but session refresh failed. Please sign in again.':
      return t('security.feedback.sessionRefreshFailed')
    case 'Unable to finalize password change.':
      return t('security.feedback.finalizeChangeFailed')
    default:
      return message
  }
}
