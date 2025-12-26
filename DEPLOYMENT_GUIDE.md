# Complete Deployment Guide - Project Manager

This guide will take you through deploying your Project Manager app to Vercel with **3 environments**: Test, Staging, and Production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup (Neon - FREE)](#database-setup-neon---free)
3. [Vercel Deployment](#vercel-deployment)
4. [Environment Variables](#environment-variables)
5. [Google OAuth Configuration](#google-oauth-configuration)
6. [Database Migrations](#database-migrations)
7. [Testing the Deployment](#testing-the-deployment)
8. [Workflow Overview](#workflow-overview)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- ✅ GitHub account with repository
- ✅ Vercel account (free tier)
- ✅ Neon account for PostgreSQL (free tier)
- ✅ Google Cloud Console project for OAuth
- ✅ Local environment working (tested)

---

## Database Setup (Neon - FREE)

### Why Neon?

- ✅ **FREE tier**: 0.5 GB storage, 10 hours compute/month
- ✅ **Perfect for 3 environments**: Create 3 separate databases
- ✅ **Serverless**: Auto-pauses when not in use
- ✅ **Fast**: PostgreSQL in the cloud

### Step 1: Create Neon Account

1. Go to https://neon.tech/
2. Sign up for FREE account
3. Create a new project: "Project Manager"

### Step 2: Create 3 Databases

In Neon Dashboard:

**Database 1: TEST**
- Name: `project_manager_test`
- Region: Choose closest to you
- Copy connection string

**Database 2: STAGING**
- Name: `project_manager_staging`
- Region: Same as test
- Copy connection string

**Database 3: PRODUCTION**
- Name: `project_manager`
- Region: Same as test
- Copy connection string

### Connection String Format

```
postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```

**Save all 3 connection strings!** You'll need them for Vercel.

---

## Vercel Deployment

### Step 1: Install Vercel CLI

```bash
npm install -g vercel@latest
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Link Repository to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repo: `your-username/Project-Manager`
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

#### Option B: Via CLI

```bash
cd C:/Users/steve/Project-Manager
vercel
```

### Step 4: Create 3 Vercel Projects

You'll create 3 separate Vercel projects for the 3 environments:

1. **project-manager-test** (linked to `test` branch)
2. **project-manager-staging** (linked to `staging` branch)
3. **project-manager** (linked to `main`/`master` branch)

**OR** use Vercel's built-in preview deployments:
- Production: `main` branch
- Preview: `staging` and `test` branches

For this guide, we'll use **preview deployments** (simpler setup).

---

## Environment Variables

### For Each Environment, Add These Variables in Vercel Dashboard

Go to: **Vercel Dashboard → Project → Settings → Environment Variables**

### TEST Environment

| Variable | Value | Environment |
|----------|-------|-------------|
| `NODE_ENV` | `test` | Preview (test branch) |
| `DATABASE_URL` | `<neon-test-connection-string>` | Preview (test branch) |
| `REACT_APP_API_URL` | `https://project-manager-api-test.vercel.app` | Preview (test branch) |
| `FRONTEND_URL` | `https://project-manager-git-test-yourname.vercel.app` | Preview (test branch) |
| `JWT_SECRET` | `<generate-random-string>` | Preview (test branch) |
| `GOOGLE_CLIENT_ID` | `<your-google-client-id>` | Preview (test branch) |
| `GOOGLE_CLIENT_SECRET` | `<your-google-client-secret>` | Preview (test branch) |
| `GOOGLE_REDIRECT_URI` | `https://project-manager-git-test-yourname.vercel.app/auth/callback` | Preview (test branch) |

### STAGING Environment

| Variable | Value | Environment |
|----------|-------|-------------|
| `NODE_ENV` | `staging` | Preview (staging branch) |
| `DATABASE_URL` | `<neon-staging-connection-string>` | Preview (staging branch) |
| `REACT_APP_API_URL` | `https://project-manager-api-staging.vercel.app` | Preview (staging branch) |
| `FRONTEND_URL` | `https://project-manager-git-staging-yourname.vercel.app` | Preview (staging branch) |
| `JWT_SECRET` | `<generate-random-string>` | Preview (staging branch) |
| `GOOGLE_CLIENT_ID` | `<your-google-client-id>` | Preview (staging branch) |
| `GOOGLE_CLIENT_SECRET` | `<your-google-client-secret>` | Preview (staging branch) |
| `GOOGLE_REDIRECT_URI` | `https://project-manager-git-staging-yourname.vercel.app/auth/callback` | Preview (staging branch) |

### PRODUCTION Environment

| Variable | Value | Environment |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production |
| `DATABASE_URL` | `<neon-production-connection-string>` | Production |
| `REACT_APP_API_URL` | `https://project-manager-api.vercel.app` | Production |
| `FRONTEND_URL` | `https://project-manager.vercel.app` | Production |
| `JWT_SECRET` | `<generate-strong-random-string>` | Production |
| `GOOGLE_CLIENT_ID` | `<your-google-client-id>` | Production |
| `GOOGLE_CLIENT_SECRET` | `<your-google-client-secret>` | Production |
| `GOOGLE_REDIRECT_URI` | `https://project-manager.vercel.app/auth/callback` | Production |
| `SENTRY_DSN` | `<your-sentry-dsn>` (optional) | Production |

### Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Google OAuth Configuration

### Step 1: Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Create project: "Project Manager"
3. Enable APIs:
   - Google+ API
   - Google Drive API
   - Gmail API
   - Google Contacts API

### Step 2: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. **Application type**: Web application
4. **Name**: "Project Manager - Test"

5. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://project-manager-git-test-yourname.vercel.app
   https://project-manager-git-staging-yourname.vercel.app
   https://project-manager.vercel.app
   ```

6. **Authorized redirect URIs**:
   ```
   http://localhost:5000/api/auth/google/callback
   https://project-manager-git-test-yourname.vercel.app/api/auth/google/callback
   https://project-manager-git-staging-yourname.vercel.app/api/auth/google/callback
   https://project-manager.vercel.app/api/auth/google/callback
   ```

7. **Save** and copy:
   - Client ID
   - Client Secret

**Repeat for STAGING and PRODUCTION** (separate OAuth credentials for each environment recommended).

---

## Database Migrations

After deploying, run migrations for each environment:

### Option A: Via Vercel CLI (Recommended)

```bash
# For TEST environment
vercel env pull .env.test
export $(cat .env.test | xargs)
cd server && node run-all-migrations.js

# For STAGING environment
vercel env pull .env.staging
export $(cat .env.staging | xargs)
cd server && node run-all-migrations.js

# For PRODUCTION environment
vercel env pull .env.production
export $(cat .env.production | xargs)
cd server && node run-all-migrations.js
```

### Option B: Connect Directly to Neon

Using `psql` or a PostgreSQL client:

```bash
psql "<neon-connection-string>"
```

Then run the migrations manually from `database/migrations/`.

---

## Testing the Deployment

### 1. Test Environment

```bash
# Push to test branch
git checkout test
git add .
git commit -m "Deploy to test environment"
git push origin test
```

**Vercel will auto-deploy!**

Visit: `https://project-manager-git-test-yourname.vercel.app`

### 2. Staging Environment

```bash
# Merge test to staging
git checkout staging
git merge test
git push origin staging
```

Visit: `https://project-manager-git-staging-yourname.vercel.app`

### 3. Production Environment

```bash
# Merge staging to main
git checkout main
git merge staging
git push origin main
```

Visit: `https://project-manager.vercel.app`

---

## Workflow Overview

```
┌─────────────────────┐
│ Local Development   │
│ (localhost:3000)    │
└──────────┬──────────┘
           │
           ├─> git push origin test
           │
           ▼
┌─────────────────────┐
│  TEST Environment   │
│ Vercel Auto-Deploy  │
│ - Run automated tests│
│ - Verify features   │
└──────────┬──────────┘
           │
           ├─> git merge test → staging
           │   git push origin staging
           ▼
┌─────────────────────┐
│ STAGING Environment │
│ Vercel Auto-Deploy  │
│ - UAT testing       │
│ - Stakeholder review│
└──────────┬──────────┘
           │
           ├─> git merge staging → main
           │   git push origin main
           ▼
┌─────────────────────┐
│ PRODUCTION Env      │
│ Vercel Auto-Deploy  │
│ - Live users        │
│ - Monitored 24/7    │
└─────────────────────┘
```

---

## Troubleshooting

### Build Fails on Vercel

**Error**: "Module not found"
**Solution**: Check `package.json` dependencies, run `npm install` locally first

**Error**: "GENERATE_SOURCEMAP out of memory"
**Solution**: Already set to `false` in `vercel.json`

### Database Connection Errors

**Error**: "Connection refused"
**Solution**:
1. Check DATABASE_URL is correct
2. Ensure Neon database is active (not paused)
3. Verify SSL mode: `?sslmode=require`

### Google OAuth Errors

**Error**: "redirect_uri_mismatch"
**Solution**: Add exact Vercel URL to Google Console authorized redirect URIs

**Error**: "Access denied"
**Solution**: Verify Google API scopes are enabled

### Application Errors

**Error**: "White screen in production"
**Solution**:
1. Check browser console for errors
2. Verify REACT_APP_API_URL is set correctly
3. Check Sentry for error logs

---

## Cost Summary (All FREE!)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Vercel** | Hobby | $0 |
| **Neon PostgreSQL (x3)** | Free | $0 |
| **Sentry** | Developer | $0 |
| **GitHub** | Free | $0 |
| **Google OAuth** | Free | $0 |
| **TOTAL** | | **$0/month** |

---

## Next Steps

1. ✅ Deploy to all 3 environments
2. ✅ Run database migrations
3. ✅ Test OAuth flow in each environment
4. ✅ Set up Sentry error tracking
5. ✅ Configure GitHub Actions for automated testing
6. ⚠️ Set up monitoring/alerts
7. ⚠️ Add custom domain (optional)

---

## Support

If you encounter issues:
- Check Vercel deployment logs
- Review Neon database status
- Verify environment variables
- Check Google OAuth configuration
- Review error logs in Sentry

---

**Deployment Guide Complete!** 🚀

Your Project Manager app is now running on a production-grade infrastructure, completely FREE!
