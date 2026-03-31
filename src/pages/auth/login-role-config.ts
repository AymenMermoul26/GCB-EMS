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

export const LOGIN_ROLE_CONFIGS: LoginRoleConfig[] = [
  {
    id: 'admin',
    label: 'HR-Admin',
    defaultEmail: 'hrAdmin@gcb.com',
    badge: 'Leadership access',
    title: 'Oversee workforce operations with clear control and faster approvals.',
    description:
      'Monitor employee records, organize departments, and guide every people workflow from one secure command space.',
    helper:
      'Preview employee oversight, approvals, department control, and audit-ready dashboards.',
    visualTitle: 'HR control center',
    visualDescription:
      'A focused workspace for workforce governance, organizational visibility, and timely decisions.',
    roleIcon: BriefcaseBusiness,
    heroIcon: LayoutDashboard,
    featureHighlights: [
      {
        label: 'Approvals queue',
        description: 'Resolve employee updates and public visibility requests.',
        icon: BadgeCheck,
      },
      {
        label: 'Department control',
        description: 'Keep teams, structure, and profile data aligned.',
        icon: Building2,
      },
      {
        label: 'Reporting pulse',
        description: 'Track workforce health, dashboards, and recent activity.',
        icon: BarChart3,
      },
    ],
    metrics: [
      { label: 'Pending approvals', value: '08' },
      { label: 'Active departments', value: '12' },
      { label: 'Record coverage', value: '98%' },
    ],
    previewPanels: [
      {
        label: 'Approvals',
        title: 'Review employee changes',
        value: '08 pending',
        detail: 'Modification and public visibility requests ready for decision.',
        icon: BadgeCheck,
      },
      {
        label: 'Departments',
        title: 'Organization coverage',
        value: '12 active units',
        detail: 'Structured employee data across governed departments and branches.',
        icon: Building2,
      },
      {
        label: 'Insights',
        title: 'Workforce reporting',
        value: 'Live metrics',
        detail: 'Recent dashboards, exports, and audit-aligned operational visibility.',
        icon: BarChart3,
      },
    ],
    theme: {
      heroGradientClass:
        'bg-[linear-gradient(140deg,rgba(15,23,42,0.98)_8%,rgba(88,28,10,0.96)_54%,rgba(249,115,22,0.86)_100%)]',
      glowClass:
        'bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.30),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(249,115,22,0.34),transparent_35%),radial-gradient(circle_at_70%_82%,rgba(255,255,255,0.08),transparent_28%)]',
      selectorActiveClass:
        '[data-state=active]:border-orange-500/60 [data-state=active]:bg-gradient-to-r [data-state=active]:from-orange-600 [data-state=active]:to-amber-600 [data-state=active]:text-white',
      selectorBorderClass: 'border-amber-200/70 bg-amber-50/70',
      selectorBadgeClass:
        'border-amber-200/80 bg-amber-100 text-amber-900',
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
  },
  {
    id: 'payroll',
    label: 'Payroll-Agent',
    defaultEmail: 'lina.boudiaf@gcb.com',
    badge: 'Finance-ready access',
    title: 'Run payroll operations with accuracy, timing, and secure document control.',
    description:
      'Review governed employee data, keep payroll cycles on track, and manage exports and payslip delivery with confidence.',
    helper:
      'Preview payroll cycles, secure employee records, payslip handling, and export workflows.',
    visualTitle: 'Payroll operations desk',
    visualDescription:
      'A precision workspace built for payroll review, payout readiness, and controlled delivery.',
    roleIcon: WalletCards,
    heroIcon: ReceiptText,
    featureHighlights: [
      {
        label: 'Pay cycle tracking',
        description: 'See active periods, calculations, and processing progress.',
        icon: CreditCard,
      },
      {
        label: 'Payslip queue',
        description: 'Review requests and deliver payroll documents securely.',
        icon: ReceiptText,
      },
      {
        label: 'Export readiness',
        description: 'Keep payroll exports and records aligned with policy.',
        icon: FileSpreadsheet,
      },
    ],
    metrics: [
      { label: 'Cycle status', value: 'March ready' },
      { label: 'Open deliveries', value: '04' },
      { label: 'Accuracy target', value: '99.9%' },
    ],
    previewPanels: [
      {
        label: 'Payroll cycle',
        title: 'Current processing period',
        value: 'March 2026',
        detail: 'Track run readiness, review calculations, and confirm payout timing.',
        icon: CreditCard,
      },
      {
        label: 'Payslips',
        title: 'Delivery workflow',
        value: '04 awaiting release',
        detail: 'Resolve pending employee requests and publish governed payroll documents.',
        icon: ReceiptText,
      },
      {
        label: 'Exports',
        title: 'Compliance output',
        value: 'Ready for audit',
        detail: 'Maintain secure exports, salary records, and payment accuracy.',
        icon: FileSpreadsheet,
      },
    ],
    theme: {
      heroGradientClass:
        'bg-[linear-gradient(140deg,rgba(2,6,23,0.98)_8%,rgba(6,78,59,0.95)_54%,rgba(20,184,166,0.82)_100%)]',
      glowClass:
        'bg-[radial-gradient(circle_at_16%_24%,rgba(45,212,191,0.24),transparent_30%),radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.30),transparent_34%),radial-gradient(circle_at_70%_84%,rgba(255,255,255,0.07),transparent_26%)]',
      selectorActiveClass:
        '[data-state=active]:border-emerald-600/60 [data-state=active]:bg-gradient-to-r [data-state=active]:from-emerald-700 [data-state=active]:to-teal-600 [data-state=active]:text-white',
      selectorBorderClass: 'border-emerald-200/70 bg-emerald-50/70',
      selectorBadgeClass:
        'border-emerald-200/80 bg-emerald-100 text-emerald-900',
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
  },
  {
    id: 'employee',
    label: 'Employee',
    badge: 'Personal access',
    title: 'Enter your secure workspace for QR identity, requests, and private records.',
    description:
      'Review your profile, follow approvals, access personal documents, and manage your public QR visibility without exposing private data.',
    helper:
      'Preview QR access, profile updates, notifications, request tracking, and protected self-service.',
    visualTitle: 'Private employee workspace',
    visualDescription:
      'Self-service access for personal records, QR identity, and secure account activity.',
    roleIcon: UserRound,
    heroIcon: ShieldCheck,
    featureHighlights: [
      {
        label: 'QR profile access',
        description: 'Share approved public information safely through your QR link.',
        icon: QrCode,
      },
      {
        label: 'Request tracking',
        description: 'Follow pending, approved, and rejected profile changes.',
        icon: FolderKanban,
      },
      {
        label: 'Personal records',
        description: 'Access payslips, notifications, and private account data securely.',
        icon: BellRing,
      },
    ],
    metrics: [
      { label: 'QR profile', value: 'Protected' },
      { label: 'Open requests', value: '02' },
      { label: 'Record access', value: 'Private' },
    ],
    previewPanels: [
      {
        label: 'QR profile',
        title: 'Approved public identity',
        value: 'Protected access',
        detail: 'Share only the information approved through the visibility workflow.',
        icon: QrCode,
      },
      {
        label: 'Requests',
        title: 'Track profile updates',
        value: '02 active items',
        detail: 'Follow pending, approved, and rejected changes from one private workspace.',
        icon: FolderKanban,
      },
      {
        label: 'Personal records',
        title: 'Secure self-service',
        value: 'Private by default',
        detail: 'Open notifications, profile details, and payslip documents with governed access.',
        icon: BellRing,
      },
    ],
    theme: {
      heroGradientClass:
        'bg-[linear-gradient(140deg,rgba(15,23,42,0.99)_8%,rgba(30,64,175,0.94)_54%,rgba(14,165,233,0.84)_100%)]',
      glowClass:
        'bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.26),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.32),transparent_34%),radial-gradient(circle_at_72%_82%,rgba(255,255,255,0.08),transparent_28%)]',
      selectorActiveClass:
        '[data-state=active]:border-sky-600/60 [data-state=active]:bg-gradient-to-r [data-state=active]:from-sky-700 [data-state=active]:to-blue-700 [data-state=active]:text-white',
      selectorBorderClass: 'border-sky-200/70 bg-sky-50/70',
      selectorBadgeClass:
        'border-sky-200/80 bg-sky-100 text-sky-900',
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
  },
]

export const DEFAULT_LOGIN_ROLE_ID = LOGIN_ROLE_CONFIGS[0].id

export const LOGIN_TRUST_MARKERS = [
  {
    label: 'Protected sign-in',
    icon: ShieldCheck,
  },
  {
    label: 'Role-based routing',
    icon: CircleDot,
  },
  {
    label: 'Governed workspace access',
    icon: BadgeCheck,
  },
] as const

export function getLoginRoleConfig(roleId: LoginExperienceRoleId) {
  return LOGIN_ROLE_CONFIGS.find((config) => config.id === roleId) ?? LOGIN_ROLE_CONFIGS[0]
}
