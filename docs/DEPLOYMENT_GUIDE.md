# 🚀 Complete Deployment Guide for ConnectHub

Deploy ConnectHub with PostgreSQL backend and production-ready infrastructure.

---

## 📋 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Setup                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (React/Vite)  ──────────────┐                   │
│  http://your-domain.com              │                   │
│                                      ▼                   │
│                              ┌──────────────────┐         │
│                              │   API Gateway    │         │
│                              │  (Nginx/Proxy)   │         │
│                              └──────────────────┘         │
│                                      │                   │
│           ┌──────────────────────────┼──────────────────┐ │
│           ▼                          ▼                  ▼ │
│    ┌─────────────┐         ┌─────────────┐    ┌─────────┐ │
│    │  FastAPI    │         │  Node.js    │    │  Files  │ │
│    │ (Port 8000) │         │ (Port 3000) │    │ Storage │ │
│    └─────────────┘         └─────────────┘    └─────────┘ │
│           │                      │                   │   │
│           └──────────┬───────────┘                   │   │
│                      ▼                               │   │
│            ┌──────────────────┐                      │   │
│            │   PostgreSQL     │                      │   │
│            │   (Port 5432)    │                      │   │
│            └──────────────────┘                      │   │
│                                                      │   │
└──────────────────────────────────────────────────────┴───┘
```

---

## ✅ Prerequisites

Before deployment, ensure you have:

- [ ] **PostgreSQL** installed (v12+)
- [ ] **Node.js** (v18+) and npm
- [ ] **Python 3.10+** (for FastAPI backend)
- [ ] **Git** (for version control)
- [ ] **Docker** (optional, but recommended)
- [ ] Deployment server/platform:
  - **Option 1**: Your office server (local/on-premise)
  - **Option 2**: Cloud platforms (AWS, Google Cloud, Render, Railway, etc.)

---

## 🗄️ PHASE 1: PostgreSQL Database Setup

### Step 1: Install PostgreSQL

**Windows:**
```powershell
# Download from: https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Step 2: Create Database & User

```bash
# Connect to PostgreSQL
psql -U postgres

# Inside psql terminal, run:
CREATE DATABASE connecthub_prod;
CREATE USER connecthub_app WITH PASSWORD 'your_strong_password_here';

-- Grant privileges
ALTER ROLE connecthub_app SET client_encoding TO 'utf8';
ALTER ROLE connecthub_app SET default_transaction_isolation TO 'read committed';
ALTER ROLE connecthub_app SET default_transaction_deferrable TO on;
ALTER ROLE connecthub_app SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE connecthub_prod TO connecthub_app;

-- Exit psql
\q
```

### Step 3: Test Connection

```bash
psql -U connecthub_app -d connecthub_prod -h localhost -c "SELECT NOW();"
```

---

## 🏗️ PHASE 2: Backend Setup (FastAPI)

### Step 1: Install Dependencies

```bash
cd d:\My Prototypes\ConnectHub\ConnectHub\backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Create `.env` File for Backend

Create: `backend/.env`

```env
# Database
DATABASE_URL=postgresql://connecthub_app:your_password@localhost:5432/connecthub_prod

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=production

# AI Model Keys
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# CORS Settings
ALLOWED_ORIGINS=http://localhost:3000,http://your-domain.com

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# JWT Secret (for authentication)
JWT_SECRET_KEY=your_long_random_secret_key_here
```

### Step 3: Initialize Database Schema

Create: `backend/init_db.py`

```python
"""Initialize database schema"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

# SQL schema for ConnectHub
SCHEMA_SQL = """
-- Events table
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    date VARCHAR,
    place VARCHAR,
    event_picture_url VARCHAR,
    created_by VARCHAR,
    creator_name VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_private BOOLEAN DEFAULT FALSE,
    access_pin VARCHAR
);

