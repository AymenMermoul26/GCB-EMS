import type { PropsWithChildren } from 'react'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { Badge } from '@/components/ui/badge'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeSexeLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'

const COMPANY_NAME = 'LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT'
const DOCUMENT_TITLE = 'Employee Information Sheet'

export interface EmployeeInformationSheetDocumentEmployee {
  id: string
  matricule: string
  nom: string
  prenom: string
  sexe: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  adresse: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  photoUrl: string | null
  isActive: boolean
}

interface EmployeeInformationSheetDocumentProps {
  employee: EmployeeInformationSheetDocumentEmployee
  departmentName?: string | null
  generatedAt: string
  className?: string
}

function formatDisplayValue(value: string | null | undefined, fallback = '—'): string {
  if (!value || value.trim().length === 0) {
    return fallback
  }

  return value
}

function formatDateValue(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))
}

function formatNumberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value)
}

function getInitials(prenom: string, nom: string): string {
  const first = prenom.trim().charAt(0)
  const second = nom.trim().charAt(0)
  return `${first}${second}`.toUpperCase() || 'NA'
}

function SheetField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function SheetSection({
  title,
  description,
  children,
}: PropsWithChildren<{
  title: string
  description: string
}>) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  )
}

export function EmployeeInformationSheetDocument({
  employee,
  departmentName,
  generatedAt,
  className,
}: EmployeeInformationSheetDocumentProps) {
  const fullName = `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()

  return (
    <div className={`employee-sheet-document bg-white text-slate-900 ${className ?? ''}`.trim()}>
      <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />

      <div className="space-y-8 p-8 sm:p-10">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={gcbLogo}
              alt="GCB company logo"
              className="h-16 w-16 flex-shrink-0 object-contain sm:h-20 sm:w-20"
            />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-900 sm:text-base">
                {COMPANY_NAME}
              </p>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  {DOCUMENT_TITLE}
                </h1>
                <p className="mt-1 text-sm text-slate-500">Generated on {generatedAt}</p>
              </div>
            </div>
          </div>

          <Badge className="w-fit border-transparent bg-slate-100 text-slate-700">
            Controlled administrative use
          </Badge>
        </header>

        <section className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={fullName}
                className="h-[220px] w-full object-cover"
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center bg-slate-100 text-5xl font-semibold text-slate-500">
                {getInitials(employee.prenom, employee.nom)}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Employee identity
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {fullName}
              </h2>
              <p className="mt-2 text-base text-slate-600 sm:text-lg">
                {formatDisplayValue(employee.poste, 'Job title not set')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SheetField label="Employee ID" value={employee.matricule} mono />
              <SheetField label="Department" value={formatDisplayValue(departmentName)} />
              <SheetField label="Status" value={employee.isActive ? 'Active' : 'Inactive'} />
              <SheetField
                label="Contract type"
                value={formatDisplayValue(getEmployeeTypeContratLabel(employee.typeContrat))}
              />
            </div>
          </div>
        </section>

        <SheetSection
          title="Identity & Contact"
          description="Core identity and contact information included in the employee information sheet."
        >
          <SheetField label="Full name" value={fullName} />
          <SheetField label="Sex" value={formatDisplayValue(getEmployeeSexeLabel(employee.sexe))} />
          <SheetField label="Birth date" value={formatDateValue(employee.dateNaissance)} />
          <SheetField label="Birth place" value={formatDisplayValue(employee.lieuNaissance)} />
          <SheetField label="Nationality" value={formatDisplayValue(employee.nationalite)} />
          <SheetField label="Phone" value={formatDisplayValue(employee.telephone)} />
          <SheetField label="Email" value={formatDisplayValue(employee.email)} />
          <SheetField label="Address" value={formatDisplayValue(employee.adresse)} />
        </SheetSection>

        <SheetSection
          title="Employment Information"
          description="Operational employment details relevant to the employee record."
        >
          <SheetField label="Department" value={formatDisplayValue(departmentName)} />
          <SheetField label="Job title" value={formatDisplayValue(employee.poste)} />
          <SheetField
            label="Professional category"
            value={formatDisplayValue(
              getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
            )}
          />
          <SheetField
            label="Contract type"
            value={formatDisplayValue(getEmployeeTypeContratLabel(employee.typeContrat))}
          />
          <SheetField label="Hire date" value={formatDateValue(employee.dateRecrutement)} />
          <SheetField label="Status" value={employee.isActive ? 'Active' : 'Inactive'} />
        </SheetSection>

        <SheetSection
          title="Administrative Information"
          description="Civil and administrative fields approved for this controlled sheet."
        >
          <SheetField
            label="Marital status"
            value={formatDisplayValue(
              getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
            )}
          />
          <SheetField label="Number of children" value={formatNumberValue(employee.nombreEnfants)} />
          <SheetField label="Address" value={formatDisplayValue(employee.adresse)} />
          <SheetField label="Generated from" value="GCB Employee Management System" />
        </SheetSection>

        <footer className="border-t border-slate-200 pt-5 text-sm text-slate-500">
          Employee information sheet. Internal HR notes, social security numbers, QR settings,
          public-profile visibility, audit metadata, and workflow controls are intentionally
          excluded from this document.
        </footer>
      </div>
    </div>
  )
}
