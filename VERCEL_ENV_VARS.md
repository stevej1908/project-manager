# 🔧 Vercel Environment Variables - Ready to Copy/Paste

**Your URLs**:
- **Production**: `https://project-manager-tyart.vercel.app`
- **Test**: `https://project-manager-git-test-tyart.vercel.app`
- **Staging**: `https://project-manager-git-staging-tyart.vercel.app`

---

## 📋 How to Add Environment Variables in Vercel

You're already in Settings. Now:

1. Click **"Environment Variables"** in the left sidebar (I can see it in your screenshot)
2. For EACH variable below, click **"Add New"**
3. Enter the **Key** (variable name)
4. Enter the **Value** (copy from tables below)
5. Select the **Environment** (Production, Preview, or both)
6. Click **"Save"**

---

## ✅ Environment Variables to Add (8 Variables × 3 Environments)

### Variable 1: NODE_ENV

**Key**: `NODE_ENV`

| Environment | Value | Select |
|-------------|-------|--------|
| Production | `production` | ✅ Production |
| Preview (Test) | `test` | ✅ Preview |
| Preview (Staging) | `staging` | ✅ Preview |

**How to add**:
- Click "Add New"
- Key: `NODE_ENV`
- Value: `production`
- Check: **Production** only
- Click Save
- Click "Add New" again
- Key: `NODE_ENV`
- Value: `test`
- Check: **Preview** only
- Click Save

---

### Variable 2: DATABASE_URL

**Key**: `DATABASE_URL`

| Environment | Value |
|-------------|-------|
| **Production** | `postgresql://neondb_owner:npg_HMJYpZb4Py9G@ep-aged-voice-afd7coyh-pooler.c-2.us-west-2.aws.neon.tech/project_manager?sslmode=require` |
| **Preview (for test branch)** | `postgresql://neondb_owner:npg_HMJYpZb4Py9G@ep-aged-voice-afd7coyh-pooler.c-2.us-west-2.aws.neon.tech/project_manager_test?sslmode=require` |
| **Preview (for staging branch)** | `postgresql://neondb_owner:npg_HMJYpZb4Py9G@ep-aged-voice-afd7coyh-pooler.c-2.us-west-2.aws.neon.tech/project_manager_staging?sslmode=require` |

**Note**: Preview environment doesn't distinguish between test and staging. For now:
- Add Production value with **Production** checked
- Add Test value with **Preview** checked
- We'll configure branch-specific later if needed

---

### Variable 3: REACT_APP_API_URL

**Key**: `REACT_APP_API_URL`

| Environment | Value | Select |
|-------------|-------|--------|
| Production | `https://project-manager-tyart.vercel.app` | ✅ Production |
| Preview | `https://project-manager-tyart.vercel.app` | ✅ Preview |

**Note**: For now, all environments point to production API. You can update preview later if needed.

---

### Variable 4: FRONTEND_URL

**Key**: `FRONTEND_URL`

| Environment | Value | Select |
|-------------|-------|--------|
| Production | `https://project-manager-tyart.vercel.app` | ✅ Production |
| Preview | `https://project-manager-tyart.vercel.app` | ✅ Preview |

---

### Variable 5: JWT_SECRET

**Key**: `JWT_SECRET`

| Environment | Value | Select |
|-------------|-------|--------|
| **Production** | `28eec798f6a653b004f725236db62553d47f3fd3388c09a588fe5209c5f98782503056b9b58c9ba08f0c8c2f4574c198a6b34a2d737fc52297283a0caf657664` | ✅ Production |
| **Preview** | `65978175458cb025321d7ed2ae625c5be02dac3086e6dd07634d5f94be151da267ea9f30dc43d238f6b883ee7e74b908266a8d5d7c4cb4e0157859b10bb75825` | ✅ Preview |

---

### Variable 6: GOOGLE_CLIENT_ID

**Key**: `GOOGLE_CLIENT_ID`

