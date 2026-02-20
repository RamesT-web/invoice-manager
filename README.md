# Invoice Manager

A laptop-first invoice and billing management app built with Next.js, designed for small Indian businesses. Handles GST invoicing, vendor bills, payments, TDS tracking, bank reconciliation, and data backup.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL + Prisma 5
- **API:** tRPC v11
- **Auth:** NextAuth v5 (credentials)
- **State:** Zustand (company switcher)

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **PostgreSQL** 14+ (local install **or** Docker)

## Quick Start (Windows)

### Option A: Docker Postgres (recommended)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Start the database:
   ```
   docker compose up -d
   ```
3. Copy environment file:
   ```
   copy .env.example .env
   ```
   The default `.env` already points to `localhost:5432` with user `postgres`/`postgres`.

4. Install dependencies + build + start:
   ```
   start.bat
   ```
   This handles `npm install`, `prisma generate`, `next build`, and `next start` automatically.

5. Open [http://localhost:3000](http://localhost:3000)

### Option B: Local PostgreSQL

1. Install PostgreSQL and create a database:
   ```sql
   CREATE DATABASE invoice_manager;
   ```
2. Copy and configure `.env`:
   ```
   copy .env.example .env
   ```
   Edit `DATABASE_URL` if your credentials differ from `postgres:postgres`.

3. Run:
   ```
   start.bat
   ```

### First-time Database Setup

After starting the database for the first time, run migrations and seed:

```bash
npx prisma migrate dev
npx tsx prisma/seed.ts
```

### Default Login

- **Email:** admin@invoicemanager.com
- **Password:** admin123
- **Companies:** TES Engineering, Zetasky Pvt Ltd

## Scripts

| Command | Description |
|---------|-------------|
| `start.bat` | Build + start production server (port 3000) |
| `stop.bat` | Stop the running server |
| `dev.bat` | Start development server with hot reload |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema (skip migrations) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (DB browser) |

## Docker Compose

```bash
# Start Postgres only
docker compose up -d

# Start Postgres + pgAdmin (http://localhost:5050)
docker compose --profile tools up -d

# Stop everything
docker compose down

# Stop and delete data
docker compose down -v
```

pgAdmin login: `admin@invoicemanager.com` / `admin123`

## Project Structure

```
src/
  app/
    (auth)/           # Login, register pages
    (dashboard)/      # All authenticated pages
      invoices/       # Invoice CRUD + detail
      vendor-bills/   # Vendor bill CRUD + detail
      customers/      # Customer CRUD + ledger
      vendors/        # Vendor CRUD + ledger
      payments/       # Payment list
      banking/        # CSV import + reconciliation
      reports/        # Reports + data backup (ZIP)
      settings/       # Company settings + items
    api/
      attachments/    # File upload/download API
      auth/           # NextAuth endpoints
      trpc/           # tRPC API handler
  components/
    layout/           # Sidebar, header, mobile nav
    ui/               # shadcn/ui components
    attachments/      # Attachment panel component
  server/
    trpc/
      routers/        # All tRPC routers
      trpc.ts         # tRPC config + context
      router.ts       # Root router
    db.ts             # Prisma client singleton
  lib/
    auth.ts           # NextAuth config
    trpc.ts           # tRPC client
    utils.ts          # Utility functions
    constants.ts      # Shared constants
    hooks/            # Zustand stores
prisma/
  schema.prisma       # Database schema
  seed.ts             # Seed script
uploads/              # Local file storage (gitignored)
docker-compose.yml    # Postgres + pgAdmin
```

## Features

- Multi-company support with company switcher
- GST-compliant invoicing (CGST/SGST/IGST)
- Vendor bill management with GST/GSTR-2B tracking
- Payment recording (received + made)
- TDS tracking with certificate status
- Bank statement CSV import + auto-reconciliation
- Customer and vendor ledgers with running balance
- Soft delete with trash/restore across all entities
- Auto status engine (Paid/Partial/Overdue)
- File attachments on invoices and vendor bills
- Reports: Aging, TDS Register, Sales Summary, Vendor GST
- Data backup export (ZIP with CSVs + attachments)
- Backup freshness indicator in sidebar (warns if >7 days)

## Data Backup

Go to **Reports** and click **Data Backup (ZIP)**. The export includes:
- All CSVs (customers, vendors, invoices, vendor bills, payments)
- Attachment index CSV
- All uploaded attachment files

The sidebar shows a backup freshness indicator that turns orange if no backup has been taken in 7+ days.
