# EMS (Employee Management System)

Scalable TypeScript starter for a thesis-ready EMS application.

## Stack

- React + Vite
- TailwindCSS + shadcn/ui-style components
- Supabase (PostgreSQL + Auth + Storage-ready)
- React Router
- React Query
- React Hook Form + Zod

## Roles

- `admin_rh`
- `employee`
- External public viewer via `/p/:token`

## Features scaffolded

- Supabase auth integration
- Role-based route protection
- Login page with RHF + Zod validation
- Admin dashboard page scaffold
- Employee dashboard page scaffold
- Public QR profile page scaffold
- Service layers for:
  - profiles
  - employees CRUD
  - modification requests workflow

## Environment

Copy `.env.example` to `.env` and set:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=GCB EMS
```

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

## Notes for Supabase schema

The scaffold expects these tables/views by default:

- `profiles`
- `employees`
- `modification_requests`
- `employee_public_profiles`

If your thesis schema uses different names or column conventions, update:

- `src/services/supabase/profile.service.ts`
- `src/services/supabase/employee.service.ts`
- `src/services/supabase/modification-request.service.ts`
