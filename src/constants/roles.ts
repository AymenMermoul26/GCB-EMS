export const APP_ROLES = {
  ADMIN_RH: 'ADMIN_RH',
  EMPLOYE: 'EMPLOYE',
} as const

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES]
