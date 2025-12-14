import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from '../src/config/initDatabase';
import { auditLog } from '../src/middleware/audit';

// Routes
import authRoutes from '../src/routes/auth';
import userRoutes from '../src/routes/users';
import projectRoutes from '../src/routes/projects';
import siteRoutes from '../src/routes/sites';
import taskRoutes from '../src/routes/tasks';
import materialRoutes from '../src/routes/materials';
import equipmentRoutes from '../src/routes/equipment';
import attendanceRoutes from '../src/routes/attendance';
import documentRoutes from '../src/routes/documents';
import notificationRoutes from '../src/routes/notifications';
import reportRoutes from '../src/routes/reports';
import seedRoutes from '../src/routes/seed';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auditLog);

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Construction Operations Tracker API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      users: '/api/users',
      projects: '/api/projects',
      sites: '/api/sites',
      tasks: '/api/tasks',
      materials: '/api/materials',
      equipment: '/api/equipment',
      attendance: '/api/attendance',
      documents: '/api/documents',
      notifications: '/api/notifications',
      reports: '/api/reports'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', seedRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize database on cold start
let dbInitialized = false;
async function ensureDatabaseInitialized() {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }
}

// Export the app for Vercel serverless
export default async (req: express.Request, res: express.Response) => {
  await ensureDatabaseInitialized();
  return app(req, res);
};

