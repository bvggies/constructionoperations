# Database Seeding Guide

## Overview

This guide explains how to seed the Neon PostgreSQL database with initial data for development and production deployment.

## What Gets Seeded

The seeding script creates:

### Users
- **1 Admin user** (admin/admin123)
- **1 Manager user** (manager/manager123)
- **2 Supervisor users** (supervisor1, supervisor2 / supervisor123)
- **5 Worker users** (worker1-5 / worker123)

### Projects
- 3 sample construction projects with different statuses

### Sites
- 5 construction sites assigned to different supervisors

### Site Teams
- Workers assigned to various sites

### Materials
- 10 different construction materials (cement, steel, concrete blocks, etc.)

### Material Inventory
- Inventory records for all materials across all sites

### Equipment
- 8 pieces of equipment (excavators, cranes, mixers, etc.) with different statuses

### Tasks
- 8 sample tasks with various statuses and priorities

### Material Transactions
- Sample delivery transactions

### Attendance Records
- 7 days of attendance records for all workers

## Running the Seed Script

### Local Development

1. Make sure your `.env` file is configured with the database URL:
```env
DATABASE_URL=postgresql://neondb_owner:npg_IPuJvF7j8WzK@ep-purple-wave-ahboae4g-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

2. Navigate to the backend directory:
```bash
cd backend
```

3. Run the seed script:
```bash
npm run seed
```

### For Vercel Deployment

#### Option 1: Run Locally Before Deployment

1. Set your environment variables locally:
```bash
export DATABASE_URL="your-neon-database-url"
```

2. Run the seed script:
```bash
cd backend
npm run seed
```

#### Option 2: Use Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Link your project:
```bash
cd backend
vercel link
```

3. Pull environment variables:
```bash
vercel env pull
```

4. Run the seed script:
```bash
npm run seed
```

#### Option 3: Use the Seeding API Endpoint (Recommended for Vercel)

The application includes a seeding API endpoint that you can call after deployment:

1. **Set the SEED_SECRET environment variable in Vercel:**
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Add `SEED_SECRET` with a secure random string (e.g., `your-secure-random-secret-key`)

2. **Deploy your application to Vercel**

3. **Call the seeding endpoint:**
```bash
curl -X POST https://your-api.vercel.app/api/seed \
  -H "Authorization: Bearer your-secure-random-secret-key" \
  -H "Content-Type: application/json"
```

Or using a tool like Postman or Thunder Client:
- Method: POST
- URL: `https://your-api.vercel.app/api/seed`
- Headers:
  - `Authorization: Bearer your-secure-random-secret-key`
  - `Content-Type: application/json`

**Note:** The seeding endpoint is already included in the codebase at `backend/src/routes/seed.ts`. You just need to set the `SEED_SECRET` environment variable in Vercel.

## Default Credentials

After seeding, you can login with these credentials:

### Admin
- **Username:** `admin`
- **Password:** `admin123`
- **Dashboard:** `/dashboard/admin`

### Manager
- **Username:** `manager`
- **Password:** `manager123`
- **Dashboard:** `/dashboard/manager`

### Supervisor
- **Username:** `supervisor1` or `supervisor2`
- **Password:** `supervisor123`
- **Dashboard:** `/dashboard/supervisor`

### Worker
- **Username:** `worker1`, `worker2`, `worker3`, `worker4`, or `worker5`
- **Password:** `worker123`
- **Dashboard:** `/dashboard/worker`

## Important Notes

1. **Idempotent Seeding**: The script uses `ON CONFLICT DO NOTHING` clauses, so you can run it multiple times safely. It won't create duplicates.

2. **Existing Data**: If users or data already exist, the script will skip creating duplicates.

3. **Production Safety**: Always change default passwords in production environments.

4. **Database Connection**: Ensure your Neon database is accessible and the connection string is correct.

5. **Environment Variables**: Make sure all required environment variables are set before running the seed script.

## Troubleshooting

### Connection Issues
- Verify your DATABASE_URL is correct
- Check if SSL mode is required (Neon requires SSL)
- Ensure the database is accessible from your network

### Permission Errors
- Make sure the database user has INSERT permissions
- Check if tables exist (run the initialization script first)

### Duplicate Key Errors
- The script handles duplicates, but if you see errors, check for unique constraints
- You can safely re-run the script

## Resetting the Database

If you need to start fresh:

1. **Option 1: Drop and recreate tables**
   - Manually drop all tables in your database
   - Run the initialization script again
   - Run the seed script

2. **Option 2: Clear specific data**
   - Delete records from tables in reverse order of dependencies
   - Re-run the seed script

## Customizing Seed Data

To customize the seed data:

1. Edit `backend/src/scripts/seedDatabase.ts`
2. Modify the arrays (users, projects, sites, etc.)
3. Run `npm run seed` again

The script will add new data while preserving existing records.

