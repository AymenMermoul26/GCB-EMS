import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { AuthLayout } from '@/layouts/auth-layout'
import { loginSchema, type LoginInput } from '@/schemas/auth/login.schema'

interface LocationState {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const { user, role, signIn } = useAuth()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    if (!user || !role) {
      return
    }

    if (role === APP_ROLES.ADMIN_RH) {
      navigate(ROUTES.ADMIN_EMPLOYEES, { replace: true })
      return
    }

    navigate(ROUTES.EMPLOYEE_PROFILE, { replace: true })
  }, [navigate, role, user])

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (roleInfo) => {
      const from = state?.from?.pathname

      if (from && from !== ROUTES.LOGIN) {
        navigate(from, { replace: true })
        return
      }

      if (roleInfo.role === APP_ROLES.ADMIN_RH) {
        navigate(ROUTES.ADMIN_EMPLOYEES, { replace: true })
        return
      }

      navigate(ROUTES.EMPLOYEE_PROFILE, { replace: true })
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    await signInMutation.mutateAsync(values)
  })

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to EMS</CardTitle>
          <CardDescription>
            Use your company credentials to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="********"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {signInMutation.error ? (
              <p className="text-sm text-destructive">{signInMutation.error.message}</p>
            ) : null}

            <Button className="w-full" type="submit" disabled={signInMutation.isPending}>
              {signInMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Roles supported: Admin RH and Employee.
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
