# 🔧 Deployment Configuration - Ready to Copy/Paste

**Generated**: December 26, 2025
**Status**: Ready for Vercel configuration

---

## 📋 Step-by-Step Deployment Guide

Follow these steps in order. I'll guide you through each one.

---

## Step 1: Create Neon Databases (5 minutes)

### Instructions:

1. **Open**: https://neon.tech in your browser
2. **Click**: "Sign Up" (top right)
3. **Sign up with GitHub** (easiest - one click)
4. **Verify your email** if prompted
5. **Click**: "Create a project"
   - Project name: `Project Manager`
   - Region: Select closest to you (e.g., `US East (Ohio)` or `US West (Oregon)`)
   - Click "Create Project"

### Create Database 1: TEST

6. In the project dashboard, click **"Databases"** tab (left sidebar)
7. Click **"Create Database"** button
8. Enter database name: `project_manager_test`
9. Click **"Create"**
10. Click **"Connection string"** dropdown
11. **Copy the entire connection string** (it looks like: `postgresql://username:password@ep-...`)
12. **Paste it in a text file** and label it `TEST_DATABASE_URL`

### Create Database 2: STAGING

13. Click **"Create Database"** button again
14. Enter database name: `project_manager_staging`
15. Click **"Create"**
16. **Copy the connection string**
17. **Save it** as `STAGING_DATABASE_URL`

### Create Database 3: PRODUCTION

18. Click **"Create Database"** button again
19. Enter database name: `project_manager`
20. Click **"Create"**
21. **Copy the connection string**
22. **Save it** as `PRODUCTION_DATABASE_URL`

### ✅ Checkpoint:

You should now have a text file with 3 connection strings that look like:
```
TEST_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/project_manager_test?sslmode=require

STAGING_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/project_manager_staging?sslmode=require

PRODUCTION_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/project_manager?sslmode=require
```

**Tell me when you're done with this step and have all 3 URLs!**

---

## Step 2: Deploy to Vercel (8 minutes)

### Instructions:

1. **Open**: https://vercel.com/signup
2. **Click**: "Continue with GitHub"
3. **Authorize Vercel** to access your GitHub account
4. **Click**: "Add New..." → "Project"
5. **Find your repository**: Search for `project-manager` or `stevej1908/project-manager`
6. **Click**: "Import" next to your repository

### Configure Project:

7. **Framework Preset**: Should auto-detect "Create React App" ✅
8. **Root Directory**: Leave as `./` (default)
9. **Build Command**: Should show `npm run build` ✅
10. **Output Directory**: Should show `build` ✅
11. **Install Command**: Should show `npm install` ✅

### Important - Don't add environment variables yet:

