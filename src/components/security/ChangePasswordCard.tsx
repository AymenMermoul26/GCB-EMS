import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { type UseFormRegisterReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
  firstLoginSetPasswordSchema,
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

export function ChangePasswordCard({
  className,
  title,
  description,
  anchorId,
}: ChangePasswordCardProps) {
  const { refreshAuthState, mustChangePassword } = useAuth()
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [showPassword, setShowPassword] = useState<Record<PasswordFieldKey, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  })

  const regularForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const firstLoginForm = useForm<FirstLoginSetPasswordFormValues>({
    resolver: zodResolver(firstLoginSetPasswordSchema),
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

      toast.success('Password updated successfully')
      setSubmitFeedback({ type: 'success', message: 'Password updated successfully.' })
      regularForm.clearErrors()
      regularForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update password'
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

      toast.success('Password set successfully')
      setSubmitFeedback({ type: 'success', message: 'Password set successfully.' })
      firstLoginForm.clearErrors()
      firstLoginForm.reset({
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to set password'
      toast.error(message)
      setSubmitFeedback({ type: 'error', message })
    }
  })

  const isSubmitting = mustChangePassword
    ? firstLoginForm.formState.isSubmitting
    : regularForm.formState.isSubmitting

  const effectiveTitle = title ?? 'Security'
  const effectiveDescription =
    description ??
    (mustChangePassword
      ? 'First login detected. Set a strong password before continuing.'
      : 'Change your account password.')

  const isValidAndDirty = mustChangePassword
    ? firstLoginForm.formState.isValid && firstLoginForm.formState.isDirty
    : regularForm.formState.isValid && regularForm.formState.isDirty

  const toggleVisibility = (key: PasswordFieldKey) => {
    setShowPassword((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  return (
    <Card id={anchorId} className={cn(className)}>
      <CardHeader>
        <CardTitle>{effectiveTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{effectiveDescription}</p>
        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters and different from your current password.
        </p>
      </CardHeader>
      <CardContent>
        {submitFeedback ? (
          <Alert
            variant={submitFeedback.type === 'error' ? 'destructive' : 'default'}
            className="mb-4"
          >
            <AlertTitle>
              {submitFeedback.type === 'success' ? 'Success' : 'Could not update password'}
            </AlertTitle>
            <AlertDescription>{submitFeedback.message}</AlertDescription>
          </Alert>
        ) : null}

        {mustChangePassword ? (
          <form className="space-y-4" onSubmit={onSubmitFirstLogin}>
            <PasswordField
              id="newPassword"
              label="New password"
              error={firstLoginForm.formState.errors.newPassword?.message}
              inputType={showPassword.newPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('newPassword')}
              isVisible={showPassword.newPassword}
              registration={firstLoginForm.register('newPassword')}
            />

            <PasswordField
              id="confirmNewPassword"
              label="Confirm new password"
              error={firstLoginForm.formState.errors.confirmNewPassword?.message}
              inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
              isVisible={showPassword.confirmNewPassword}
              registration={firstLoginForm.register('confirmNewPassword')}
            />

            <Button
              type="submit"
              disabled={isSubmitting || !isValidAndDirty}
              className="w-full border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onSubmitRegular}>
            <PasswordField
              id="currentPassword"
              label="Current password"
              error={regularForm.formState.errors.currentPassword?.message}
              inputType={showPassword.currentPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('currentPassword')}
              isVisible={showPassword.currentPassword}
              registration={regularForm.register('currentPassword')}
            />

            <PasswordField
              id="newPassword"
              label="New password"
              error={regularForm.formState.errors.newPassword?.message}
              inputType={showPassword.newPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('newPassword')}
              isVisible={showPassword.newPassword}
              registration={regularForm.register('newPassword')}
            />

            <PasswordField
              id="confirmNewPassword"
              label="Confirm new password"
              error={regularForm.formState.errors.confirmNewPassword?.message}
              inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
              isSubmitting={isSubmitting}
              onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
              isVisible={showPassword.confirmNewPassword}
              registration={regularForm.register('confirmNewPassword')}
            />

            <Button
              type="submit"
              disabled={isSubmitting || !isValidAndDirty}
              className="w-full border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Updating...' : 'Update Password'}
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
        <Input id={id} type={inputType} disabled={isSubmitting} {...registration} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-8 w-8"
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
