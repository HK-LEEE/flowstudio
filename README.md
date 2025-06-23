# FlowStudio

FlowStudio is a visual flow design platform that allows users to create, manage, and execute visual workflows through an intuitive drag-and-drop interface.

## Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite
- **UI Library**: Ant Design for professional components
- **State Management**: Zustand with persistence
- **Flow Engine**: React Flow for visual flow editing
- **Styling**: Ant Design with custom theme
- **HTTP Client**: Axios with request/response interceptors

### Backend
- **Framework**: FastAPI with async SQLAlchemy
- **Authentication**: JWT-based with access/refresh tokens
- **Database**: PostgreSQL with async support
- **Security**: bcrypt password hashing, CORS protection

## Features

### Authentication System
- **Secure Login**: JWT-based authentication with email/password
- **Token Management**: Automatic token refresh and rotation
- **Route Protection**: Private routes with authentication guards
- **User Management**: Registration, profile management
- **Session Management**: Persistent authentication state

### Visual Flow Designer
- **Drag & Drop Interface**: Intuitive visual flow creation
- **Real-time Collaboration**: Multi-user flow editing
- **Version Control**: Flow versioning and history
- **Template Library**: Pre-built flow templates

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ and pip
- PostgreSQL database

### Installation & Setup

#### Option 1: Quick Start (macOS)
```bash
# Clone or navigate to the project directory
cd /Users/hyunkyu/Documents/project/max_flwostudio

# Start all services
./start_all_services_macos.sh
```

#### Option 2: Manual Setup

**Backend Setup:**
```bash
cd flowstudio-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Setup:**
```bash
cd flowstudio-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Database Setup

1. **Create PostgreSQL Database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE flowstudio;
\q
```

2. **Update Environment Variables:**
Edit `flowstudio-backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:2300@localhost:5432/flowstudio
```

3. **Initialize Database:**
The database tables will be created automatically when you first start the backend server.

## Environment Configuration

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/flowstudio

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=True

# JWT Security
JWT_SECRET_KEY=your-super-secret-jwt-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/me` - Current user info

### Health Check
- `GET /health` - Service health status
- `GET /` - API information

## Development

### Frontend Development
```bash
cd flowstudio-frontend

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
npm run lint:fix
```

### Backend Development
```bash
cd flowstudio-backend

# Activate virtual environment
source venv/bin/activate

# Run with auto-reload
uvicorn app.main:app --reload

# Run tests (when implemented)
pytest

# Database migrations (when implemented)
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Project Structure

```
flowstudio/
├── flowstudio-frontend/          # React frontend application
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/               # Page-level components
│   │   ├── services/            # API integration layer
│   │   ├── store/               # State management (Zustand)
│   │   ├── types/               # TypeScript type definitions
│   │   └── utils/               # Utility functions
│   ├── package.json
│   └── vite.config.ts
├── flowstudio-backend/           # FastAPI backend application
│   ├── app/
│   │   ├── api/                 # API endpoints and dependencies
│   │   ├── core/                # Core configuration
│   │   ├── db/                  # Database configuration
│   │   ├── models/              # SQLAlchemy models
│   │   ├── services/            # Business logic layer
│   │   └── utils/               # Utility functions
│   ├── requirements.txt
│   └── .env
├── start_all_services_macos.sh  # Quick start script
├── start_backend_macos.sh       # Backend startup script
├── start_frontend_macos.sh      # Frontend startup script
└── README.md
```

## Authentication Flow

1. **User Login**: User submits email/password to `/api/auth/login`
2. **Token Generation**: Server validates credentials and returns JWT tokens
3. **Token Storage**: Frontend stores tokens in localStorage
4. **Request Authentication**: Axios interceptor adds Bearer token to requests
5. **Token Refresh**: Automatic token refresh on 401 responses
6. **Route Protection**: PrivateRoute component guards protected pages

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Token Refresh**: Automatic token rotation
- **CORS Protection**: Configured for specific origins
- **Input Validation**: Pydantic models for request validation
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries

## Deployment

### Frontend Deployment
```bash
cd flowstudio-frontend

# Build for production
npm run build

# Deploy dist/ folder to your static hosting service
```

### Backend Deployment
```bash
cd flowstudio-backend

# Install production dependencies
pip install -r requirements.txt

# Set production environment variables
export DEBUG=False
export JWT_SECRET_KEY=your-production-secret

# Run with production WSGI server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check DATABASE_URL in .env file
   - Verify database exists and credentials are correct

2. **CORS Errors**
   - Check CORS_ORIGINS in backend .env
   - Ensure frontend URL is included in allowed origins

3. **Authentication Issues**
   - Verify JWT_SECRET_KEY is set
   - Check token expiration times
   - Clear localStorage if tokens are corrupted

4. **Port Conflicts**
   - Frontend runs on port 3000
   - Backend runs on port 8000
   - Ensure ports are available

### Logs and Debugging

- **Frontend**: Check browser console for errors
- **Backend**: Check terminal output for server logs
- **Database**: Check PostgreSQL logs for connection issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (when test framework is implemented)
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the project repository.