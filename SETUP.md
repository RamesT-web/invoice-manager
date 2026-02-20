# Invoice Manager — Setup Guide

## Quick Start (5 minutes)

### Prerequisites

- **Node.js** 18+ installed ([download](https://nodejs.org))
- **PostgreSQL** running (local or cloud)

### Option A: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE invoice_manager;"
```

### Option B: Free Cloud PostgreSQL (Supabase — recommended)

1. Go to [supabase.com](https://supabase.com) → Create free account
2. Create a new project → choose a password → region: Mumbai
3. Go to Settings → Database → Connection string (URI)
4. Copy the URI — it looks like: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### Setup Steps

```bash
# 1. Navigate to the project
cd invoice-manager

# 2. Install dependencies (already done if you cloned)
npm install --legacy-peer-deps

# 3. Configure environment
#    Edit .env and set your DATABASE_URL
#    If using Supabase, paste the connection string from step above

# 4. Push database schema (creates all tables)
npm run db:push

# 5. Seed sample data (creates admin user + 2 companies)
npm run db:seed

# 6. Start the development server
npm run dev
```

### Login

Open **http://localhost:3000** in your browser.

- **Email:** `admin@invoicemanager.com`
- **Password:** `admin123`

You'll see the dashboard with company switcher (TES Engineering / Zetasky Pvt Ltd).

---

## Project Structure

```
invoice-manager/
├── prisma/
│   ├── schema.prisma          ← Database schema (all tables)
│   └── seed.ts                ← Sample data
├── src/
│   ├── app/
│   │   ├── (auth)/            ← Login, Register (no sidebar)
│   │   ├── (dashboard)/       ← All app pages (with sidebar)
│   │   │   ├── page.tsx       ← Dashboard home
│   │   │   ├── invoices/      ← Invoice list/create/edit
│   │   │   ├── quotes/        ← Quotes (placeholder)
│   │   │   ├── customers/     ← Customer list (placeholder)
│   │   │   ├── payments/      ← Payments (placeholder)
│   │   │   └── settings/      ← Company settings (LIVE)
│   │   └── api/               ← API routes (auth + tRPC)
│   ├── components/
│   │   ├── ui/                ← Base UI components (Button, Card, etc.)
│   │   ├── layout/            ← Sidebar, Header, Mobile Nav
│   │   └── providers.tsx      ← tRPC + React Query + Session provider
│   ├── server/
│   │   ├── db.ts              ← Prisma client
│   │   └── trpc/              ← tRPC routers (company, user, dashboard)
│   └── lib/
│       ├── auth.ts            ← NextAuth configuration
│       ├── trpc.ts            ← tRPC client hook
│       ├── utils.ts           ← Utility functions
│       ├── constants.ts       ← GST rates, states, statuses
│       └── hooks/             ← Company store (Zustand)
├── docs/                      ← Product spec, schema, wireframes, plan
├── .env                       ← Environment variables (edit this)
└── .env.example               ← Template
```

## Available Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run db:push      # Push schema to database (no migration files)
npm run db:migrate   # Create migration + apply (for production)
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (database GUI)
```

## What's Built (Milestone 1)

- [x] Login page (email + password)
- [x] Registration page (create account)
- [x] Dashboard with summary cards (receivable, overdue, paid this month)
- [x] Recent invoices list on dashboard
- [x] Sidebar navigation (desktop + mobile)
- [x] Bottom tab bar (mobile)
- [x] Company switcher (TES Engineering / Zetasky Pvt Ltd)
- [x] User menu with sign-out
- [x] Settings page: company details, GSTIN, address, bank details, invoice prefix
- [x] Full database schema: users, companies, customers, vendors, items, invoices, quotes, payments, credit notes, projects, audit logs
- [x] tRPC API layer with type-safe routes
- [x] Seed script with 2 companies, 5 items, 3 customers

## What's Next (Milestone 2)

Customer CRUD, Item master, and the invoice creation form — the core of the app.

Say **"build milestone 2"** to continue.
