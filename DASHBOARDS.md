# Role-Based Dashboards

## Overview

The application now features separate, role-specific dashboards for each user type. All users use a single login page, and are automatically redirected to their appropriate dashboard based on their role.

## Dashboard Features

### 🔴 Admin Dashboard (`/dashboard/admin`)

**Access:** Admin users only

**Features:**
- Complete system overview with 7 key metrics
- Total users and sites count
- Task status overview with bar charts
- Equipment status with pie charts
- Quick actions for user management, projects, and reports
- Recent activities feed
- Percentage changes and trends
- Full system access and management capabilities

**Key Metrics:**
- Active Projects
- Total Users
- Total Sites
- Pending Tasks
- Low Stock Materials
- Equipment Issues
- Present Today

### 🟠 Manager Dashboard (`/dashboard/manager`)

**Access:** Manager users only

**Features:**
- Project oversight and resource management
- 5 key operational metrics
- Weekly task progress chart (Area chart)
- Active projects list
- Pending material requisitions requiring approval
- Recent activities feed
- Quick access to reports and analytics

**Key Metrics:**
- Active Projects
- Pending Tasks
- Pending Approvals (Material Requisitions)
- Equipment Issues
- Workforce Today

**Special Features:**
- Material requisition approval workflow
- Project status monitoring
- Weekly progress tracking

### 🟡 Supervisor Dashboard (`/dashboard/supervisor`)

**Access:** Supervisor users only

**Features:**
- Site management and team oversight
- My Sites section with site details
- Today's team attendance chart
- Pending tasks assigned to team
- Recent activities on assigned sites
- Task assignment and management
- Team attendance tracking

**Key Metrics:**
- My Sites count
- Pending Tasks
- Team Present count
- Low Stock Alerts
- Equipment Issues

**Special Features:**
- Site-specific management
- Team attendance visualization
- Task assignment interface
- Site team management

### 🟢 Worker Dashboard (`/dashboard/worker`)

**Access:** Worker users only

**Features:**
- Personal task management
- Clock in/out functionality
- Task status tracking (Pending, In Progress, Completed)
- Urgent tasks highlighted
- Today's tasks list
- My Sites sidebar
- Quick actions menu

**Key Metrics:**
- Pending Tasks
- In Progress Tasks
- Completed Tasks
- Urgent Tasks

**Special Features:**
- One-click clock in/out
- Task status updates (Start/Complete)
- Urgent task alerts
- Today's task focus
- Attendance tracking

## Login Flow

1. User enters credentials on single login page
2. System authenticates user
3. User role is determined
4. Automatic redirect to role-specific dashboard:
   - Admin → `/dashboard/admin`
   - Manager → `/dashboard/manager`
   - Supervisor → `/dashboard/supervisor`
   - Worker → `/dashboard/worker`

## Navigation

- All dashboards use the same Layout component
- Sidebar menu adapts based on user role
- Dashboard link in sidebar redirects to role-specific dashboard
- Role-appropriate menu items are shown

## Dashboard Components

### Admin Dashboard Components
- `AdminDashboard.tsx` - Full admin overview
- System-wide statistics
- User management quick access
- Complete analytics

### Manager Dashboard Components
- `ManagerDashboard.tsx` - Manager overview
- Project management focus
- Approval workflows
- Resource tracking

### Supervisor Dashboard Components
- `SupervisorDashboard.tsx` - Supervisor overview
- Site management
- Team oversight
- Task assignment

### Worker Dashboard Components
- `WorkerDashboard.tsx` - Worker overview
- Personal task management
- Attendance tracking
- Quick actions

## UI/UX Features

### Modern Design Elements
- ✅ Clean card-based layouts
- ✅ Color-coded status indicators
- ✅ Interactive hover effects
- ✅ Responsive grid systems
- ✅ Gradient backgrounds for key sections
- ✅ Icon-based navigation
- ✅ Real-time data updates

### Charts and Visualizations
- Bar charts for task status
- Pie charts for equipment status
- Area charts for progress tracking
- Line charts for trends
- Responsive chart containers

### Mobile Responsive
- All dashboards are fully responsive
- Mobile-friendly sidebar navigation
- Touch-optimized buttons
- Adaptive grid layouts

## API Integration

Each dashboard fetches data from:
- `/api/reports/dashboard` - Overview statistics
- `/api/tasks` - Task data
- `/api/sites` - Site information
- `/api/attendance` - Attendance records
- `/api/materials/requisitions` - Material requests
- `/api/equipment` - Equipment status
- Role-based filtering is handled automatically by the backend

## Security

- Role-based route protection
- Dashboard access restricted by role
- API endpoints filter data by user role
- Protected routes prevent unauthorized access

## Future Enhancements

- Real-time updates via WebSockets
- Customizable dashboard widgets
- Export dashboard data
- Print-friendly views
- Dark mode support
- Dashboard preferences saving

