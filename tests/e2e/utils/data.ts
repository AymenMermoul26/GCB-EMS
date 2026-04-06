import { createUniqueSuffix } from './app'

export interface EmployeeFixtureData {
  firstName: string
  updatedFirstName: string
  lastName: string
  workEmail: string
}

export interface PayrollFixtureData {
  periodCode: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  runCode: string
  runNotes: string
}

export function buildEmployeeFixtureData(): EmployeeFixtureData {
  const suffix = createUniqueSuffix()
  const shortSuffix = suffix.slice(-6)

  return {
    firstName: `E2E${shortSuffix}`,
    updatedFirstName: `E2EU${shortSuffix}`,
    lastName: 'Playwright',
    workEmail: `e2e.${suffix}@example.com`,
  }
}

export function buildPayrollFixtureData(): PayrollFixtureData {
  const suffix = createUniqueSuffix()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 28)
  const toDateInput = (value: Date) => value.toISOString().slice(0, 10)

  return {
    periodCode: `E2E-P-${suffix.slice(-6).toUpperCase()}`,
    periodLabel: `E2E Payroll Period ${suffix.slice(-6)}`,
    periodStart: toDateInput(start),
    periodEnd: toDateInput(end),
    runCode: `E2E-R-${suffix.slice(-6).toUpperCase()}`,
    runNotes: `Created by Playwright ${suffix}`,
  }
}
