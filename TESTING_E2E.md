# End-to-end testing with Playwright

## Overview

This repository uses Playwright with TypeScript for browser-level end-to-end coverage against the existing Vite + Supabase application.

The setup is conservative:
- it reuses the existing `npm run dev` Vite server
- it exercises the real UI and auth flow
- it does not hardcode secrets in the repository
- it uses dedicated role-based test accounts from environment variables
- it captures traces, screenshots, and video on failure

## Test structure

- `tests/e2e/auth/`
- `tests/e2e/roles/`
- `tests/e2e/employees/`
- `tests/e2e/payroll/`
- `tests/e2e/utils/`
- `tests/e2e/fixtures/`

## Auth strategy

The suite uses real role-based accounts provided through environment variables.

Each authenticated spec logs in through the real UI with the dedicated test account for that role.

This is intentional. The app uses Supabase session refresh tokens, and reusing one captured storage state across multiple specs is less reliable than performing a fresh UI login per authenticated test. The UI-login approach is slower, but it is safer and more representative for this codebase.

## Required environment variables

These are required for the authenticated setup and role-based specs:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_PAYROLL_EMAIL`
- `E2E_PAYROLL_PASSWORD`
- `E2E_EMPLOYEE_EMAIL`
- `E2E_EMPLOYEE_PASSWORD`

The existing app runtime env vars still need to exist for the Vite app itself:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_NAME`

Optional:
- `E2E_PAYSLIP_EMPLOYEE_EMAIL`
- `E2E_PAYSLIP_EMPLOYEE_PASSWORD`
- `E2E_PAYSLIP_EMPLOYEE_MATRICULE`
  - used by the generated-payslip access spec
  - this account must belong to an employee who is included in payroll calculations and receives published payslips
  - keep it separate from `E2E_EMPLOYEE_*` when your generic employee test user is excluded from payroll because of missing compensation setup

- `PLAYWRIGHT_BASE_URL`
  - defaults to `http://127.0.0.1:4173`
  - use this only if you want Playwright to target an already running app at a different URL

## Install and browser setup

```powershell
npm install
npx playwright install chromium
```

## Run the suite

```powershell
npm run test:e2e
```

Open the interactive UI runner:

```powershell
npm run test:e2e:ui
```

Run headed:

```powershell
npm run test:e2e:headed
```

Debug a failing spec:

```powershell
npm run test:e2e:debug
```

Open the HTML report:

```powershell
npm run test:e2e:report
```

## What the initial suite covers

- login success
- login failure
- logout
- protected route redirect to login
- role-based access control
- dashboard/profile page load for admin, payroll, and employee
- employee create/update happy path
- employee form validation error state
- payroll processing happy path for period + run creation

## Selector strategy

The specs prefer:
- accessible labels
- role-based selectors
- existing element ids for form triggers

No app-wide selector refactor was introduced. Add `data-testid` only when an accessible or stable semantic selector is not available.

## Current assumptions and limitations

- The suite runs against the real Supabase-backed app.
- The employee and payroll happy-path specs create persistent `E2E-*` records in the live/test backend because the current UI does not expose hard-delete cleanup flows.
- Use dedicated non-production test accounts.
- If one or more role credentials are missing, the related authenticated specs are skipped.
- The suite forces the UI language to English in test contexts to keep selectors deterministic.
- The suite is intentionally configured with `workers: 1` because it exercises shared role accounts and a shared backend.

## Extending the suite safely

Recommended next additions:
- admin requests flows
- payroll run progression beyond creation into calculation/publication
- employee request flows
- payslip generation/download flows
- notification workflows
- badge/information-sheet export checks