| Environment | Value | Select |
|-------------|-------|--------|
| All | `1035068980440-71i4b7b6nqk5t7krnl5un4qsgm85n5ed.apps.googleusercontent.com` | ✅ Production, ✅ Preview |

**Note**: Same value for all environments. Select BOTH Production and Preview when adding.

---

### Variable 7: GOOGLE_CLIENT_SECRET

**Key**: `GOOGLE_CLIENT_SECRET`

| Environment | Value | Select |
|-------------|-------|--------|
| All | `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` | ✅ Production, ✅ Preview |

**Note**: Same value for all environments. Select BOTH Production and Preview when adding.

---

### Variable 8: GOOGLE_REDIRECT_URI

**Key**: `GOOGLE_REDIRECT_URI`

| Environment | Value | Select |
|-------------|-------|--------|
| Production | `https://project-manager-tyart.vercel.app/api/auth/google/callback` | ✅ Production |
| Preview | `https://project-manager-tyart.vercel.app/api/auth/google/callback` | ✅ Preview |

**Note**: For now all point to production. Can update later for separate test/staging OAuth.

---

## 📝 Quick Copy/Paste List

Here's a simplified list you can reference:

```
# Production Environment
NODE_ENV=production
DATABASE_URL=postgresql://neondb_owner:npg_HMJYpZb4Py9G@ep-aged-voice-afd7coyh-pooler.c-2.us-west-2.aws.neon.tech/project_manager?sslmode=require
REACT_APP_API_URL=https://project-manager-tyart.vercel.app
FRONTEND_URL=https://project-manager-tyart.vercel.app
JWT_SECRET=28eec798f6a653b004f725236db62553d47f3fd3388c09a588fe5209c5f98782503056b9b58c9ba08f0c8c2f4574c198a6b34a2d737fc52297283a0caf657664
GOOGLE_CLIENT_ID=1035068980440-71i4b7b6nqk5t7krnl5un4qsgm85n5ed.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://project-manager-tyart.vercel.app/api/auth/google/callback

# Preview Environment (Test)
NODE_ENV=test
DATABASE_URL=postgresql://neondb_owner:npg_HMJYpZb4Py9G@ep-aged-voice-afd7coyh-pooler.c-2.us-west-2.aws.neon.tech/project_manager_test?sslmode=require
REACT_APP_API_URL=https://project-manager-tyart.vercel.app
FRONTEND_URL=https://project-manager-tyart.vercel.app
JWT_SECRET=65978175458cb025321d7ed2ae625c5be02dac3086e6dd07634d5f94be151da267ea9f30dc43d238f6b883ee7e74b908266a8d5d7c4cb4e0157859b10bb75825
GOOGLE_CLIENT_ID=1035068980440-71i4b7b6nqk5t7krnl5un4qsgm85n5ed.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://project-manager-tyart.vercel.app/api/auth/google/callback
```

---

## ✅ Checklist

As you add each variable, check it off:

- [ ] NODE_ENV (Production)
- [ ] NODE_ENV (Preview)
- [ ] DATABASE_URL (Production)
- [ ] DATABASE_URL (Preview)
- [ ] REACT_APP_API_URL (Production & Preview)
- [ ] FRONTEND_URL (Production & Preview)
- [ ] JWT_SECRET (Production)
- [ ] JWT_SECRET (Preview)
- [ ] GOOGLE_CLIENT_ID (Production & Preview)
- [ ] GOOGLE_CLIENT_SECRET (Production & Preview)
- [ ] GOOGLE_REDIRECT_URI (Production & Preview)

---

## 🚀 After Adding All Variables

1. **Redeploy**:
   - Go to "Deployments" tab
   - Click on the failed deployment
   - Click "Redeploy" button

2. **OR** trigger a new deployment:
   - Make a small change to your code
   - Push to master branch
   - Vercel will auto-deploy

---

## ⏭️ Next Steps After Deployment

Once deployment succeeds, we'll:
1. Update Google OAuth with Vercel URLs
2. Run database migrations
3. Test the app!

Let me know when you've added all the environment variables!
