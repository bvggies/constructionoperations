# Setup Guide

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
DATABASE_URL=postgresql://neondb_owner:npg_IPuJvF7j8WzK@ep-purple-wave-ahboae4g-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=5000
NODE_ENV=development
```

Start the server:
```bash
npm run dev
```

The database tables will be created automatically on first run.

### 2. Create Admin User

After the server starts, create an admin user:

```bash
npm run create-admin [username] [email] [password] [full_name]
```

Example:
```bash
npm run create-admin admin admin@example.com admin123 "Admin User"
```

Or use default values:
```bash
npm run create-admin
```

This will create:
- Username: admin
- Email: admin@example.com
- Password: admin123
- Full Name: Administrator

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the development server:
```bash
npm run dev
```

### 4. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

Login with the admin credentials you created.

## Database Schema

The database schema is automatically initialized when you start the backend server. All tables are created with proper relationships, indexes, and constraints.

## Features Overview

### User Roles

- **Admin**: Full system access
- **Manager**: Project and resource management
- **Supervisor**: Site and team management
- **Worker**: Task execution and attendance

### Key Modules

1. **Projects & Sites**: Organize construction projects and sites
2. **Tasks**: Assign and track work tasks
3. **Materials**: Inventory management and requisitions
4. **Equipment**: Track equipment status and maintenance
5. **Attendance**: Clock in/out and attendance records
6. **Documents**: File upload and management
7. **Notifications**: System alerts and updates
8. **Reports**: Analytics and dashboards

## Troubleshooting

### Database Connection Issues

- Verify the DATABASE_URL in `.env` is correct
- Check if SSL mode is required (Neon PostgreSQL requires SSL)
- Ensure the database is accessible from your network

### Port Already in Use

- Change the PORT in backend `.env` file
- Update VITE_API_URL in frontend `.env` accordingly

### Module Not Found Errors

- Run `npm install` in both backend and frontend directories
- Delete `node_modules` and `package-lock.json`, then reinstall

## Production Deployment

### Backend (Vercel)

1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to backend: `cd backend`
3. Deploy: `vercel`
4. Set environment variables in Vercel dashboard

### Frontend (Vercel)

1. Navigate to frontend: `cd frontend`
2. Deploy: `vercel`
3. Set VITE_API_URL to your backend URL

### Environment Variables for Production

**Backend:**
- DATABASE_URL
- JWT_SECRET (use a strong random string)
- PORT (optional, Vercel sets this)
- NODE_ENV=production

**Frontend:**
- VITE_API_URL (your deployed backend URL)

## Support

For issues or questions, please check the main README.md file or create an issue in the repository.

