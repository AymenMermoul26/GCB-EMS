import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { type UseFormRegisterReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/schemas/changePasswordSchema'
import { authService } from '@/services/auth'
import { cn } from '@/lib/utils'

interface ChangePasswordCardProps {
  className?: string
  title?: string
  description?: string
}

type PasswordFieldKey = 'currentPassword' | 'newPassword' | 'confirmNewPassword'

export function ChangePasswordCard({
  className,
  title = 'Security',
  description = 'Change your account password.',
}: ChangePasswordCardProps) {
  const [showPassword, setShowPassword] = useState<Record<PasswordFieldKey, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  })

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authService.changePasswordWithReauth({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })

      toast.success('Password updated successfully')
      form.clearErrors()
      form.reset({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update password')
    }
  })

  const isSubmitting = form.formState.isSubmitting

  const toggleVisibility = (key: PasswordFieldKey) => {
    setShowPassword((previous) => ({
      ...previous,
      [key]: !previous[key],
    }))
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <PasswordField
            id="currentPassword"
            label="Current password"
            error={form.formState.errors.currentPassword?.message}
            inputType={showPassword.currentPassword ? 'text' : 'password'}
            isSubmitting={isSubmitting}
            onToggleVisibility={() => toggleVisibility('currentPassword')}
            isVisible={showPassword.currentPassword}
            registration={form.register('currentPassword')}
          />

          <PasswordField
            id="newPassword"
            label="New password"
            error={form.formState.errors.newPassword?.message}
            inputType={showPassword.newPassword ? 'text' : 'password'}
            isSubmitting={isSubmitting}
            onToggleVisibility={() => toggleVisibility('newPassword')}
            isVisible={showPassword.newPassword}
            registration={form.register('newPassword')}
          />

          <PasswordField
            id="confirmNewPassword"
            label="Confirm new password"
            error={form.formState.errors.confirmNewPassword?.message}
            inputType={showPassword.confirmNewPassword ? 'text' : 'password'}
            isSubmitting={isSubmitting}
            onToggleVisibility={() => toggleVisibility('confirmNewPassword')}
            isVisible={showPassword.confirmNewPassword}
            registration={form.register('confirmNewPassword')}
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
