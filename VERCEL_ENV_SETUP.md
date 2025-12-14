# Vercel Environment Variables Setup

## Critical: Set Environment Variables in Vercel

The login is failing because the frontend cannot find the backend API. You **MUST** set the environment variable in Vercel.

## Frontend Environment Variable

### Step 1: Go to Vercel Dashboard
1. Navigate to your frontend project in Vercel
2. Go to **Settings** → **Environment Variables**

### Step 2: Add Environment Variable
- **Key:** `VITE_API_URL`
- **Value:** `https://constructionoperations-backend.vercel.app/api`
- **Environment:** Production, Preview, Development (select all)

**Important:** 
- Make sure the URL includes `/api` at the end
- Replace `constructionoperations-backend.vercel.app` with your actual backend URL if different
- The URL should NOT have a trailing slash after `/api`

### Step 3: Redeploy
After adding the environment variable, you **must redeploy** the frontend:
1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Make sure to check **"Use existing Build Cache"** is **UNCHECKED** to rebuild with new env vars

## Backend Environment Variables

Make sure these are set in your **backend** Vercel project:

- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `JWT_SECRET` - A secure random string
- `NODE_ENV` - `production`
- `SEED_SECRET` - A secure random string (for seeding endpoint)

## Verify Configuration

After redeploying, check the browser console:
1. Open your frontend URL
2. Open Developer Tools (F12)
3. Check the Console tab
4. You should see: `API Base URL: https://constructionoperations-backend.vercel.app/api`

If you see a different URL or `http://localhost:5000/api`, the environment variable is not set correctly.

## Troubleshooting

### Still getting 404 errors?
1. Verify the backend URL is correct
2. Test the backend directly: `https://constructionoperations-backend.vercel.app/health`
3. Check that the backend is deployed and running
4. Verify the environment variable is set for the correct environment (Production/Preview)

### CORS errors?
- The backend should have CORS enabled (it does in the code)
- Check backend logs in Vercel for CORS-related errors

### Storage access errors?
- These are usually from browser extensions blocking localStorage
- Try in incognito mode or disable extensions
- The app should still work despite these warnings

