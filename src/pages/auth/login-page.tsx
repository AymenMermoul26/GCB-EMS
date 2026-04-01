import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import { createLoginSchema, type LoginInput } from '@/schemas/auth/login.schema'

import {
  DEFAULT_LOGIN_ROLE_ID,
  getLoginRoleConfig,
  getLoginRoleConfigs,
  getLoginTrustMarkers,
  type LoginExperienceRoleId,
} from './login-role-config'

interface LocationState {
  from?: {
    pathname?: string
  }
  authNotice?: {
    type: 'success' | 'info'
    message: string
  }
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (matches: boolean) => {
      setPrefersReducedMotion(matches)
    }

    updatePreference(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      updatePreference(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const { user, role, signIn } = useAuth()
  const { direction, isRTL, t } = useI18n()
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRoleId, setSelectedRoleId] =
    useState<LoginExperienceRoleId>(DEFAULT_LOGIN_ROLE_ID)
  const [displayedRoleId, setDisplayedRoleId] =
    useState<LoginExperienceRoleId>(DEFAULT_LOGIN_ROLE_ID)
  const prefersReducedMotion = usePrefersReducedMotion()
  const loginRoleConfigs = useMemo(() => getLoginRoleConfigs(t), [t])
  const loginTrustMarkers = useMemo(() => getLoginTrustMarkers(t), [t])
  const loginSchema = useMemo(() => createLoginSchema(t), [t])

  const selectedRole = getLoginRoleConfig(selectedRoleId, t)
  const displayedRole = getLoginRoleConfig(
    prefersReducedMotion ? selectedRoleId : displayedRoleId,
    t,
  )
  const isRoleTransitioning = !prefersReducedMotion && selectedRoleId !== displayedRoleId

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

    if (role === APP_ROLES.PAYROLL_AGENT) {
      navigate(ROUTES.PAYROLL_DASHBOARD, { replace: true })
      return
    }

    navigate(ROUTES.EMPLOYEE_PROFILE, { replace: true })
  }, [navigate, role, user])

  useEffect(() => {
    if (selectedRoleId === displayedRoleId || prefersReducedMotion) {
      return
    }

    const timer = window.setTimeout(() => {
      setDisplayedRoleId(selectedRoleId)
    }, 160)

    return () => {
      window.clearTimeout(timer)
    }
  }, [displayedRoleId, prefersReducedMotion, selectedRoleId])

  useEffect(() => {
    const normalizedCurrentEmail = form.getValues('email').trim().toLowerCase()
    const presetEmails = loginRoleConfigs.map((roleConfig) =>
      roleConfig.defaultEmail?.toLowerCase(),
    ).filter((email): email is string => Boolean(email))

    if (selectedRole.defaultEmail) {
      const normalizedPresetEmail = selectedRole.defaultEmail.toLowerCase()

      if (normalizedCurrentEmail !== normalizedPresetEmail) {
        form.setValue('email', selectedRole.defaultEmail, { shouldDirty: true })
        form.clearErrors('email')
      }

      return
    }

    if (presetEmails.includes(normalizedCurrentEmail)) {
      form.setValue('email', '', { shouldDirty: true })
      form.clearErrors('email')
    }
  }, [form, loginRoleConfigs, selectedRole])

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

      if (roleInfo.role === APP_ROLES.PAYROLL_AGENT) {
        navigate(ROUTES.PAYROLL_DASHBOARD, { replace: true })
        return
      }

      navigate(ROUTES.EMPLOYEE_PROFILE, { replace: true })
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    await signInMutation.mutateAsync(values)
  })

  const ShowcaseIcon = displayedRole.heroIcon
  const SelectedRoleIcon = selectedRole.roleIcon

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden bg-slate-950"
      dir={direction}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[92rem] box-border items-center px-4 py-4 sm:px-6 lg:px-8 [@media(min-width:1024px)_and_(max-height:860px)]:py-3 [@media(min-width:1024px)_and_(max-height:760px)]:py-2">
        <div
          className={cn(
            'absolute top-4 z-20',
            isRTL ? 'left-4 sm:left-6 lg:left-8' : 'right-4 sm:right-6 lg:right-8',
          )}
        >
          <LanguageSwitcher variant="auth" />
        </div>
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:items-center [@media(min-width:1024px)_and_(max-height:860px)]:gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:gap-2.5">
          <section className="order-1 lg:order-1">
            <div className="relative lg:w-full">
              <div
                className={cn(
                  'absolute inset-0 rounded-[28px] blur-2xl transition-all duration-500 motion-reduce:transition-none',
                  selectedRole.theme.formHaloClass,
                )}
              />
              <Card className="relative border-white/70 bg-white/92 shadow-[0_30px_90px_-46px_rgba(15,23,42,0.75)] backdrop-blur-xl [@media(min-width:1024px)_and_(max-height:860px)]:rounded-[26px]">
                <CardHeader className="space-y-3 pb-2 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-2.5 [@media(min-width:1024px)_and_(max-height:860px)]:p-5 [@media(min-width:1024px)_and_(max-height:860px)]:pb-2 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-2 [@media(min-width:1024px)_and_(max-height:760px)]:p-4 [@media(min-width:1024px)_and_(max-height:760px)]:pb-1.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={gcbLogo}
                      alt={t('common.appSystemName')}
                      className="h-10 w-10 rounded-xl object-cover [@media(min-width:1024px)_and_(max-height:760px)]:h-9 [@media(min-width:1024px)_and_(max-height:760px)]:w-9"
                    />
                    <div className="space-y-1">
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 [@media(min-width:1024px)_and_(max-height:760px)]:px-2 [@media(min-width:1024px)_and_(max-height:760px)]:py-0.5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[10px]"
                      >
                        {t('common.secureAccess')}
                      </Badge>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 [@media(min-width:1024px)_and_(max-height:760px)]:text-[11px]">
                        {t('common.appSystemName')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <CardTitle className="text-[1.82rem] tracking-tight text-slate-950 sm:text-[2rem] [@media(min-width:1024px)_and_(max-height:860px)]:text-[1.7rem] [@media(min-width:1024px)_and_(max-height:760px)]:text-[1.55rem]">
                      {t('auth.login.title')}
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-slate-600 [@media(min-width:1024px)_and_(max-height:860px)]:leading-5.5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-5">
                      {t('auth.login.description')}
                    </CardDescription>
                  </div>

                  <div className="space-y-3 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('common.workspacePreview')}
                      </Label>
                      <span className="text-xs text-slate-500">
                        {t('common.roleAwareExperience')}
                      </span>
                    </div>

                    <Tabs
                      value={selectedRoleId}
                      onValueChange={(value) => setSelectedRoleId(value as LoginExperienceRoleId)}
                    >
                      <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl border border-slate-200/90 bg-slate-100/95 p-1 [@media(min-width:1024px)_and_(max-height:760px)]:rounded-xl">
                        {loginRoleConfigs.map((roleConfig) => {
                          const RoleIcon = roleConfig.roleIcon

                          return (
                            <TabsTrigger
                              key={roleConfig.id}
                              value={roleConfig.id}
                              className={cn(
                                'h-auto flex-col items-start gap-1 rounded-xl border border-transparent px-3 py-2 text-left text-slate-600 transition-all duration-300 [@media(min-width:1024px)_and_(max-height:860px)]:px-2.5 [@media(min-width:1024px)_and_(max-height:860px)]:py-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:gap-0.5',
                                'motion-reduce:transition-none',
                                isRTL && 'items-end text-right',
                                selectedRole.theme.selectorActiveClass,
                              )}
                            >
                              <span
                                className={cn(
                                  'flex items-center gap-2 text-xs font-semibold sm:text-sm',
                                  isRTL && 'flex-row-reverse',
                                )}
                              >
                                <RoleIcon className="h-4 w-4" />
                                {roleConfig.label}
                              </span>
                            </TabsTrigger>
                          )
                        })}
                      </TabsList>
                    </Tabs>

                    <div
                      className={cn(
                        'rounded-2xl border px-4 py-3 transition-colors duration-300 motion-reduce:transition-none [@media(min-width:1024px)_and_(max-height:860px)]:px-3.5 [@media(min-width:1024px)_and_(max-height:860px)]:py-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:rounded-xl [@media(min-width:1024px)_and_(max-height:760px)]:px-3 [@media(min-width:1024px)_and_(max-height:760px)]:py-2',
                        selectedRole.theme.selectorBorderClass,
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className={cn('space-y-2', isRTL && 'text-right')}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                                selectedRole.theme.selectorBadgeClass,
                              )}
                            >
                              {selectedRole.label}
                            </Badge>
                            <p className="text-sm font-semibold text-slate-900">
                              {selectedRole.badge}
                            </p>
                          </div>
                          <p className="text-sm leading-6 text-slate-600 [@media(min-width:1024px)_and_(max-height:860px)]:leading-5.5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-5">
                            {selectedRole.helper}
                          </p>
                        </div>

                        <div
                          className={cn(
                            'hidden rounded-2xl border p-2.5 sm:block',
                            selectedRole.theme.formHighlightClass,
                          )}
                        >
                          <SelectedRoleIcon className="h-4 w-4 text-slate-900" />
                        </div>
                      </div>

                      <div className="mt-3 hidden 2xl:flex 2xl:flex-wrap 2xl:gap-2 [@media(min-width:1024px)_and_(max-height:860px)]:hidden">
                        {selectedRole.featureHighlights.map((feature) => (
                          <span
                            key={`${selectedRole.id}-${feature.label}-selector`}
                            className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600"
                          >
                            {feature.label}
                          </span>
                        ))}
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500 [@media(min-width:1024px)_and_(max-height:860px)]:mt-2.5 [@media(min-width:1024px)_and_(max-height:860px)]:leading-4.5 [@media(min-width:1024px)_and_(max-height:760px)]:hidden">
                        {t('auth.login.selectorNotice')}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3.5 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-3 [@media(min-width:1024px)_and_(max-height:860px)]:px-5 [@media(min-width:1024px)_and_(max-height:860px)]:pb-5 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:px-4 [@media(min-width:1024px)_and_(max-height:760px)]:pb-4">
                  {state?.authNotice ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    >
                      {state.authNotice.message}
                    </div>
                  ) : null}

                  {signInMutation.error ? (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {signInMutation.error.message}
                    </div>
                  ) : null}

                  <form className="space-y-3.5 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-3 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-2.5" onSubmit={onSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('common.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder={t('auth.login.emailPlaceholder')}
                        className="h-11 rounded-xl border-slate-200 bg-white/90 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0 [@media(min-width:1024px)_and_(max-height:860px)]:h-10 [@media(min-width:1024px)_and_(max-height:760px)]:h-9"
                        {...form.register('email')}
                      />
                      {form.formState.errors.email ? (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.email.message}
                        </p>
                      ) : null}
                      {selectedRole.defaultEmail ? (
                        <p className="text-xs text-slate-500 [@media(min-width:1024px)_and_(max-height:760px)]:hidden">
                          {t('auth.login.selectorPrefill', {
                            email: selectedRole.defaultEmail,
                          })}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">{t('common.password')}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder={t('auth.login.passwordPlaceholder')}
                          className={cn(
                            'h-11 rounded-xl border-slate-200 bg-white/90 focus-visible:ring-[rgb(var(--brand-primary))/0.4] focus-visible:ring-offset-0 [@media(min-width:1024px)_and_(max-height:860px)]:h-10 [@media(min-width:1024px)_and_(max-height:760px)]:h-9',
                            isRTL ? 'pl-11' : 'pr-11',
                          )}
                          {...form.register('password')}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute top-1 h-9 w-9 text-slate-500 hover:bg-transparent hover:text-slate-800 [@media(min-width:1024px)_and_(max-height:860px)]:h-8 [@media(min-width:1024px)_and_(max-height:860px)]:w-8 [@media(min-width:1024px)_and_(max-height:760px)]:top-0.5 [@media(min-width:1024px)_and_(max-height:760px)]:h-8 [@media(min-width:1024px)_and_(max-height:760px)]:w-8',
                            isRTL ? 'left-1' : 'right-1',
                          )}
                          onClick={() => setShowPassword((previous) => !previous)}
                          aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {form.formState.errors.password ? (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.password.message}
                        </p>
                      ) : null}

                      <div className={cn('flex', isRTL ? 'justify-start' : 'justify-end')}>
                        <Button
                          asChild
                          type="button"
                          variant="link"
                          className="h-auto px-0 text-sm font-medium text-[#ff6b35]"
                        >
                          <Link to={ROUTES.FORGOT_PASSWORD}>{t('auth.login.forgotPassword')}</Link>
                        </Button>
                      </div>
                    </div>

                    <Button
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-[#f97316] via-[#ea580c] to-[#d97706] font-semibold text-white shadow-lg shadow-orange-400/35 hover:opacity-95 focus-visible:ring-[rgb(var(--brand-primary))/0.45] focus-visible:ring-offset-0 [@media(min-width:1024px)_and_(max-height:860px)]:h-10 [@media(min-width:1024px)_and_(max-height:760px)]:h-9"
                      type="submit"
                      disabled={signInMutation.isPending}
                    >
                      {signInMutation.isPending ? (
                        <>
                          <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                          {t('auth.login.signingIn')}
                        </>
                      ) : (
                        t('common.signIn')
                      )}
                    </Button>
                  </form>

                  <Separator />

                  <div className="space-y-2.5 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-2 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-1.5">
                    <p className="text-center text-xs leading-5 text-muted-foreground [@media(min-width:1024px)_and_(max-height:760px)]:leading-4">
                      {t('auth.login.supportedRoles')}
                    </p>

                    <div className="hidden 2xl:flex 2xl:flex-wrap 2xl:justify-center 2xl:gap-2 [@media(min-width:1024px)_and_(max-height:860px)]:hidden">
                      {loginTrustMarkers.map((marker) => {
                        const MarkerIcon = marker.icon

                        return (
                          <div
                            key={marker.label}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600"
                          >
                            <MarkerIcon className="h-3.5 w-3.5" />
                            <span>{marker.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="order-2 lg:order-2">
            <article className="relative min-h-[320px] overflow-hidden rounded-[32px] border border-white/10 shadow-[0_36px_120px_-54px_rgba(15,23,42,0.95)] [@media(min-width:1024px)_and_(max-height:860px)]:min-h-[300px] [@media(min-width:1024px)_and_(max-height:760px)]:min-h-[280px]">
              <div
                className={cn(
                  'absolute inset-0 transition-all duration-500 motion-reduce:transition-none',
                  selectedRole.theme.heroGradientClass,
                )}
              />
              <div
                className={cn(
                  'absolute inset-0 opacity-100 transition-all duration-500 motion-reduce:transition-none',
                  selectedRole.theme.glowClass,
                )}
              />
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_30%,rgba(255,255,255,0.03))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_20%)]" />

              <div className="relative z-10 flex h-full flex-col gap-5 p-5 text-white sm:p-6 xl:p-7 [@media(min-width:1024px)_and_(max-height:860px)]:gap-4 [@media(min-width:1024px)_and_(max-height:860px)]:p-4 [@media(min-width:1024px)_and_(max-height:760px)]:gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="inline-flex max-w-[440px] items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <img src={gcbLogo} alt={t('common.appSystemName')} className="h-10 w-10 rounded-xl object-cover" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                        GCB EMS
                      </p>
                      <p className="text-sm font-medium leading-5 text-white/92">
                        {t('common.companyNameFull')}
                      </p>
                    </div>
                  </div>

                  <Badge
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]',
                      displayedRole.theme.heroBadgeClass,
                    )}
                  >
                    {displayedRole.badge}
                  </Badge>
                </div>

                <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.98fr)] lg:items-center [@media(min-width:1024px)_and_(max-height:860px)]:gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:gap-2.5">
                  <div
                    className={cn(
                      'space-y-5 transition-all duration-200 motion-reduce:transition-none',
                      isRoleTransitioning ? 'translate-y-3 opacity-0' : 'translate-y-0 opacity-100',
                    )}
                  >
                    <div className="space-y-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/62">
                        {t('auth.login.roleAwareTitle')}
                      </p>
                      <h1 className="max-w-2xl text-[1.95rem] font-semibold leading-tight sm:text-[2.2rem] xl:text-[2.6rem] xl:leading-[1.06] [@media(min-width:1024px)_and_(max-height:860px)]:text-[1.75rem] [@media(min-width:1024px)_and_(max-height:860px)]:leading-tight [@media(min-width:1024px)_and_(max-height:760px)]:text-[1.55rem]">
                        {displayedRole.title}
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-white/78 sm:text-base [@media(min-width:1024px)_and_(max-height:860px)]:leading-6 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-5">
                        {displayedRole.description}
                      </p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-1 [@media(min-width:1024px)_and_(max-height:860px)]:gap-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:gap-1.5">
                      {displayedRole.featureHighlights.map((feature) => {
                        const FeatureIcon = feature.icon

                        return (
                          <div
                            key={feature.label}
                            className={cn(
                              'rounded-2xl border px-4 py-3 backdrop-blur-md transition-all duration-300 [@media(min-width:1024px)_and_(max-height:860px)]:px-3 [@media(min-width:1024px)_and_(max-height:860px)]:py-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:rounded-xl [@media(min-width:1024px)_and_(max-height:760px)]:px-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:py-2',
                              displayedRole.theme.previewCardClass,
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'rounded-2xl border p-2.5 backdrop-blur-md',
                                  displayedRole.theme.iconSurfaceClass,
                                )}
                              >
                                <FeatureIcon className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-white">{feature.label}</p>
                                <p className="text-sm leading-6 text-white/70 [@media(min-width:1024px)_and_(max-height:860px)]:leading-5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-4.5">
                                  {feature.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'transition-all duration-200 motion-reduce:transition-none',
                      isRoleTransitioning ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-[28px] border p-4 transition-all duration-500 backdrop-blur-xl [@media(min-width:1024px)_and_(max-height:860px)]:p-3.5 [@media(min-width:1024px)_and_(max-height:760px)]:rounded-[24px] [@media(min-width:1024px)_and_(max-height:760px)]:p-3',
                        displayedRole.theme.previewCardClass,
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                            Workspace preview
                          </p>
                          <h2 className="text-2xl font-semibold text-white [@media(min-width:1024px)_and_(max-height:860px)]:text-xl [@media(min-width:1024px)_and_(max-height:760px)]:text-lg">
                            {displayedRole.visualTitle}
                          </h2>
                          <p className="text-sm leading-6 text-white/72 [@media(min-width:1024px)_and_(max-height:860px)]:leading-5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-4.5">
                            {displayedRole.visualDescription}
                          </p>
                        </div>

                        <div
                          className={cn(
                            'rounded-[22px] border p-3 backdrop-blur-md',
                            displayedRole.theme.iconSurfaceClass,
                          )}
                        >
                          <ShowcaseIcon className="h-7 w-7" />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 lg:grid-cols-3 2xl:grid-cols-1 [@media(min-width:1024px)_and_(max-height:860px)]:mt-3 [@media(min-width:1024px)_and_(max-height:860px)]:gap-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:mt-2.5">
                        {displayedRole.previewPanels.map((panel, index) => {
                          const PanelIcon = panel.icon

                          return (
                            <div
                              key={`${displayedRole.id}-${panel.label}`}
                              className={cn(
                                'rounded-2xl border p-3 backdrop-blur-md transition-all duration-500 [@media(min-width:1024px)_and_(max-height:860px)]:rounded-xl [@media(min-width:1024px)_and_(max-height:860px)]:p-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:p-2',
                                index === 0
                                  ? displayedRole.theme.previewPanelStrongClass
                                  : displayedRole.theme.previewPanelSoftClass,
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'rounded-2xl border p-2.5 backdrop-blur-md',
                                    displayedRole.theme.iconSurfaceClass,
                                  )}
                                >
                                  <PanelIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/58">
                                      {panel.label}
                                    </p>
                                    <p className="text-sm font-semibold text-white">
                                      {panel.value}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold text-white">{panel.title}</p>
                                  <p className="text-sm leading-5 text-white/70 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-4.5">
                                    {panel.detail}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="mt-2.5 grid gap-2 sm:grid-cols-3 [@media(min-width:1024px)_and_(max-height:860px)]:mt-2 [@media(min-width:1024px)_and_(max-height:860px)]:gap-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:hidden">
                        {displayedRole.metrics.map((metric) => (
                          <div
                            key={metric.label}
                            className={cn(
                              'rounded-2xl border px-4 py-3.5 backdrop-blur-md transition-all duration-500',
                              displayedRole.theme.metricSurfaceClass,
                            )}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                              {metric.label}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-white">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2.5 hidden xl:flex xl:flex-wrap xl:gap-2 [@media(min-width:1024px)_and_(max-height:860px)]:mt-2 [@media(min-width:1024px)_and_(max-height:860px)]:gap-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:hidden">
                      {displayedRole.featureHighlights.map((feature) => (
                        <div
                          key={`${displayedRole.id}-${feature.label}-chip`}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors duration-500',
                            displayedRole.theme.featureChipClass,
                          )}
                        >
                          {feature.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                  <div className="hidden xl:flex xl:flex-wrap xl:gap-2 xl:text-xs xl:text-white/70 [@media(min-width:1024px)_and_(max-height:860px)]:hidden">
                    <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-md">
                      {t('auth.login.unifiedAuth')}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-md">
                      {t('auth.login.secureFlows')}
                    </div>
                  </div>
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  )
}