12. **Scroll down** past the "Environment Variables" section (we'll add these next)
13. **Click**: "Deploy" button

The deployment will start and likely fail - that's OK! We need to add environment variables first.

### Get Your Vercel URLs:

14. After deployment completes (success or failure), you'll see your project dashboard
15. Note the deployment URL - it will be something like:
    - Production: `https://project-manager-stevej1908.vercel.app`
    - Or: `https://project-manager-<random>.vercel.app`

16. **Copy this URL** and save it

17. To get preview URLs:
    - Test: `https://project-manager-git-test-stevej1908.vercel.app`
    - Staging: `https://project-manager-git-staging-stevej1908.vercel.app`

**Tell me your production Vercel URL when you get it!**

---

## Step 3: Configure Environment Variables (7 minutes)

### Pre-generated Secrets:

I've already generated your JWT secrets:

**TEST Environment:**
```
JWT_SECRET=65978175458cb025321d7ed2ae625c5be02dac3086e6dd07634d5f94be151da267ea9f30dc43d238f6b883ee7e74b908266a8d5d7c4cb4e0157859b10bb75825
```

**STAGING Environment:**
```
JWT_SECRET=b96545941b88f7b98f97a045bbb23e96419633a73a1d1d1468e1c4a8eb5ae42def800e8e95d809e03e6c595e0a4239cb9f8a621bf3b698dae8dce959fa87b9f2
```

**PRODUCTION Environment:**
```
JWT_SECRET=28eec798f6a653b004f725236db62553d47f3fd3388c09a588fe5209c5f98782503056b9b58c9ba08f0c8c2f4574c198a6b34a2d737fc52297283a0caf657664
```

### Your Google OAuth Credentials:

```
GOOGLE_CLIENT_ID=1035068980440-71i4b7b6nqk5t7krnl5un4qsgm85n5ed.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### Instructions for Adding to Vercel:

1. In your Vercel project, click **"Settings"** tab
2. Click **"Environment Variables"** in the left sidebar
3. For each variable below, you'll add it **3 times** (once for each environment)

### How to Add Each Variable:

1. Click **"Add New"** button
2. Enter the **Key** (variable name)
3. Enter the **Value** (from tables below)
4. Select which environment(s):
   - For Production values: Check **"Production"**
   - For Preview values: Check **"Preview"**
5. Click **"Save"**

---

## 📊 Environment Variables to Add

### Once you have your Vercel URLs, I'll generate the complete list for you.

**TELL ME:**
1. ✅ Your 3 Neon database URLs (from Step 1)
2. ✅ Your Vercel production URL (from Step 2)

Then I'll create a complete copy/paste list for all environment variables!

---

## Step 4: Update Google OAuth (3 minutes)

### Instructions:

1. **Open**: https://console.cloud.google.com/
2. **Select your project** (if you have multiple)
3. **Navigate**: Click the hamburger menu (☰) → "APIs & Services" → "Credentials"
4. **Click** on your OAuth 2.0 Client ID:
   - Name: `Web client 1` or similar
   - Client ID: `1035068980440-71i4b7b6nqk5t7krnl5un4qsgm85n5ed.apps.googleusercontent.com`

### Add Authorized JavaScript Origins:

5. Scroll to **"Authorized JavaScript origins"**
6. Click **"+ ADD URI"** and add these 3 URLs (I'll give you exact URLs once you provide your Vercel URL):
   ```
   https://your-production-url.vercel.app
   https://your-test-url.vercel.app
   https://your-staging-url.vercel.app
   ```

### Add Authorized Redirect URIs:

7. Scroll to **"Authorized redirect URIs"**
8. Click **"+ ADD URI"** and add these 3 URLs:
   ```
   https://your-production-url.vercel.app/api/auth/google/callback
   https://your-test-url.vercel.app/api/auth/google/callback
   https://your-staging-url.vercel.app/api/auth/google/callback
   ```

9. Click **"Save"** at the bottom

**I'll give you the exact URLs to add once you provide your Vercel URL!**

---

## Step 5: Run Database Migrations (2 minutes)

### Once you have your Neon database URLs, run these commands:

**For TEST database:**
```bash
cd C:\Users\steve\Project-Manager\server
set DATABASE_URL=<YOUR_TEST_DATABASE_URL>
node run-all-migrations.js
```

**For STAGING database:**
```bash
set DATABASE_URL=<YOUR_STAGING_DATABASE_URL>
node run-all-migrations.js
```

**For PRODUCTION database:**
```bash
set DATABASE_URL=<YOUR_PRODUCTION_DATABASE_URL>
node run-all-migrations.js
```

**I can help you run these once you provide the database URLs!**

---

## 🚦 Current Status

- ✅ JWT secrets generated (above)
- ✅ Google OAuth credentials identified
- ⏳ Waiting for: Neon database URLs (Step 1)
- ⏳ Waiting for: Vercel production URL (Step 2)

---

## 📝 Next Action for You:

**Start with Step 1**: Go to https://neon.tech and create your 3 databases.

When you're done, tell me:
1. Your 3 database connection strings
2. Your Vercel production URL

Then I'll generate the complete environment variable configuration for you!

**Let me know when you're ready to start or if you have any questions!** 🚀
