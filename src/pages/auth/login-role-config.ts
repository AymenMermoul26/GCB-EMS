import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CircleDot,
  CreditCard,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  QrCode,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react'

import type { TranslateFn } from '@/i18n/messages'

export type LoginExperienceRoleId = 'admin' | 'payroll' | 'employee'

interface LoginRoleFeature {
  label: string
  description: string
  icon: LucideIcon
}

interface LoginRoleMetric {
  label: string
  value: string
}

interface LoginRolePreviewPanel {
  label: string
  title: string
  value: string
  detail: string
  icon: LucideIcon
}

interface LoginRoleTheme {
  heroGradientClass: string
  glowClass: string
  selectorActiveClass: string
  selectorBorderClass: string
  selectorBadgeClass: string
  heroBadgeClass: string
  previewCardClass: string
  featureChipClass: string
  iconSurfaceClass: string
  metricSurfaceClass: string
  formHaloClass: string
  formHighlightClass: string
  previewPanelStrongClass: string
  previewPanelSoftClass: string
}

export interface LoginRoleConfig {
  id: LoginExperienceRoleId
  label: string
  defaultEmail?: string
  badge: string
  title: string
  description: string
  helper: string
  visualTitle: string
  visualDescription: string
  roleIcon: LucideIcon
  heroIcon: LucideIcon
  featureHighlights: LoginRoleFeature[]
  metrics: LoginRoleMetric[]
  previewPanels: LoginRolePreviewPanel[]
  theme: LoginRoleTheme
}

export const DEFAULT_LOGIN_ROLE_ID: LoginExperienceRoleId = 'admin'

const ROLE_THEMES: Record<LoginExperienceRoleId, LoginRoleTheme> = {
  admin: {
    heroGradientClass:
      'bg-[linear-gradient(140deg,rgba(15,23,42,0.98)_8%,rgba(88,28,10,0.96)_54%,rgba(249,115,22,0.86)_100%)]',
    glowClass:
      'bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.30),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(249,115,22,0.34),transparent_35%),radial-gradient(circle_at_70%_82%,rgba(255,255,255,0.08),transparent_28%)]',
    selectorActiveClass:
      '[data-state=active]:border-orange-500/60 [data-state=active]:bg-gradient-to-r [data-state=active]:from-orange-600 [data-state=active]:to-amber-600 [data-state=active]:text-white',
    selectorBorderClass: 'border-amber-200/70 bg-amber-50/70',
    selectorBadgeClass: 'border-amber-200/80 bg-amber-100 text-amber-900',
    heroBadgeClass:
      'border-amber-200/35 bg-amber-300/12 text-amber-50 backdrop-blur-md',
    previewCardClass:
      'border-white/12 bg-white/8 shadow-[0_24px_70px_-40px_rgba(249,115,22,0.9)]',
    featureChipClass: 'border-amber-200/25 bg-white/10 text-white/92',
    iconSurfaceClass: 'border-amber-200/25 bg-amber-300/14 text-amber-100',
    metricSurfaceClass: 'border-white/10 bg-white/10 text-white',
    formHaloClass:
      'bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.18),transparent_34%)]',
    formHighlightClass: 'border-amber-200/80 bg-amber-50/85',
    previewPanelStrongClass:
      'border-amber-200/20 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(251,191,36,0.10))]',
    previewPanelSoftClass: 'border-white/10 bg-white/8',
  },
  payroll: {
    heroGradientClass:
      'bg-[linear-gradient(140deg,rgba(2,6,23,0.98)_8%,rgba(6,78,59,0.95)_54%,rgba(20,184,166,0.82)_100%)]',
    glowClass:
      'bg-[radial-gradient(circle_at_16%_24%,rgba(45,212,191,0.24),transparent_30%),radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.30),transparent_34%),radial-gradient(circle_at_70%_84%,rgba(255,255,255,0.07),transparent_26%)]',
    selectorActiveClass:
      '[data-state=active]:border-emerald-600/60 [data-state=active]:bg-gradient-to-r [data-state=active]:from-emerald-700 [data-state=active]:to-teal-600 [data-state=active]:text-white',
    selectorBorderClass: 'border-emerald-200/70 bg-emerald-50/70',
    selectorBadgeClass: 'border-emerald-200/80 bg-emerald-100 text-emerald-900',
    heroBadgeClass:
      'border-emerald-200/30 bg-emerald-300/12 text-emerald-50 backdrop-blur-md',
    previewCardClass:
      'border-white/12 bg-white/8 shadow-[0_24px_70px_-40px_rgba(16,185,129,0.9)]',
    featureChipClass: 'border-emerald-200/20 bg-white/10 text-white/92',
    iconSurfaceClass: 'border-emerald-200/25 bg-emerald-300/14 text-emerald-100',
    metricSurfaceClass: 'border-white/10 bg-white/10 text-white',
    formHaloClass:
      'bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.14),transparent_34%)]',
    formHighlightClass: 'border-emerald-200/80 bg-emerald-50/85',
    previewPanelStrongClass:
      'border-emerald-200/20 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(45,212,191,0.08))]',
    previewPanelSoftClass: 'border-white/10 bg-white/8',
  },
  employee: {
    heroGradientClass:
      'bg-[linear-gradient(140deg,rgba(15,23,42,0.99)_8%,rgba(30,64,175,0.94)_54%,rgba(14,165,233,0.84)_100%)]',
    glowClass:
      'bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.26),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.32),transparent_34%),radial-gradient(circle_at_72%_82%,rgba(255,255,255,0.08),transparent_28%)]',
    selectorActiveClass:
      '[data-state=active]:border-sky-600/60 [data-state=active]:bg-gradient-to-r [data-state=active]:from-sky-700 [data-state=active]:to-blue-700 [data-state=active]:text-white',
    selectorBorderClass: 'border-sky-200/70 bg-sky-50/70',
    selectorBadgeClass: 'border-sky-200/80 bg-sky-100 text-sky-900',
    heroBadgeClass:
      'border-sky-200/30 bg-sky-300/12 text-sky-50 backdrop-blur-md',
    previewCardClass:
      'border-white/12 bg-white/8 shadow-[0_24px_70px_-40px_rgba(59,130,246,0.9)]',
    featureChipClass: 'border-sky-200/20 bg-white/10 text-white/92',
    iconSurfaceClass: 'border-sky-200/25 bg-sky-300/14 text-sky-100',
    metricSurfaceClass: 'border-white/10 bg-white/10 text-white',
    formHaloClass:
      'bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_34%)]',
    formHighlightClass: 'border-sky-200/80 bg-sky-50/85',
    previewPanelStrongClass:
      'border-sky-200/20 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(96,165,250,0.08))]',
    previewPanelSoftClass: 'border-white/10 bg-white/8',
  },
}

