import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'

export function useRecoveryRoute() {
  const navigate = useNavigate()
  const { role, user, isLoading } = useAuth()
  const { t } = useI18n()

  const recoveryRoute = useMemo(() => {
    if (isLoading) {
      return ROUTES.ROOT
    }

    if (role === APP_ROLES.ADMIN_RH) {
      return ROUTES.ADMIN_DASHBOARD
    }

    if (role === APP_ROLES.EMPLOYE) {
      return ROUTES.EMPLOYEE_PROFILE
    }

    if (role === APP_ROLES.PAYROLL_AGENT) {
      return ROUTES.PAYROLL_DASHBOARD
    }

    return ROUTES.LOGIN
  }, [isLoading, role])

  const primaryActionLabel = user
    ? t('actions.goToDashboard')
    : t('actions.goToLogin')

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(recoveryRoute, { replace: true })
  }

  return {
    recoveryRoute,
    primaryActionLabel,
    goBack,
  }
}
