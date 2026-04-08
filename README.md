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
VITE_PUBLIC_BASE_URL=https://your-app.vercel.app
INVITE_REDIRECT_URL=https://your-app.vercel.app/login
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_DOCUMENT_INTELLIGENCE_API_KEY=your-azure-document-intelligence-key
AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID=prebuilt-layout
AZURE_DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
```

For hosted Supabase edge functions, set `INVITE_REDIRECT_URL` as a Supabase project secret so employee invite emails always redirect to the deployed app instead of a local fallback URL.

## OCR dossier import

The admin employee-create flow includes an `Import from dossier` action that:

- uploads a PDF, JPG/JPEG, or PNG dossier
- sends it to a server-side OCR endpoint on Vercel
- uses Azure AI Document Intelligence for extraction
- prefills the existing Add Employee form only after admin review

Notes:

- no employee is created automatically from OCR alone
- the OCR endpoint requires an authenticated `ADMIN_RH` user
- unsupported or oversized files fall back cleanly to manual entry
- because the OCR endpoint lives under `api/`, test it with `vercel dev` or the deployed Vercel app rather than plain `vite` alone

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
