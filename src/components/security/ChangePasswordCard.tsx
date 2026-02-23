import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { type UseFormRegisterReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'

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
  const [showPassword, setShowPassword] = useState<Record<PasswordFieldKey, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  })

  const regularForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const firstLoginForm = useForm<FirstLoginSetPasswordFormValues>({
    resolver: zodResolver(firstLoginSetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const onSubmitRegular = regularForm.handleSubmit(async (values) => {
    try {
      await authService.changePasswordWithReauth({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      await refreshAuthState()

      toast.success('Password updated successfully')
      regularForm.clearErrors()
      regularForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password')
    }
  })

  const onSubmitFirstLogin = firstLoginForm.handleSubmit(async (values) => {
    try {
      await authService.setPasswordOnFirstLogin({
        newPassword: values.newPassword,
      })
      await refreshAuthState()

      toast.success('Password set successfully')
      firstLoginForm.clearErrors()
      firstLoginForm.reset({
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to set password')
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
      </CardHeader>
      <CardContent>
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

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Setting password...' : 'Set password'}
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

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Updating password...' : 'Change password'}
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
