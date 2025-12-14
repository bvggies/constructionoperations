# Vercel Deployment Checklist

## ✅ Code Pushed to GitHub
Repository: https://github.com/bvggies/constructionoperations

## Backend Deployment Steps

### 1. Deploy Backend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository: `bvggies/constructionoperations`
4. Configure the project:
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### 2. Set Environment Variables (Backend)

In Vercel project settings, add these environment variables:

```
DATABASE_URL=postgresql://neondb_owner:npg_IPuJvF7j8WzK@ep-purple-wave-ahboae4g-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=production
SEED_SECRET=your-secure-random-secret-key
```

### 3. Deploy Backend

Click "Deploy" and wait for deployment to complete.

**Note:** Save your backend URL (e.g., `https://your-backend.vercel.app`)

## Frontend Deployment Steps

### 1. Deploy Frontend to Vercel

1. Create a new project in Vercel
2. Import the same GitHub repository: `bvggies/constructionoperations`
3. Configure the project:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### 2. Set Environment Variables (Frontend)

In Vercel project settings, add:

```
VITE_API_URL=https://your-backend.vercel.app/api
```

Replace `your-backend.vercel.app` with your actual backend URL.

### 3. Deploy Frontend

Click "Deploy" and wait for deployment to complete.

## Seed the Database

After backend deployment, seed your database:

### Option 1: Using API Endpoint (Recommended)

```bash
curl -X POST https://your-backend.vercel.app/api/seed \
  -H "Authorization: Bearer your-seed-secret" \
  -H "Content-Type: application/json"
```

Replace `your-seed-secret` with the value you set in `SEED_SECRET`.

### Option 2: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
cd backend
vercel link

# Pull environment variables
vercel env pull

# Run seed script
npm run seed
```

## Post-Deployment Verification

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Environment variables set correctly
- [ ] Database seeded with initial data
- [ ] Test login with default credentials
- [ ] Verify all dashboards are accessible
- [ ] Test API endpoints

## Default Login Credentials

After seeding:
- **Admin:** admin / admin123
- **Manager:** manager / manager123
- **Supervisor:** supervisor1 / supervisor123
- **Worker:** worker1 / worker123

⚠️ **Important:** Change these passwords in production!

## Troubleshooting

### Backend Issues
- Check Vercel function logs
- Verify DATABASE_URL is correct
- Ensure SSL mode is set in connection string

### Frontend Issues
- Verify VITE_API_URL points to correct backend
- Check browser console for errors
- Verify CORS settings in backend

### Database Connection
- Verify Neon database is accessible
- Check connection string format
- Ensure SSL mode is enabled

## Custom Domain Setup

1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update `VITE_API_URL` if needed

## Monitoring

- Monitor Vercel function logs
- Check Neon database dashboard
- Set up error tracking (optional)

