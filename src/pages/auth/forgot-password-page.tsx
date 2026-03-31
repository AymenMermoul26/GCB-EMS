import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { AuthLayout } from '@/layouts/auth-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/schemas/auth/forgot-password.schema'
import { authService } from '@/services/auth'

function getForgotPasswordErrorMessage(error: Error): string {
  const normalizedMessage = error.message.toLowerCase()

  if (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('timeout')
  ) {
    return 'We could not reach the server. Check your connection and try again.'
  }

  return 'We could not submit your password reset request right now. Please try again in a moment.'
}

export function ForgotPasswordPage() {
  const [hasSubmitted, setHasSubmitted] = useState(false)

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
      badge="Account recovery"
      title="Forgot Password"
      description="Enter the email address linked to your account to request a password reset."
      heroBadge="Recovery flow"
      heroTitle="Request a secure reset link without exposing account details."
      heroDescription="If the email is registered, the reset link will be sent shortly. The flow stays generic for security and clear for real users."
      heroHighlights={[
        'Security-safe messaging without account enumeration.',
        'A reset link is sent to the registered email address.',
        'Users are guided to check spam or junk folders if needed.',
      ]}
      heroIcon={MailCheck}
      theme="recovery"
    >
      {requestResetMutation.error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Unable to send reset email</AlertTitle>
          <AlertDescription>
            {getForgotPasswordErrorMessage(requestResetMutation.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      {hasSubmitted ? (
        <Alert className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-900">
          <MailCheck className="h-4 w-4" />
          <AlertTitle>Reset request received</AlertTitle>
          <AlertDescription>
            If this email is registered, you will receive a password reset link shortly.
            Please check your spam or junk folder if you do not see the email.
          </AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            disabled={requestResetMutation.isPending}
            className="h-11 rounded-xl border-slate-200 bg-white/90 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
          <p className="text-xs text-slate-500">
            Use the same email address you normally use to sign in.
          </p>
        </div>

        <p className="text-sm leading-6 text-slate-600">
          If your email is registered, you will receive a password reset link.
        </p>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95"
          disabled={requestResetMutation.isPending}
        >
          {requestResetMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending reset link...
            </>
          ) : hasSubmitted ? (
            'Send another reset link'
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>

      <Button asChild variant="outline" className="h-11 w-full rounded-xl">
        <Link to={ROUTES.LOGIN}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
      </Button>
    </AuthLayout>
  )
}
