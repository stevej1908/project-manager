# ⚡ Quick Start - Deploy in 25 Minutes

**Status**: ✅ Code is committed and pushed to GitHub (all 3 branches)

**What's Left**: 5 simple steps requiring your accounts

---

## Step 1: Create Neon Databases (5 min)

### Sign Up & Create Databases

1. **Go to**: https://neon.tech
2. **Sign up** with GitHub (FREE - no credit card)
3. **Create Project**: Name it "Project Manager"
4. **Create 3 databases in the same project**:

   **Database 1:**
   - Name: `project_manager_test`
   - Copy the connection string
   - Save as: `TEST_DATABASE_URL`

   **Database 2:**
   - Name: `project_manager_staging`
   - Copy the connection string
   - Save as: `STAGING_DATABASE_URL`

   **Database 3:**
   - Name: `project_manager`
   - Copy the connection string
   - Save as: `PRODUCTION_DATABASE_URL`

**Connection string format:**
```
postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

✅ **Done when**: You have 3 connection strings saved in a text file

---

## Step 2: Deploy to Vercel (8 min)

### Link GitHub & Deploy

1. **Go to**: https://vercel.com/signup
2. **Sign up** with GitHub (FREE)
3. **Click**: "Add New..." → "Project"
4. **Import**: `stevej1908/project-manager` repository
5. **Configure**:
   - Framework: Create React App (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `build`
6. **Click**: "Deploy" (will fail without env vars - that's OK!)

After first deployment, you'll get 3 URLs:
- **Production**: `https://project-manager-stevej1908.vercel.app`
- **Test**: `https://project-manager-git-test-stevej1908.vercel.app`
- **Staging**: `https://project-manager-git-staging-stevej1908.vercel.app`

**Save these URLs** - you'll need them!

✅ **Done when**: Project is linked to Vercel and you have 3 deployment URLs

---

## Step 3: Add Environment Variables in Vercel (7 min)

### Configure Each Environment

1. In Vercel, go to **Project Settings** → **Environment Variables**
2. For EACH variable below, add it **3 times** (once per environment)

### Required Variables

**Click "Add" 3 times for each variable:**

| Variable | Production Value | Test/Staging Value |
|----------|------------------|-------------------|
| `NODE_ENV` | `production` | `test` or `staging` |
| `DATABASE_URL` | Your `PRODUCTION_DATABASE_URL` from Step 1 | `TEST_DATABASE_URL` or `STAGING_DATABASE_URL` |
| `REACT_APP_API_URL` | `https://project-manager-stevej1908.vercel.app` | Your Test/Staging URL |
| `FRONTEND_URL` | `https://project-manager-stevej1908.vercel.app` | Your Test/Staging URL |
| `JWT_SECRET` | *(generate - see below)* | *(different secret)* |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | Same |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret | Same |
| `GOOGLE_REDIRECT_URI` | `https://project-manager-stevej1908.vercel.app/api/auth/google/callback` | Update with Test/Staging URL |

### Generate JWT Secrets

**Run this 3 times** (different secret per environment):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy each output and use for `JWT_SECRET`

### After Adding All Variables

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment → **"Redeploy"**

✅ **Done when**: All environment variables are configured and redeployed

---

## Step 4: Update Google OAuth (3 min)

### Add Vercel URLs to Google Console

1. **Go to**: https://console.cloud.google.com/
2. **Navigate**: APIs & Services → Credentials
3. **Click**: Your OAuth 2.0 Client ID
4. **Add Authorized JavaScript origins**:
   ```
   https://project-manager-stevej1908.vercel.app
   https://project-manager-git-test-stevej1908.vercel.app
   https://project-manager-git-staging-stevej1908.vercel.app
   ```

5. **Add Authorized redirect URIs**:
   ```
   https://project-manager-stevej1908.vercel.app/api/auth/google/callback
   https://project-manager-git-test-stevej1908.vercel.app/api/auth/google/callback
   https://project-manager-git-staging-stevej1908.vercel.app/api/auth/google/callback
   ```

6. **Click**: "Save"

✅ **Done when**: All 3 Vercel URLs are added to Google Console

---

## Step 5: Run Database Migrations (2 min)

### Apply Schema to All 3 Databases

**For TEST database:**
```bash
cd C:\Users\steve\Project-Manager\server
set DATABASE_URL=<paste TEST_DATABASE_URL here>
node run-all-migrations.js
```

**For STAGING database:**
```bash
set DATABASE_URL=<paste STAGING_DATABASE_URL here>
node run-all-migrations.js
```

**For PRODUCTION database:**
```bash
set DATABASE_URL=<paste PRODUCTION_DATABASE_URL here>
node run-all-migrations.js
```

**Expected output** (each time):
```
✅ All migrations completed successfully!
DATABASE SCHEMA READY!
```

✅ **Done when**: All 3 databases show "DATABASE SCHEMA READY!"

---

## 🎉 You're Live!

### Test Your Deployment

1. **Go to**: `https://project-manager-stevej1908.vercel.app`
2. **Click**: "Sign in with Google"
3. **Complete**: OAuth flow
4. **You should see**: Dashboard with "Create Project" button

### Test Functionality

- ✅ Create a new project
- ✅ Create a task
- ✅ Switch between Board and Gantt views
- ✅ Verify data persists

---

## 📊 What You Just Deployed

- ✅ **3 environments**: Test, Staging, Production
- ✅ **Auto-deploy**: Push to branch → auto deploy
- ✅ **3 databases**: Separate data per environment
- ✅ **OAuth**: Google authentication
- ✅ **Cost**: $0/month (all free tiers!)

---

## 🔄 Daily Workflow (After Deployment)

### Deploy New Features

```bash
# 1. Work locally
git checkout test
# ... make changes ...

# 2. Push to test
git add .
git commit -m "Add feature X"
git push origin test
# → Auto-deploys to TEST environment

# 3. Test at: https://project-manager-git-test-stevej1908.vercel.app

# 4. If good, promote to staging
git checkout staging
git merge test
git push origin staging
# → Auto-deploys to STAGING

# 5. UAT testing, then promote to production
git checkout master
git merge staging
git push origin master
# → Auto-deploys to PRODUCTION 🚀
```

---

## 🆘 Troubleshooting

### "Application Error" on Vercel
- ✅ Check environment variables are set correctly
- ✅ Check Vercel deployment logs
- ✅ Verify DATABASE_URL has `?sslmode=require`

### "OAuth redirect_uri_mismatch"
- ✅ Verify Vercel URL is in Google Console
- ✅ Check redirect URI matches exactly (including `/api/auth/google/callback`)
- ✅ Ensure using HTTPS (not HTTP)

### "Database connection failed"
- ✅ Verify DATABASE_URL is correct
- ✅ Check Neon database is not paused
- ✅ Ensure connection string has `?sslmode=require`

### Check Logs
```bash
# Vercel CLI (install with: npm i -g vercel)
vercel logs <deployment-url>
```

---

## 📚 Full Documentation

- **DEPLOY_NOW.md** - Comprehensive deployment guide
- **DEPLOYMENT_GUIDE.md** - Detailed walkthrough
- **DATABASE_SETUP_GUIDE.md** - Database management
- **SENTRY_SETUP.md** - Optional error tracking
- **.env.example** - All environment variables

---

## 🎯 Summary

**Time to complete**: 25 minutes
**Cost**: $0/month
**What you get**: Enterprise-grade 3-tier deployment infrastructure

Ready? Start with **Step 1** above! 🚀
