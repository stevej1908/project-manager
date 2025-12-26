# 🚀 Deploy Now - Step-by-Step Checklist

Follow these steps in order to deploy your Project Manager app to production.

**Estimated Time**: 30-40 minutes
**Cost**: $0/month (all free tiers!)

---

## ✅ Pre-Deployment Checklist

- [ ] All code changes saved
- [ ] Local app is working (tested at http://localhost:3000)
- [ ] Git repository exists on GitHub
- [ ] You have admin access to GitHub repo

---

## Step 1: Commit Changes to Git (5 minutes)

### Option A: Using Batch File (Easiest)

```bash
# Close any applications using Git (VS Code, etc.)
# Then run:
commit-deployment-setup.bat
```

### Option B: Manual Commands

```bash
# If batch file doesn't work, run these commands:

# 1. Close VS Code and any Git applications

# 2. Add all deployment files
git add .env.example server/.env.example
git add package.json package-lock.json server/package.json
git add .github/ database/ tests/ server/tests/
git add playwright.config.js server/run-all-migrations.js
git add server/vercel.json vercel.json
git add src/components/ErrorBoundary.js src/setupTests.js src/index.js
git add *.md

# 3. Commit
git commit -m "Add complete deployment infrastructure"

# 4. Push to all branches
git push origin master
git checkout test && git merge master && git push origin test
git checkout staging && git merge master && git push origin staging
git checkout master
```

**Checkpoint**: ✅ Code is on GitHub in all 3 branches

---

## Step 2: Create Neon Databases (10 minutes)

### 2.1 Create Neon Account

1. Go to https://neon.tech/
2. Click "Sign Up" (FREE - no credit card required)
3. Sign up with GitHub (easiest) or email
4. Verify your email

### 2.2 Create Project

1. Click "Create Project"
2. Project name: `Project Manager`
3. Region: Choose closest to you (e.g., `US East (Ohio)`)
4. Click "Create Project"

### 2.3 Create 3 Databases

**Database 1: TEST**

1. In project dashboard, click "Databases" tab
2. Click "Create Database"
3. Name: `project_manager_test`
4. Click "Create"
5. Click "Connection string" and copy the **connection string**
6. Save it as: `TEST_DATABASE_URL`

**Database 2: STAGING**

1. Click "Create Database" again
2. Name: `project_manager_staging`
3. Click "Create"
4. Copy connection string
5. Save it as: `STAGING_DATABASE_URL`

**Database 3: PRODUCTION**

1. Click "Create Database" again
2. Name: `project_manager`
3. Click "Create"
4. Copy connection string
5. Save it as: `PRODUCTION_DATABASE_URL`

**Connection String Format**:
```
postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

**Checkpoint**: ✅ You have 3 connection strings saved

---

## Step 3: Setup Vercel (10 minutes)

### 3.1 Create Vercel Account

1. Go to https://vercel.com/signup
2. Sign up with GitHub (recommended)
3. Authorize Vercel to access your repositories

### 3.2 Import Project

1. Click "Add New..." → "Project"
2. Find your repository: `Project-Manager`
3. Click "Import"

### 3.3 Configure Build Settings

**Framework Preset**: Create React App (should auto-detect)

**Root Directory**: `./` (leave as default)

**Build Settings**:
- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

**Environment Variables**: We'll add these in the next step

Click "Deploy" (it will deploy, but won't work yet without env vars)

**Checkpoint**: ✅ Project is linked to Vercel

---

## Step 4: Configure Environment Variables in Vercel (10 minutes)

### 4.1 Go to Project Settings

1. In Vercel dashboard, click your project
2. Click "Settings" tab
3. Click "Environment Variables" in sidebar

### 4.2 Add Variables for Each Environment

For each variable below, add it 3 times with different values for:
- **Production** (main branch)
- **Preview** (test branch)
- **Preview** (staging branch)

**Click "Add" for each environment variable:**

#### Required Variables (Add these for all environments)

| Variable Name | Production Value | Preview (test/staging) Value |
|---------------|------------------|------------------------------|
| `NODE_ENV` | `production` | `test` or `staging` |
| `DATABASE_URL` | `<PRODUCTION_DATABASE_URL>` | `<TEST_DATABASE_URL>` or `<STAGING_DATABASE_URL>` |
| `REACT_APP_API_URL` | `https://project-manager.vercel.app` | `https://project-manager-git-test-yourname.vercel.app` |
| `FRONTEND_URL` | `https://project-manager.vercel.app` | Same as above |
| `JWT_SECRET` | **(generate below)** | **(generate below)** |
| `GOOGLE_CLIENT_ID` | **(from Google Console)** | Same |
| `GOOGLE_CLIENT_SECRET` | **(from Google Console)** | Same |
| `GOOGLE_REDIRECT_URI` | `https://project-manager.vercel.app/api/auth/google/callback` | Update with your Vercel URL |

#### Generate JWT Secret

Run this in terminal (Windows):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and use it for `JWT_SECRET`

**Tip**: Use different JWT secrets for each environment!

### 4.3 Save and Redeploy

After adding all variables:
1. Go to "Deployments" tab
2. Click "..." on latest deployment
3. Click "Redeploy"

**Checkpoint**: ✅ Environment variables configured

---

## Step 5: Update Google OAuth (5 minutes)

### 5.1 Get Your Vercel URLs

After first deployment, you'll have URLs like:
- Production: `https://project-manager-yourname.vercel.app`
- Test: `https://project-manager-git-test-yourname.vercel.app`
- Staging: `https://project-manager-git-staging-yourname.vercel.app`

### 5.2 Update Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Select your project
3. Go to "APIs & Services" → "Credentials"
4. Click on your OAuth 2.0 Client ID

**Add Authorized JavaScript origins**:
```
https://project-manager-yourname.vercel.app
https://project-manager-git-test-yourname.vercel.app
https://project-manager-git-staging-yourname.vercel.app
```

**Add Authorized redirect URIs**:
```
https://project-manager-yourname.vercel.app/api/auth/google/callback
https://project-manager-git-test-yourname.vercel.app/api/auth/google/callback
https://project-manager-git-staging-yourname.vercel.app/api/auth/google/callback
```

5. Click "Save"

**Checkpoint**: ✅ Google OAuth configured

---

## Step 6: Run Database Migrations (10 minutes)

### 6.1 Install Dependencies

```bash
cd C:/Users/steve/Project-Manager
npm install
cd server
npm install
```

### 6.2 Migrate TEST Database

```bash
# Set environment variable (Windows CMD)
set DATABASE_URL=<paste-your-TEST_DATABASE_URL-here>

# Run migrations
node run-all-migrations.js
```

Expected output:
```
✅ All migrations completed successfully!
DATABASE SCHEMA READY!
```

### 6.3 Migrate STAGING Database

```bash
# Set environment variable
set DATABASE_URL=<paste-your-STAGING_DATABASE_URL-here>

# Run migrations
node run-all-migrations.js
```

### 6.4 Migrate PRODUCTION Database

```bash
# Set environment variable
set DATABASE_URL=<paste-your-PRODUCTION_DATABASE_URL-here>

# Run migrations
node run-all-migrations.js
```

**Checkpoint**: ✅ All databases have schema

---

## Step 7: Test Deployment (5 minutes)

### 7.1 Test Production

1. Go to your Vercel URL: `https://project-manager-yourname.vercel.app`
2. You should see the login page
3. Click "Sign in with Google"
4. Complete OAuth flow
5. You should see the dashboard

### 7.2 Test Creating a Project

1. Click "Create Project"
2. Enter name and description
3. Click "Create"
4. You should see the project created

### 7.3 Test Creating a Task

1. Click on the project
2. Click "New Task"
3. Fill in task details
4. Click "Create"
5. Task should appear in the board

### 7.4 Test View Switching

1. Click the "Gantt" button
2. Gantt chart should appear
3. Click "Board" button
4. Board view should appear

**Checkpoint**: ✅ App is working in production!

---

## Step 8: Optional - Setup Sentry (15 minutes)

If you want error tracking (recommended for production):

1. Follow `SENTRY_SETUP.md`
2. Create FREE Sentry account
3. Get DSN
4. Add `SENTRY_DSN` to Vercel environment variables
5. Redeploy

---

## 🎉 Deployment Complete!

Your app is now live on:
- **Production**: https://project-manager-yourname.vercel.app
- **Test**: https://project-manager-git-test-yourname.vercel.app
- **Staging**: https://project-manager-git-staging-yourname.vercel.app

---

## 📊 What You've Deployed

- ✅ 3-tier environment (Test, Staging, Production)
- ✅ React frontend on Vercel
- ✅ Node.js backend on Vercel
- ✅ PostgreSQL databases on Neon (3 separate DBs)
- ✅ Google OAuth authentication
- ✅ Automated deployments via Git
- ✅ Error boundaries for graceful errors

**Monthly Cost**: $0 (all on free tiers!)

---

## 🔄 Daily Workflow

### To Deploy New Changes:

```bash
# 1. Make changes locally
# ... code changes ...

# 2. Commit to test branch
git checkout test
git add .
git commit -m "Add feature X"
git push origin test

# 3. Vercel auto-deploys to TEST environment
# 4. Test at: https://project-manager-git-test-yourname.vercel.app

# 5. If good, promote to staging
git checkout staging
git merge test
git push origin staging

# 6. UAT testing in STAGING

# 7. If approved, promote to production
git checkout master
git merge staging
git push origin master

# 8. Live in PRODUCTION!
```

---

## 🆘 Troubleshooting

### "Can't connect to database"
- Check DATABASE_URL in Vercel environment variables
- Ensure `?sslmode=require` is in connection string
- Check Neon database is not paused

### "OAuth error: redirect_uri_mismatch"
- Verify Vercel URL is added to Google Console
- Check redirect URI matches exactly
- Ensure HTTPS (not HTTP)

### "Application not loading"
- Check Vercel deployment logs
- Verify REACT_APP_API_URL is set correctly
- Check browser console for errors

### "White screen"
- Check browser console
- Verify environment variables are set
- Check Vercel build logs

---

## 📚 Reference Docs

- `DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `DATABASE_SETUP_GUIDE.md` - Database setup
- `SENTRY_SETUP.md` - Error tracking
- `FUTURE_ENHANCEMENTS.md` - What's next

---

**Need Help?** Check the troubleshooting sections in each guide!

**Happy Deploying!** 🚀
