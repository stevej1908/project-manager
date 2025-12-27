# 🔧 CRITICAL FIX: Update REACT_APP_API_URL

## The Problem:

The frontend is calling `/auth/google` instead of `/api/auth/google` because the API URL is missing the `/api` path.

**Current value**: `https://project-manager-api-one.vercel.app`
**Correct value**: `https://project-manager-api-one.vercel.app/api`

## Fix via Vercel Dashboard:

### 1. Go to Vercel Dashboard:
**URL**: https://vercel.com/steve-jennings-projects/project-manager/settings/environment-variables

### 2. Find REACT_APP_API_URL:
Scroll down to find the `REACT_APP_API_URL` variable for **Production**

### 3. Edit the variable:
- Click the three dots (...) next to `REACT_APP_API_URL` (Production)
- Click "Edit"
- Change the value from:
  ```
  https://project-manager-api-one.vercel.app
  ```
  to:
  ```
  https://project-manager-api-one.vercel.app/api
  ```
- Click "Save"

### 4. Redeploy:
After saving, you MUST redeploy for the change to take effect:
- Go to Deployments tab
- Find the latest production deployment
- Click the three dots (...)
- Click "Redeploy"
- OR just run: `vercel --prod --yes` from the project root

---

## Alternative: Quick CLI Fix

If you prefer the command line, run this:

```bash
cd C:/Users/steve/Project-Manager
vercel --prod --yes
```

Then go to the Vercel dashboard and manually update the environment variable as described above, then redeploy again.

---

## After the fix:

The frontend should successfully call:
- ✅ `https://project-manager-api-one.vercel.app/api/auth/google`

Instead of:
- ❌ `https://project-manager-api-one.vercel.app/auth/google`
