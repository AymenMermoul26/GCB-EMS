import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { loginSchema, type LoginInput } from '@/schemas/auth/login.schema'
import gcbLogo from '@/assets/brand/gcb-logo.svg'
import loginHeroImage from '@/assets/brand/login-hero.png'

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
  const [showPassword, setShowPassword] = useState(false)
  const [isHeroImageVisible, setIsHeroImageVisible] = useState(true)

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
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative min-h-[260px] overflow-hidden lg:min-h-screen">
        {isHeroImageVisible ? (
          <img
            src={loginHeroImage}
            alt="GCB EMS Hero"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setIsHeroImageVisible(false)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1f2937] to-[#111827]">
            {/* TODO: replace src/assets/brand/login-hero.png with final branded hero image */}
          </div>
        )}

        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,107,53,0.55)] via-[rgba(255,107,53,0.22)] to-[rgba(255,201,71,0.42)]" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 text-white lg:p-10">
          <div className="inline-flex w-fit items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
            <img src={gcbLogo} alt="GCB logo" className="h-8 w-8 rounded-md object-cover" />
            <p className="text-sm font-semibold tracking-wide">GCB EMS</p>
          </div>

          <div className="max-w-md space-y-5">
            <h1 className="text-2xl font-semibold leading-tight md:text-3xl lg:text-4xl">
              Manage People. Control Access. Scan & Share.
            </h1>
            <p className="text-sm text-white/85 md:text-base">
              GCB Employee Management System
            </p>
            <p className="text-sm text-white/80 md:text-base">
              Secure access for employees and HR administration.
            </p>

            <ul className="space-y-2 text-sm text-white/90">
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#ffc947]" />
                <span>Manage employee profiles & departments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#ffc947]" />
                <span>QR public profile with visibility control</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[#ffc947]" />
                <span>Requests workflow + notifications</span>
              </li>
            </ul>
          </div>

          <p className="text-xs text-white/75">(c) GCB - Employee Management System</p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-4 py-8 lg:px-8">
        <Card className="w-full max-w-md rounded-2xl border border-slate-200/90 shadow-[0_20px_65px_-28px_rgba(2,6,23,0.45)]">
          <CardHeader className="space-y-3 pb-2">
            <div className="inline-flex items-center gap-3">
              <img src={gcbLogo} alt="GCB logo" className="h-10 w-10 rounded-lg object-cover" />
              <div>
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  Sign in to continue.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {signInMutation.error ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {signInMutation.error.message}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="rounded-xl border-slate-200 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0"
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="********"
                    className="rounded-xl border-slate-200 pr-11 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0"
                    {...form.register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8 text-slate-500 hover:bg-transparent hover:text-slate-800"
                    onClick={() => setShowPassword((previous) => !previous)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {form.formState.errors.password ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#ffc947] font-semibold text-slate-900 shadow-md shadow-orange-300/40 hover:opacity-95 focus-visible:ring-[rgb(var(--brand-primary))/0.45] focus-visible:ring-offset-0"
                type="submit"
                disabled={signInMutation.isPending}
              >
                {signInMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <Separator />

            <p className="text-center text-xs text-muted-foreground">
              Roles supported: Admin RH and Employee.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
