# Sentry Integration Guide - Free Tier

This guide shows you how to integrate Sentry for error tracking using the **FREE tier**.

## Benefits

- **Real-time error tracking** in production
- **User context** (who experienced the error)
- **Environment tracking** (test, staging, production)
- **Release tracking** (which version had the error)
- **Performance monitoring** (optional)
- **10,000 errors/month FREE** (more than enough for most apps)

---

## Step 1: Create Sentry Account (FREE)

1. Go to https://sentry.io/signup/
2. Sign up for a **FREE** account
3. Create a new project:
   - **Platform**: React
   - **Project Name**: project-manager
   - **Team**: Your team name

---

## Step 2: Get Your DSN

After creating the project, you'll see your **DSN** (Data Source Name):
```
https://xxxxxxxxxxxxx@o123456.ingest.sentry.io/789012
```

**Save this!** You'll need it for environment variables.

---

## Step 3: Install Sentry Packages

### Frontend (React)

```bash
npm install --save @sentry/react @sentry/tracing
```

### Backend (Node.js)

```bash
cd server
npm install --save @sentry/node @sentry/profiling-node
```

---

## Step 4: Configure Frontend Sentry

Create `src/sentry.js`:

```javascript
import * as Sentry from "@sentry/react";

export function initSentry() {
  // Only initialize in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // Set tracesSampleRate to 1.0 to capture 100% of transactions
      // In production, you may want to lower this (e.g., 0.1 = 10%)
      tracesSampleRate: 0.1,

      // Capture Replay for 10% of all sessions,
      // plus 100% of sessions with an error
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Environment
      environment: process.env.REACT_APP_ENVIRONMENT || 'production',

      // Release tracking (optional)
      release: process.env.REACT_APP_VERSION || '1.0.0',
    });
  }
}
```

Update `src/index.js`:

```javascript
import { initSentry } from './sentry';

// Initialize Sentry BEFORE rendering
initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
// ... rest of your code
```

---

## Step 5: Configure Backend Sentry

Update `server/server.js`:

```javascript
const Sentry = require("@sentry/node");
const { ProfilingIntegration } = require("@sentry/profiling-node");

// Initialize Sentry at the very top of your file
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new ProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}

const express = require('express');
const app = express();

// Sentry request handler must be the first middleware
if (process.env.NODE_ENV === 'production') {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// ... your routes ...

// Sentry error handler must be BEFORE other error handlers
if (process.env.NODE_ENV === 'production') {
  app.use(Sentry.Handlers.errorHandler());
}

// Your custom error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
```

---

## Step 6: Add Environment Variables

### Local Development (.env)
```bash
# Sentry (optional in development)
REACT_APP_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
REACT_APP_ENVIRONMENT=development
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Vercel Environment Variables

Add these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value | Environments |
|----------|-------|--------------|
| `REACT_APP_SENTRY_DSN` | Your Sentry DSN | Production, Staging, Test |
| `REACT_APP_ENVIRONMENT` | production/staging/test | Respective environment |
| `SENTRY_DSN` | Your Sentry DSN | Production, Staging, Test |
| `NODE_ENV` | production/staging/test | Respective environment |

---

## Step 7: Test Sentry Integration

### Frontend Test

Add a test button (remove after testing):

```javascript
<button onClick={() => {
  throw new Error("Sentry Test Error - Frontend");
}}>
  Test Sentry (Frontend)
</button>
```

### Backend Test

Add a test route (remove after testing):

```javascript
app.get('/api/sentry-test', (req, res) => {
  throw new Error("Sentry Test Error - Backend");
});
```

Visit these in your browser, then check your Sentry dashboard for the errors!

---

## Step 8: Configure Alerts (Optional)

In Sentry Dashboard:

1. Go to **Alerts** → **Create Alert**
2. Set up email/Slack notifications
3. Configure thresholds:
   - Alert me when there are **more than 10 errors in 1 hour**
   - Alert me when **error rate exceeds 1%**

---

## Step 9: User Context (Know Who Had the Error)

### Frontend

```javascript
import * as Sentry from "@sentry/react";

// After user logs in
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name,
});

// On logout
Sentry.setUser(null);
```

### Backend

```javascript
app.use((req, res, next) => {
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
    });
  }
  next();
});
```

---

## Free Tier Limits

✅ **10,000 errors/month** - More than enough for small-medium apps
✅ **Unlimited team members**
✅ **90 days of error history**
✅ **Email alerts**
✅ **Source maps** (see exact line of error in your code)
✅ **User context**
✅ **Release tracking**

❌ **No Slack/Discord integrations** (upgrade to $26/mo for this)
❌ **No Performance Monitoring beyond 10k transactions/mo**

---

## Best Practices

1. **Only enable in production** (or use different DSNs for test/staging/prod)
2. **Set appropriate sample rates** (0.1 = 10% to stay within free tier)
3. **Add source maps** in production builds
4. **Set user context** to know who experienced errors
5. **Create alerts** for critical errors
6. **Use releases** to track which version has issues

---

## Alternative: LogRocket (Free Tier)

If you want **session replay** (see exactly what the user did before the error):

- **LogRocket**: 1,000 sessions/month FREE
- Similar integration to Sentry
- Records user actions, console logs, network requests

Both Sentry and LogRocket can be used together!

---

## Summary

✅ **Sentry FREE tier is perfect for this app**
✅ **10,000 errors/month is plenty**
✅ **Setup takes ~15 minutes**
✅ **Automatic error reporting in production**
✅ **Know exactly when and where errors happen**

Next: Deploy to Vercel and test error tracking in production!
