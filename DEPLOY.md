# Deployment Guide

Deploy Invoice Manager to the cloud so it can be accessed from any device, including mobile.

## Option A: Render (Recommended)

Render is the simplest platform for a Node.js + PostgreSQL app. Free tier available.

### 1. Create a PostgreSQL Database

1. Go to [render.com](https://render.com) and sign up
2. Click **New** > **PostgreSQL**
3. Name: `invoice-manager-db`
4. Plan: Free (or Starter for production)
5. Click **Create Database**
6. Copy the **Internal Database URL** (starts with `postgresql://...`)

### 2. Create a Web Service

1. Click **New** > **Web Service**
2. Connect your GitHub repo (or use **Public Git repository**)
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `invoice-manager` |
| **Runtime** | Node |
| **Build Command** | `npm install --legacy-peer-deps && npx prisma generate && npx prisma migrate deploy && npm run build` |
| **Start Command** | `npm run start` |
| **Plan** | Free (or Starter) |

4. Add **Environment Variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | *(paste Internal Database URL from step 1)* |
| `NEXTAUTH_SECRET` | *(generate: `openssl rand -base64 32`)* |
| `NEXTAUTH_URL` | `https://invoice-manager.onrender.com` *(your Render URL)* |
| `NEXT_PUBLIC_APP_URL` | *(same as NEXTAUTH_URL)* |
| `STORAGE_DRIVER` | `object` *(or `local` if using Render disk)* |
| `S3_ENDPOINT` | *(see Object Storage section below)* |
| `S3_ACCESS_KEY_ID` | *(your key)* |
| `S3_SECRET_ACCESS_KEY` | *(your secret)* |
| `S3_BUCKET_NAME` | `invoice-manager` |
| `NODE_ENV` | `production` |

5. Click **Create Web Service**

### 3. Seed the Database (first time only)

After the first deploy succeeds, open the **Shell** tab in Render and run:

```bash
npx tsx prisma/seed.ts
```

### 4. Access Your App

Visit your Render URL (e.g., `https://invoice-manager.onrender.com`).

---

## Option B: Vercel + External Database

Vercel is great for Next.js but requires an external database (no built-in Postgres).

### 1. Set Up Database

Use one of:
- **Supabase** (free tier): Create a project, get the connection string from Settings > Database
- **Neon** (free tier): Create a project, copy the connection string
- **Render PostgreSQL** (as above): Use the External Database URL

### 2. Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) > **New Project** > Import your repo
3. In **Build & Output Settings**:
   - Build Command: `npx prisma generate && npx prisma migrate deploy && next build`
   - Output Directory: *(leave default)*
4. Add Environment Variables (same as Render table above)
5. Deploy

### 3. Important Notes for Vercel

- Vercel functions have a **10-second timeout** (free tier). File uploads may fail for large files.
- Use `STORAGE_DRIVER=object` (local storage is not available on Vercel).
- Seed the database from your laptop: `DATABASE_URL=<remote-url> npx tsx prisma/seed.ts`

---

## Object Storage Setup

For cloud deployments, use S3-compatible object storage for attachments.

### Cloudflare R2 (Recommended — generous free tier)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > R2
2. Create a bucket: `invoice-manager`
3. Create an API token with R2 read/write permissions
4. Set environment variables:

```env
STORAGE_DRIVER=object
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<your-access-key>
S3_SECRET_ACCESS_KEY=<your-secret-key>
S3_BUCKET_NAME=invoice-manager
```

### Supabase Storage

1. Go to your Supabase project > Storage
2. Create a bucket: `invoice-manager` (private)
3. Get S3 credentials from Settings > API > S3 Access Keys
4. Set environment variables:

```env
STORAGE_DRIVER=object
S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
S3_ACCESS_KEY_ID=<your-access-key>
S3_SECRET_ACCESS_KEY=<your-secret-key>
S3_BUCKET_NAME=invoice-manager
S3_REGION=<your-region>
```

---

## Production Checklist

- [ ] `NEXTAUTH_SECRET` is a strong random string (not the default)
- [ ] `NEXTAUTH_URL` matches your deployed URL exactly
- [ ] `DATABASE_URL` points to your production database
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] Database seeded with initial user (`npx tsx prisma/seed.ts`)
- [ ] `STORAGE_DRIVER=object` if not using persistent disk
- [ ] S3 credentials configured if using object storage
- [ ] Change the default admin password after first login

## Custom Domain

Both Render and Vercel support custom domains. After adding your domain:
1. Update `NEXTAUTH_URL` to `https://yourdomain.com`
2. Update `NEXT_PUBLIC_APP_URL` to match
3. Redeploy
