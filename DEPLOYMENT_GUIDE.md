# TechCiti Tutor Report Portal — Deployment Guide

## Overview
This guide explains how to deploy the TechCiti Tutor Report Portal to cPanel.
The project consists of:
- **Frontend**: Next.js 15.1.6 (React 19, TypeScript, Tailwind CSS)
- **Backend**: Express + Prisma + MySQL (Node.js 20+)
- **Database**: MySQL (created via cPanel MySQL Databases)

## Prerequisites
1. **cPanel hosting** with:
   - Node.js support (Check "Setup Node.js App" in cPanel)
   - MySQL database support
   - SSL/TLS management (Let's Encrypt)
2. **Domain** registered (e.g., `yourdomain.com`)
3. **Super Admin credentials** (from `.env.production`):
   - Email: `admin@techciti.ng`
   - Password: `TechCiti2026!`

## Step 1: Database Setup

### 1.1 Create MySQL Database
1. Log in to cPanel → **MySQL Databases** → **Create New Database**
2. Database name: `techciti_reports`
3. Click **Create**

### 1.2 Import Schema
1. Go to **phpMyAdmin** → select `techciti_reports` → **Import** tab
2. Upload `backend/database/schema.sql`
3. Confirm import completes

### 1.3 Get Connection Details
| Item | Value |
|------|--------|
| Hostname | `localhost` (or your server hostname) |
| Database | `techciti_reports` |
| User | Your created MySQL user |
| Password | Your created password |

## Step 2: Backend Configuration

### 2.1 Create Production Environment File
Copy `backend/.env.production` to `.env` on your cPanel server:
```bash
cp backend/.env.production .env
```

### 2.2 Key Production Settings
- `NODE_ENV=production` – enables production optimizations
- `DATABASE_URL` – formatted as `mysql://user:pass@host:3306/dbname`
- `JWT_SECRET` – 32+ character random string (keep secret)
- `COOKIE_SECURE=true` – required for HTTPS
- `TRUST_PROXY=1` – enable when behind cPanel reverse proxy
- `ADMIN_ORIGIN`/`TUTOR_ORIGIN` – set to your domain(s)

## Step 3: Frontend Configuration

### 3.1 Create Production Environment File
Copy `frontend/.env.production` to `.env.local` or `.env.production`:
```bash
cp frontend/.env.production .env.production
```

### 3.2 Required Environment Variables
- `NEXT_PUBLIC_API_BASE_URL` – your production API URL (e.g., `https://yourdomain.com/api`)
- Optionally: `NEXT_PUBLIC_ADMIN_ORIGIN`, `NEXT_PUBLIC_TUTOR_ORIGIN`

## Step 4: Build & Deploy

### 4.1 Build the Backend
```bash
cd backend
npm install
npm run build
```
This generates `dist/` with compiled code and Prisma types.

### 4.2 Start the Backend (Production)
```bash
cd backend
node server.js
```
Or use the cPanel Node.js app:
- In cPanel → **Setup Node.js App**
- App root: `/home/yourcpanelusername/backend`
- Startup file: `dist/server.js`
- Environment variables: same as `.env.production`

### 4.3 Build the Frontend
```bash
cd ..
npm run build
```
This creates `out/` with static assets.

## Step 5: SSL & Domain

1. **Install SSL certificate** via cPanel → **SSL/TLS Manager** → **Let's Encrypt**
2. Select your domain and click **Install**
3. Enable **Force HTTPS** under SSL/TLS Manager

## Step 6: Verify Deployment

### 6.1 Check Backend Health
```bash
curl -s https://yourdomain.com/api/health
```
Should return `{"status":"ok"}`

### 6.2 Check Frontend
```bash
curl -s https://yourdomain.com
```
Should load the tutor portal landing page.

### 6.3 Test Admin Login
Go to `https://yourdomain.com/admin/login` with:
- Email: `admin@techciti.ng`
- Password: `TechCiti2026!`

## Step 7: Post-Deployment Tasks

1. **Set up backup strategy** – regular database backups via cPanel
2. **Monitor logs** – check `logs/` directory for errors
3. **Security hardening** – ensure `COOKIE_SECURE=true`, `TRUST_PROXY=1`
4. **Performance tuning** – adjust `MAX_MONTHS_AHEAD` if needed

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Node.js app not starting" | Check Node.js version (>=20), restart app |
| "Database connection failed" | Verify `DATABASE_URL` format and credentials |
| "CORS errors" | Ensure `ADMIN_ORIGIN`/`TUTOR_ORIGIN` match your domains |
| "Next.js hydration errors" | Rebuild after changing environment variables |
| "Port already in use" | Change `PORT` in `.env` to another port |

## Cost Estimate
- **cPanel hosting**: $3-10/month (includes MySQL, Node.js support)
- **SSL**: Free (Let's Encrypt)
- **Total**: Minimal ongoing cost

## Next Steps
- Seed demo data: `npm run seed` (backend) or `npm run seed` (frontend)
- Run smoke tests: `npm run smoke`
- Monitor traffic and performance