# Google Cloud Platform Setup Guide

This guide will walk you through setting up Google OAuth and enabling the required APIs for the Project Manager application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter project details:
   - **Project name**: `Project Manager App` (or your preferred name)
   - **Organization**: Leave as default or select your organization
5. Click **"Create"**
6. Wait for the project to be created (this may take a few seconds)

## Step 2: Enable Required APIs

You need to enable the following APIs for your project:

### 2.1 Enable Google+ API (for OAuth user info)

1. In the Google Cloud Console, ensure your project is selected
2. Go to **"APIs & Services" > "Library"**
3. Search for **"Google+ API"** or **"People API"**
4. Click on it and then click **"Enable"**

### 2.2 Enable Google Contacts API

1. In the API Library, search for **"People API"** (this provides contacts access)
2. Click on it and then click **"Enable"**

### 2.3 Enable Google Drive API

1. In the API Library, search for **"Google Drive API"**
2. Click on it and then click **"Enable"**

### 2.4 Enable Gmail API

1. In the API Library, search for **"Gmail API"**
2. Click on it and then click **"Enable"**

## Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services" > "OAuth consent screen"**
2. Select **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**

### 3.1 App Information

Fill in the following required fields:

- **App name**: `Project Manager`
- **User support email**: Your email address
- **App logo**: (Optional) Upload a logo
- **Application home page**: `http://localhost:3000` (for development)
- **Application privacy policy**: (Optional for development)
- **Application terms of service**: (Optional for development)
- **Authorized domains**: Leave empty for development
- **Developer contact information**: Your email address

Click **"Save and Continue"**

### 3.2 Scopes

1. Click **"Add or Remove Scopes"**
2. Add the following scopes:
   - `userinfo.email` - View your email address
   - `userinfo.profile` - View your basic profile info
   - `contacts.readonly` - View your contacts
   - `drive.file` - View and manage Google Drive files
   - `gmail.readonly` - Read your email messages

   You can filter by typing in the search box or manually entering:
   ```
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   https://www.googleapis.com/auth/contacts.readonly
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/gmail.readonly
   ```

3. Click **"Update"** at the bottom
4. Click **"Save and Continue"**

### 3.3 Test Users (for Development)

1. Click **"Add Users"**
2. Add your email address and any other test user emails
3. Click **"Add"**
4. Click **"Save and Continue"**

### 3.4 Summary

Review your settings and click **"Back to Dashboard"**

## Step 4: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials" > "OAuth client ID"**
3. Select **"Web application"** as the application type
4. Configure the OAuth client:

   **Name**: `Project Manager Web Client`

   **Authorized JavaScript origins**:
   - `http://localhost:3000` (React frontend)
   - `http://localhost:5000` (Express backend)

   **Authorized redirect URIs**:
   - `http://localhost:5000/api/auth/google/callback`

5. Click **"Create"**

### 4.1 Save Your Credentials

A dialog will appear with your credentials:

- **Client ID**: Copy this (looks like: `xxxxx.apps.googleusercontent.com`)
- **Client Secret**: Copy this

⚠️ **IMPORTANT**: Save these credentials securely. You'll need them for your `.env` file.

Click **"OK"** to close the dialog.

## Step 5: Configure Your Application

1. Navigate to your project's `server` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp server/.env.example server/.env
   ```

3. Open `server/.env` and add your credentials:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
   ```

## Step 6: Test Your Setup

1. Start your backend server:
   ```bash
   cd server
   npm install
   npm run dev
   ```

2. Visit `http://localhost:5000/api/health` to ensure the server is running

3. The Google OAuth flow will be tested when you implement the login functionality in your frontend

## Production Deployment

When deploying to production, you'll need to:

1. **Update OAuth Consent Screen**:
   - Change user type to "Internal" (for Google Workspace) or keep "External" and verify
   - Add your production domain to authorized domains

2. **Update OAuth Credentials**:
   - Add your production URLs to:
     - Authorized JavaScript origins: `https://yourdomain.com`
     - Authorized redirect URIs: `https://yourdomain.com/api/auth/google/callback`

3. **Update Environment Variables**:
   - Update `GOOGLE_REDIRECT_URI` to your production callback URL
   - Update `FRONTEND_URL` to your production frontend URL

4. **Security Considerations**:
   - Never commit your `.env` file to version control
   - Use environment variables in your hosting platform
   - Consider using Google Cloud Secret Manager for production secrets

## Troubleshooting

### Error: "Access blocked: This app's request is invalid"

- Check that all required APIs are enabled
- Verify that your redirect URI matches exactly (including http/https)
- Make sure your email is added as a test user in the OAuth consent screen

### Error: "invalid_client"

- Verify your Client ID and Client Secret are correct
- Check that there are no extra spaces in your `.env` file
- Ensure the redirect URI in your code matches the one in Google Cloud Console

### Error: "redirect_uri_mismatch"

- The redirect URI in your request must exactly match one configured in Google Cloud Console
- Check for trailing slashes and http vs https

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Gmail API Documentation](https://developers.google.com/gmail/api/guides)
- [People API (Contacts) Documentation](https://developers.google.com/people)

## Support

If you encounter any issues not covered in this guide, please check:
- Google Cloud Console error logs
- Your server console for error messages
- The application README.md for additional setup steps