export function getLoginRoleConfigs(t: TranslateFn): LoginRoleConfig[] {
  return [
    {
      id: 'admin',
      label: t('auth.login.roles.admin.label'),
      defaultEmail: 'hrAdmin@gcb.com',
      badge: t('auth.login.roles.admin.badge'),
      title: t('auth.login.roles.admin.title'),
      description: t('auth.login.roles.admin.description'),
      helper: t('auth.login.roles.admin.helper'),
      visualTitle: t('auth.login.roles.admin.visualTitle'),
      visualDescription: t('auth.login.roles.admin.visualDescription'),
      roleIcon: BriefcaseBusiness,
      heroIcon: LayoutDashboard,
      featureHighlights: [
        {
          label: t('auth.login.roles.admin.features.approvals.label'),
          description: t('auth.login.roles.admin.features.approvals.description'),
          icon: BadgeCheck,
        },
        {
          label: t('auth.login.roles.admin.features.departments.label'),
          description: t('auth.login.roles.admin.features.departments.description'),
          icon: Building2,
        },
        {
          label: t('auth.login.roles.admin.features.reporting.label'),
          description: t('auth.login.roles.admin.features.reporting.description'),
          icon: BarChart3,
        },
      ],
      metrics: [
        { label: t('auth.login.roles.admin.metrics.approvals.label'), value: '08' },
        { label: t('auth.login.roles.admin.metrics.departments.label'), value: '12' },
        { label: t('auth.login.roles.admin.metrics.coverage.label'), value: '98%' },
      ],
      previewPanels: [
        {
          label: t('auth.login.roles.admin.panels.approvals.label'),
          title: t('auth.login.roles.admin.panels.approvals.title'),
          value: t('auth.login.roles.admin.panels.approvals.value'),
          detail: t('auth.login.roles.admin.panels.approvals.detail'),
          icon: BadgeCheck,
        },
        {
          label: t('auth.login.roles.admin.panels.departments.label'),
          title: t('auth.login.roles.admin.panels.departments.title'),
          value: t('auth.login.roles.admin.panels.departments.value'),
          detail: t('auth.login.roles.admin.panels.departments.detail'),
          icon: Building2,
        },
        {
          label: t('auth.login.roles.admin.panels.insights.label'),
          title: t('auth.login.roles.admin.panels.insights.title'),
          value: t('auth.login.roles.admin.panels.insights.value'),
          detail: t('auth.login.roles.admin.panels.insights.detail'),
          icon: BarChart3,
        },
      ],
      theme: ROLE_THEMES.admin,
    },
    {
      id: 'payroll',
      label: t('auth.login.roles.payroll.label'),
      defaultEmail: 'lina.boudiaf@gcb.com',
      badge: t('auth.login.roles.payroll.badge'),
      title: t('auth.login.roles.payroll.title'),
      description: t('auth.login.roles.payroll.description'),
      helper: t('auth.login.roles.payroll.helper'),
      visualTitle: t('auth.login.roles.payroll.visualTitle'),
      visualDescription: t('auth.login.roles.payroll.visualDescription'),
      roleIcon: WalletCards,
      heroIcon: ReceiptText,
      featureHighlights: [
        {
          label: t('auth.login.roles.payroll.features.cycle.label'),
          description: t('auth.login.roles.payroll.features.cycle.description'),
          icon: CreditCard,
        },
        {
          label: t('auth.login.roles.payroll.features.payslips.label'),
          description: t('auth.login.roles.payroll.features.payslips.description'),
          icon: ReceiptText,
        },
        {
          label: t('auth.login.roles.payroll.features.exports.label'),
          description: t('auth.login.roles.payroll.features.exports.description'),
          icon: FileSpreadsheet,
        },
      ],
      metrics: [
        { label: t('auth.login.roles.payroll.metrics.cycle.label'), value: t('auth.login.roles.payroll.metrics.cycle.value') },
        { label: t('auth.login.roles.payroll.metrics.deliveries.label'), value: '04' },
        { label: t('auth.login.roles.payroll.metrics.accuracy.label'), value: '99.9%' },
      ],
      previewPanels: [
        {
          label: t('auth.login.roles.payroll.panels.cycle.label'),
          title: t('auth.login.roles.payroll.panels.cycle.title'),
          value: t('auth.login.roles.payroll.panels.cycle.value'),
          detail: t('auth.login.roles.payroll.panels.cycle.detail'),
          icon: CreditCard,
        },
        {
          label: t('auth.login.roles.payroll.panels.payslips.label'),
          title: t('auth.login.roles.payroll.panels.payslips.title'),
          value: t('auth.login.roles.payroll.panels.payslips.value'),
          detail: t('auth.login.roles.payroll.panels.payslips.detail'),
          icon: ReceiptText,
        },
        {
          label: t('auth.login.roles.payroll.panels.exports.label'),
          title: t('auth.login.roles.payroll.panels.exports.title'),
          value: t('auth.login.roles.payroll.panels.exports.value'),
          detail: t('auth.login.roles.payroll.panels.exports.detail'),
          icon: FileSpreadsheet,
        },
      ],
      theme: ROLE_THEMES.payroll,
    },
    {
      id: 'employee',
      label: t('auth.login.roles.employee.label'),
      badge: t('auth.login.roles.employee.badge'),
      title: t('auth.login.roles.employee.title'),
      description: t('auth.login.roles.employee.description'),
      helper: t('auth.login.roles.employee.helper'),
      visualTitle: t('auth.login.roles.employee.visualTitle'),
      visualDescription: t('auth.login.roles.employee.visualDescription'),
      roleIcon: UserRound,
      heroIcon: ShieldCheck,
      featureHighlights: [
        {
          label: t('auth.login.roles.employee.features.qr.label'),
          description: t('auth.login.roles.employee.features.qr.description'),
          icon: QrCode,
        },
        {
          label: t('auth.login.roles.employee.features.requests.label'),
          description: t('auth.login.roles.employee.features.requests.description'),
          icon: FolderKanban,
        },
        {
          label: t('auth.login.roles.employee.features.records.label'),
          description: t('auth.login.roles.employee.features.records.description'),
          icon: BellRing,
        },
      ],
      metrics: [
        { label: t('auth.login.roles.employee.metrics.qr.label'), value: t('auth.login.roles.employee.metrics.qr.value') },
        { label: t('auth.login.roles.employee.metrics.requests.label'), value: '02' },
        { label: t('auth.login.roles.employee.metrics.records.label'), value: t('auth.login.roles.employee.metrics.records.value') },
      ],
      previewPanels: [
        {
          label: t('auth.login.roles.employee.panels.qr.label'),
          title: t('auth.login.roles.employee.panels.qr.title'),
          value: t('auth.login.roles.employee.panels.qr.value'),
          detail: t('auth.login.roles.employee.panels.qr.detail'),
          icon: QrCode,
        },
        {
          label: t('auth.login.roles.employee.panels.requests.label'),
          title: t('auth.login.roles.employee.panels.requests.title'),
          value: t('auth.login.roles.employee.panels.requests.value'),
          detail: t('auth.login.roles.employee.panels.requests.detail'),
          icon: FolderKanban,
        },
        {
          label: t('auth.login.roles.employee.panels.records.label'),
          title: t('auth.login.roles.employee.panels.records.title'),
          value: t('auth.login.roles.employee.panels.records.value'),
          detail: t('auth.login.roles.employee.panels.records.detail'),
          icon: BellRing,
        },
      ],
      theme: ROLE_THEMES.employee,
    },
  ]
}

export function getLoginRoleConfig(
  roleId: LoginExperienceRoleId,
  t: TranslateFn,
) {
  return (
    getLoginRoleConfigs(t).find((config) => config.id === roleId) ??
    getLoginRoleConfigs(t)[0]
  )
}

export function getLoginTrustMarkers(t: TranslateFn) {
  return [
    {
      label: t('auth.login.trustMarkers.protectedSignIn'),
      icon: ShieldCheck,
    },
    {
      label: t('auth.login.trustMarkers.roleBasedRouting'),
      icon: CircleDot,
    },
    {
      label: t('auth.login.trustMarkers.governedWorkspaceAccess'),
      icon: BadgeCheck,
    },
  ] as const
}