-- Attendees table
CREATE TABLE IF NOT EXISTS attendees (
    id VARCHAR PRIMARY KEY,
    event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    designation VARCHAR,
    company VARCHAR,
    industry VARCHAR,
    location VARCHAR,
    city VARCHAR,
    profile_pic_url VARCHAR,
    linkedin_url VARCHAR,
    key_insights TEXT,
    event_association VARCHAR,
    speaker BOOLEAN DEFAULT FALSE,
    competitor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendee notes table
CREATE TABLE IF NOT EXISTS attendee_notes (
    id VARCHAR PRIMARY KEY,
    attendee_id VARCHAR NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL UNIQUE,
    email VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    company VARCHAR,
    avatar_url VARCHAR,
    designation VARCHAR,
    location VARCHAR,
    mobile_no VARCHAR,
    linkedin_url VARCHAR,
    profile_completed BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendee_notes_attendee_id ON attendee_notes(attendee_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
"""

def init_database():
    """Initialize database schema"""
    with engine.connect() as conn:
        conn.execute(text(SCHEMA_SQL))
        conn.commit()
        print("✅ Database schema initialized successfully!")

if __name__ == "__main__":
    init_database()
```

Run initialization:
```bash
cd backend
python init_db.py
```

### Step 4: Start FastAPI Backend

```bash
# Development:
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production:
gunicorn -w 4 -b 0.0.0.0:8000 --timeout 120 "main:app"
```

Backend will be available at: **http://localhost:8000**

---

## 🎨 PHASE 3: Frontend Build

### Step 1: Update Environment Variables

Create: `ConnectHub/.env.production`

```env
VITE_SITE_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com/api
VITE_BACKEND_URL=https://your-domain.com/api
VITE_NODE_ENV=production

# Database settings (if using local storage only)
VITE_DATABASE_URL=postgresql://connecthub_app:password@db-server:5432/connecthub_prod

# Admin credentials
VITE_ADMIN_USERNAME=Admin
VITE_ADMIN_PASSWORD=YourSecurePassword

# Optional APIs
VITE_GROQ_API_KEY=your_groq_key
VITE_TAVILY_API_KEY=your_tavily_key
```

### Step 2: Build Frontend

```bash
cd ConnectHub

# Install dependencies (if not done)
npm install

# Build for production
npm run build

# Output will be in: ConnectHub/dist/
```

---

## 🐳 PHASE 4: Docker Deployment (Recommended)

### Create Docker Compose for Complete Stack

Create: `docker-compose.yml` at root

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: connecthub_prod
      POSTGRES_USER: connecthub_app
      POSTGRES_PASSWORD: your_strong_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U connecthub_app"]
      interval: 10s
      timeout: 5s
      retries: 5

  # FastAPI Backend
  backend:
    build:
      context: ./ConnectHub/backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://connecthub_app:your_strong_password@postgres:5432/connecthub_prod
      API_HOST: 0.0.0.0
      API_PORT: 8000
      ENVIRONMENT: production
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  # React Frontend
  frontend:
    build:
      context: ./ConnectHub
      dockerfile: Dockerfile
      args:
        VITE_API_URL: http://backend:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

  # Nginx Proxy (optional)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
```

### Backend Dockerfile

Create: `ConnectHub/backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run Gunicorn
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "--timeout", "120", "main:app"]
```

### Frontend Dockerfile

Create: `ConnectHub/Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve stage
FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

### Deploy with Docker

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🌐 PHASE 5: Deployment Options

### Option A: Your Office Server (On-Premise)

**Requirements:**
- Server OS: Windows Server, Linux, or macOS
- Minimum: 4GB RAM, 20GB storage
- PostgreSQL + Node.js + Python installed
- Network accessible from office machines

**Setup:**
```bash
# Run all services
# Terminal 1: PostgreSQL
# Terminal 2: FastAPI backend
# Terminal 3: Frontend (or serve via Nginx)

# Or use Docker Compose for easier management
docker-compose up -d
```

**Access:** `http://your-office-server-ip:3000`

---

### Option B: Cloud Deployment (Recommended)

#### **Render.com** (Easiest)

1. Connect GitHub repository
2. Create services:
   - **Database**: PostgreSQL
   - **Backend**: Web Service (Python)
   - **Frontend**: Static Site (from `dist/` folder)
3. Configure environment variables
4. Deploy

```bash
# Cost: ~$20-50/month
```

#### **Railway.app**

```bash
# 1. Create account at railway.app
# 2. Create new project
# 3. Add PostgreSQL plugin
# 4. Deploy from GitHub

# Cost: ~$5-20/month (pay-as-you-go)
```

#### **AWS** (Scalable)

```bash
# Use:
# - RDS for PostgreSQL
# - EC2 or Lightsail for backend
# - S3 + CloudFront for frontend
# - Load Balancer

# Cost: $30-100+/month
```

#### **DigitalOcean** (Mid-range)

```bash
# Droplets for backend/database
# Spaces for file storage
# App Platform for deployment

# Cost: $6-24/month
```

---

## 🔐 Production Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS/SSL certificates (Let's Encrypt)
- [ ] Set up firewall rules
- [ ] Enable PostgreSQL authentication
- [ ] Use environment variables for secrets
- [ ] Enable CORS restrictions
- [ ] Add rate limiting
- [ ] Set up monitoring/alerts
- [ ] Regular backups of database
- [ ] Update dependencies regularly

---

## 📊 Testing Deployment

```bash
# Test frontend
curl https://your-domain.com

# Test API
curl https://your-domain.com/api/health

# Test database connection
psql -U connecthub_app -d connecthub_prod -h your-db-host -c "SELECT COUNT(*) FROM events;"
```

---

## 🔄 Backup Strategy

### Automated Daily Backups

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/connecthub"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/connecthub_$TIMESTAMP.dump"

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U connecthub_app -d connecthub_prod -F c -f $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_FILE"
```

Schedule with cron:
```bash
0 2 * * * /scripts/backup.sh
```

---

## 🚨 Troubleshooting

### PostgreSQL Connection Failed
```bash
# Check if PostgreSQL is running
psql -U connecthub_app -d connecthub_prod -h localhost -c "SELECT 1;"

# Check connection string
echo $DATABASE_URL
```

### FastAPI Not Starting
```bash
# Check logs
tail -f backend.log

# Test imports
python -c "from main import app"

# Check port availability
lsof -i :8000
```

### Frontend Not Loading
```bash
# Check build output
ls -la dist/

# Verify environment variables
cat .env.production

# Test API connectivity
curl http://localhost:8000/health
```

---

## 📱 Post-Deployment

1. ✅ Create admin users
2. ✅ Load test data (CSV attendees)
3. ✅ Test all features (events, attendees, notes)
4. ✅ Set up monitoring
5. ✅ Enable automated backups
6. ✅ Document deployment process
7. ✅ Train team members

---

## 📞 Next Steps

**Choose your deployment path:**

1. **Local Office Server** → Use Docker Compose guide
2. **Cloud Platform** → Choose Render, Railway, AWS, or DigitalOcean
3. **Hybrid Setup** → PostgreSQL locally + Frontend on cloud

**What I can help with:**
- Database schema migration from Supabase
- Docker setup and deployment
- Environment configuration
- Performance optimization
- Security hardening

**Which option interests you most?**
