# Production Readiness Checklist

Use this checklist before going live with Invoice Manager.

---

## 1. Environment & Secrets

- [ ] `NEXTAUTH_SECRET` set to a random 32+ byte value (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` set to your production URL (e.g. `https://invoice.yourdomain.com`)
- [ ] `DATABASE_URL` points to a production PostgreSQL (not the development DB)
- [ ] If using object storage: `STORAGE_DRIVER=object` and all `S3_*` vars configured
- [ ] `.env` is NOT committed to git (check `.gitignore`)
- [ ] Default seed credentials (`admin@invoicemanager.com` / `admin123`) are **changed or deleted**

## 2. Database

- [ ] Run `npx prisma migrate deploy` (NOT `db push`) in production
- [ ] Automated daily backups enabled (Render, Supabase, and Neon do this automatically)
- [ ] Test restoring from a backup at least once
- [ ] If using free-tier DB: set a reminder to prevent auto-sleep/deletion

## 3. Security

- [x] Security headers added via middleware (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, etc.)
- [x] Rate limiting on login (10 attempts / 15 min per IP)
- [x] Rate limiting on registration (3 accounts / hour per domain)
- [x] Rate limiting on file uploads (30 / 10 min per user)
- [x] `changePassword` requires current password verification
- [x] Upload route verifies company membership before accepting files
- [x] Admin can disable user accounts (toggle `isActive`)
- [x] Admin can reset passwords and change roles
- [ ] Change the default admin password immediately after first deploy
- [ ] Disable or remove the registration page if you don't want public sign-ups
- [ ] Consider adding CAPTCHA to login if exposed to the public internet

## 4. Monitoring & Health

- [x] `/api/health` endpoint returns DB status, uptime, and latency
- [ ] Configure uptime monitor (e.g. UptimeRobot, Better Stack) to ping `/api/health`
- [ ] Set up alerts for 503 (database unreachable) responses
- [ ] Review server logs periodically (Render dashboard > Logs, or Vercel > Functions)

## 5. Data Integrity

- [ ] Test the full backup/restore cycle (Reports > Data Backup ZIP)
- [ ] Verify backup freshness indicator in sidebar turns orange after 7 days
- [ ] If using object storage: test upload + download + signed URL redirect
- [ ] Verify soft-delete and restore works across invoices, vendor bills, customers, vendors

## 6. Performance

- [ ] Database has proper indexes (Prisma schema already includes `@@index` on key columns)
- [ ] For large datasets: consider connection pooling (PgBouncer or Prisma Accelerate)
- [ ] Enable gzip/brotli compression on your hosting platform (Render/Vercel do this by default)
- [ ] PWA service worker caches the offline fallback page (verify in DevTools > Application)

## 7. Legal & Compliance

- [ ] Add a Privacy Policy page (required for Play Store if using TWA)
- [ ] Verify GST calculations against known test cases
- [ ] Ensure invoice numbers are sequential and gap-free for your financial year
- [ ] If storing data for Indian businesses: review data localization requirements

## 8. Deployment Platform

### Render
- [ ] Web service type: Node, build command `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`, start command `npm start`
- [ ] PostgreSQL database created and linked (use internal connection string)
- [ ] Health check path set to `/api/health`
- [ ] Auto-deploy from main branch enabled (optional)

### Vercel
- [ ] External database configured (Supabase / Neon / PlanetScale)
- [ ] Build command: `npx prisma generate && npx prisma migrate deploy && next build`
- [ ] Environment variables set in Vercel dashboard
- [ ] Serverless function regions set close to your database

## 9. Ongoing Operations

- [ ] Take a data backup ZIP at least weekly (sidebar warns after 7 days)
- [ ] Review the Users & Access page periodically — disable unused accounts
- [ ] Monitor disk usage if using local storage driver
- [ ] Update dependencies quarterly (`npm audit`, `npm update`)
- [ ] Keep `NEXTAUTH_SECRET` confidential — rotate if compromised

---

## Quick Smoke Test

After deploying, run through these steps:

1. Open `/api/health` — should return `{"status":"healthy"}`
2. Log in with your admin credentials
3. Create a test customer
4. Create and save a test invoice
5. Upload an attachment to the invoice
6. Download the attachment
7. Record a payment against the invoice
8. Go to Reports > export a backup ZIP
9. Go to Settings > Users & Access — verify user list shows
10. Log out and verify login rate limiting works (rapid wrong passwords)
