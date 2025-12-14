# Construction Operations Tracker

A comprehensive web application for managing construction site operations, built with Vite, React, TypeScript, Express, and PostgreSQL.

## Features

- **User Management**: Role-based access control (Admin, Manager, Supervisor, Worker)
- **Project & Site Management**: Create and manage construction projects and sites
- **Task Tracking**: Assign and track tasks with progress updates
- **Material Management**: Track inventory, deliveries, and requisitions
- **Equipment Tracking**: Monitor equipment status, usage, and maintenance
- **Attendance System**: Clock in/out and track worker attendance
- **Document Management**: Upload and manage project documents
- **Notifications**: Real-time alerts for tasks, materials, and equipment
- **Reporting & Analytics**: Dashboard with charts and reports
- **Audit Trail**: Complete logging of all system changes

## Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: Neon PostgreSQL
- **Hosting**: GitHub + Vercel

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon PostgreSQL)

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
DATABASE_URL=postgresql://neondb_owner:npg_IPuJvF7j8WzK@ep-purple-wave-ahboae4g-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=5000
NODE_ENV=development
```

4. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory:
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Database Setup

The database schema is automatically created when you start the backend server for the first time. The `initializeDatabase()` function in `backend/src/config/initDatabase.ts` will create all necessary tables.

## Default Credentials

After the first run, you can register a new admin user through the registration endpoint or create one directly in the database.

## Project Structure

```
construction-operationaltracker/
├── backend/
│   ├── src/
│   │   ├── config/          # Database and configuration
│   │   ├── middleware/      # Auth and audit middleware
│   │   ├── routes/          # API routes
│   │   ├── utils/           # Utility functions
│   │   └── index.ts         # Server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── lib/             # API client and utilities
│   │   ├── pages/           # Page components
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `GET /api/projects/:id/sites` - Get project sites

### Sites
- `GET /api/sites` - Get all sites
- `POST /api/sites` - Create site
- `PUT /api/sites/:id` - Update site
- `POST /api/sites/:id/assign-worker` - Assign worker to site

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `POST /api/tasks/:id/updates` - Add task progress update

### Materials
- `GET /api/materials` - Get all materials
- `GET /api/materials/inventory/:site_id` - Get site inventory
- `POST /api/materials/transactions` - Record material transaction
- `POST /api/materials/requisitions` - Create requisition

### Equipment
- `GET /api/equipment` - Get all equipment
- `POST /api/equipment` - Create equipment
- `POST /api/equipment/:id/usage` - Record equipment usage
- `POST /api/equipment/:id/breakdown` - Report breakdown

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `POST /api/attendance/leave-requests` - Create leave request

### Documents
- `GET /api/documents` - Get all documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/:id/download` - Download document

### Notifications
- `GET /api/notifications` - Get notifications
- `PATCH /api/notifications/:id/read` - Mark as read

### Reports
- `GET /api/reports/dashboard` - Get dashboard data
- `GET /api/reports/tasks/progress` - Task progress report
- `GET /api/reports/materials/usage` - Material usage report

## Deployment

### Backend (Vercel)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
cd backend
vercel
```

### Frontend (Vercel)

1. Deploy:
```bash
cd frontend
vercel
```

Make sure to set environment variables in Vercel dashboard.

## License

MIT

