# Vercel Deployment Guide

## Quick Start

### 1. Backend Deployment

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Navigate to backend directory:**
```bash
cd backend
```

3. **Login to Vercel:**
```bash
vercel login
```

4. **Link your project:**
```bash
vercel link
```

5. **Set Environment Variables in Vercel Dashboard:**
   - Go to your project settings on Vercel
   - Navigate to Environment Variables
   - Add the following:
     - `DATABASE_URL`: Your Neon PostgreSQL connection string
     - `JWT_SECRET`: A secure random string for JWT tokens
     - `NODE_ENV`: `production`
     - `SEED_SECRET`: A secure random string for seeding (optional but recommended)

6. **Deploy:**
```bash
vercel --prod
```

### 2. Frontend Deployment

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Set Environment Variables:**
   - In Vercel dashboard, add:
     - `VITE_API_URL`: Your deployed backend URL (e.g., `https://your-backend.vercel.app/api`)

3. **Deploy:**
```bash
vercel --prod
```

### 3. Seed the Database

After deployment, seed your database using one of these methods:

#### Method 1: Using the API Endpoint (Recommended)

1. Set `SEED_SECRET` in Vercel environment variables
2. Call the seeding endpoint:
```bash
curl -X POST https://your-backend.vercel.app/api/seed \
  -H "Authorization: Bearer your-seed-secret" \
  -H "Content-Type: application/json"
```

#### Method 2: Using the Script Locally

1. Pull environment variables:
```bash
cd backend
vercel env pull
```

2. Run the seed script:
```bash
npm run seed
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://neondb_owner:npg_IPuJvF7j8WzK@ep-purple-wave-ahboae4g-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=5000
NODE_ENV=production
SEED_SECRET=your-secure-random-secret-key
```

### Frontend (.env)
```env
VITE_API_URL=https://your-backend.vercel.app/api
```

## Vercel Configuration

The `backend/vercel.json` file is already configured for Node.js deployment.

## Post-Deployment Checklist

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Environment variables set in Vercel
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

**⚠️ Important:** Change these passwords in production!

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct in Vercel
- Check if SSL mode is required (Neon requires SSL)
- Ensure the database allows connections from Vercel IPs

### API Not Working
- Check VITE_API_URL in frontend environment variables
- Verify CORS settings in backend
- Check Vercel function logs

### Seeding Fails
- Verify SEED_SECRET matches in request header
- Check database connection
- Review Vercel function logs for errors

## Custom Domain

To use a custom domain:
1. Go to Vercel project settings
2. Navigate to Domains
3. Add your custom domain
4. Update VITE_API_URL if needed

## Monitoring

- Check Vercel function logs for backend errors
- Monitor database connections in Neon dashboard
- Set up error tracking (Sentry, etc.) for production

