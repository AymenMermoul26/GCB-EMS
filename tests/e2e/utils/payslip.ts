export interface PayslipEmployeeConfig {
  email: string
  password: string
  matricule: string
}

export function getPayslipEmployeeConfig(): PayslipEmployeeConfig | null {
  const email = process.env.E2E_PAYSLIP_EMPLOYEE_EMAIL
  const password = process.env.E2E_PAYSLIP_EMPLOYEE_PASSWORD
  const matricule = process.env.E2E_PAYSLIP_EMPLOYEE_MATRICULE

  if (!email || !password || !matricule) {
    return null
  }

  return {
    email,
    password,
    matricule,
  }
}
