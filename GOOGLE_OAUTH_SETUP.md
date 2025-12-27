# 🔐 Google OAuth Configuration - Add Vercel URLs

**Your Vercel Production URL**: `https://project-manager-lyart.vercel.app`

---

## Step 1: Go to Google Cloud Console

1. Open: **https://console.cloud.google.com/**
2. Sign in with your Google account
3. Make sure you're in the correct project

---

## Step 2: Navigate to OAuth Credentials

1. Click the **hamburger menu** (☰) in the top left
2. Go to: **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID:
   - Client ID: `1035068980440-71i4b7b6nqk5t7krnl5un4qsgm85n5ed.apps.googleusercontent.com`
4. **Click on the Client ID** to edit it

---

## Step 3: Add Authorized JavaScript Origins

Scroll to the **"Authorized JavaScript origins"** section and add these URLs:

### Click "+ ADD URI" and add:

1. `https://project-manager-lyart.vercel.app`
2. `https://project-manager-git-test-tyart.vercel.app`
3. `https://project-manager-git-staging-tyart.vercel.app`

**Total**: 3 new URIs (plus any existing ones like localhost)

---

## Step 4: Add Authorized Redirect URIs

Scroll to the **"Authorized redirect URIs"** section and add these URLs:

### Click "+ ADD URI" and add:

1. `https://project-manager-lyart.vercel.app/api/auth/google/callback`
2. `https://project-manager-git-test-tyart.vercel.app/api/auth/google/callback`
3. `https://project-manager-git-staging-tyart.vercel.app/api/auth/google/callback`

**Total**: 3 new redirect URIs (plus any existing ones like localhost)

---

## Step 5: Save Changes

1. Click **"Save"** at the bottom of the page
2. Wait for the confirmation message

---

## ✅ Final Configuration

Your OAuth should have:

### Authorized JavaScript origins:
```
http://localhost:3000
https://project-manager-lyart.vercel.app
https://project-manager-git-test-tyart.vercel.app
https://project-manager-git-staging-tyart.vercel.app
```

### Authorized redirect URIs:
```
http://localhost:5000/api/auth/google/callback
https://project-manager-lyart.vercel.app/api/auth/google/callback
https://project-manager-git-test-tyart.vercel.app/api/auth/google/callback
https://project-manager-git-staging-tyart.vercel.app/api/auth/google/callback
```

---

## 📋 Quick Copy/Paste

**JavaScript Origins (copy all 3 at once if possible):**
```
https://project-manager-lyart.vercel.app
https://project-manager-git-test-tyart.vercel.app
https://project-manager-git-staging-tyart.vercel.app
```

**Redirect URIs (copy all 3 at once if possible):**
```
https://project-manager-lyart.vercel.app/api/auth/google/callback
https://project-manager-git-test-tyart.vercel.app/api/auth/google/callback
https://project-manager-git-staging-tyart.vercel.app/api/auth/google/callback
```

---

**Let me know when you're done adding these to Google Console!**
