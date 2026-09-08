# 🏢 ConnectHub - Complete Local Office Setup Guide

This guide will help you migrate from Supabase cloud database to a local PostgreSQL database running on your office server/machine.

---

## ✅ Prerequisites

You need to install these on your office machine:

### 1. **PostgreSQL** (Database Server)
- **Download**: https://www.postgresql.org/download/windows/
- **Recommended Version**: PostgreSQL 15 or higher
- **During Installation**:
  - Username: `postgres`
  - Password: `YourSecurePassword123` (change this to something secure)
  - Port: `5432` (default)
  - Encoding: UTF-8

### 2. **Node.js** (for Frontend & Backend)
- **Download**: https://nodejs.org/ (LTS version)
- **Check Installation**: Open PowerShell and run `node --version`

### 3. **Git** (optional, but recommended)
- **Download**: https://git-scm.com/download/win

---

## 📋 Step-by-Step Setup

### **Phase 1: Install PostgreSQL Locally**

1. **Download PostgreSQL installer** for Windows
2. **Run the installer** with these settings:
   - Installation directory: `C:\Program Files\PostgreSQL\15`
   - Database port: `5432`
   - Superuser password: `postgres_local_password` (or your choice)
   - Locale: English (or your preference)
3. **Verify installation**:
   ```powershell
   psql --version
   # Should show: psql (PostgreSQL) 15.x
   ```

---

### **Phase 2: Create Local Database**

Run the following commands in PowerShell:

```powershell
# Connect to PostgreSQL
psql -U postgres

# Inside psql prompt, run these commands:
CREATE DATABASE connecthub;
CREATE USER connecthub_user WITH PASSWORD 'connecthub_local_password';
ALTER ROLE connecthub_user SET client_encoding TO 'utf8';
ALTER ROLE connecthub_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE connecthub_user SET default_transaction_deferrable TO on;
ALTER ROLE connecthub_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE connecthub TO connecthub_user;
\q
```

---

### **Phase 3: Export Data from Supabase**

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Navigate to **SQL Editor** → **Run custom query**
3. Run this query to export the full schema:
   ```sql
   -- This shows all tables
   SELECT table_name FROM information_schema.tables WHERE table_schema='public';
   ```
4. Use **pgAdmin** or **DBeaver** to dump the entire database:
   ```bash
   pg_dump -h bvfhzdazqoawpiakbdtq.supabase.co -U postgres -d postgres -F c > connecthub_backup.dump
   ```

---

### **Phase 4: Import Data to Local PostgreSQL**

```powershell
# Restore from dump file
pg_restore -U postgres -d connecthub -v C:\path\to\connecthub_backup.dump
```

---

### **Phase 5: Update Environment Variables**

Edit the file: `d:\My Prototypes\ConnectHub\ConnectHub\.env`

**OLD (Supabase):**
```env
VITE_SUPABASE_URL=https://bvfhzdazqoawpiakbdtq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_Fux0RdecX2DHf2fH5xBlUw_DYnAv36e
```

**NEW (Local PostgreSQL):**
```env
VITE_DATABASE_URL=postgresql://connecthub_user:connecthub_local_password@localhost:5432/connecthub
VITE_NODE_ENV=development
VITE_API_URL=http://localhost:3000
VITE_FRONTEND_URL=http://localhost:5173
```

---

### **Phase 6: Install Frontend Dependencies**

```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub
npm install
# or if using yarn:
# yarn install
```

---

### **Phase 7: Run Frontend Development Server**

```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub
npm run dev
# Frontend will be available at: http://localhost:5173
```

---

### **Phase 8: Run Backend (if needed)**

**Python Backend:**
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

**Node.js Backend:**
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub\server
npm install
npm start
```

---

## 🔧 Database Management

### **Access Local Database**

**Using psql (Command Line):**
```powershell
psql -U connecthub_user -d connecthub -h localhost
```

**Using pgAdmin (GUI):**
1. Download: https://www.pgadmin.org/download/
2. Create server connection to `localhost:5432`
3. Login with `postgres` user

**Using DBeaver (GUI):**
1. Download: https://dbeaver.io/download/
2. Create new PostgreSQL connection
3. Host: `localhost`, Port: `5432`, Database: `connecthub`

---

## 📊 Database Schema Setup

If you need to manually set up the schema without a backup, run these SQL files in order:

```powershell
psql -U connecthub_user -d connecthub -h localhost -f "d:\My Prototypes\ConnectHub\ConnectHub\DATABASE_SCHEMA_SETUP.sql"
psql -U connecthub_user -d connecthub -h localhost -f "d:\My Prototypes\ConnectHub\ConnectHub\database_policies_fixed.sql"
```

---

## 🚀 Quick Start (After Setup)

```powershell
# Terminal 1: Start Frontend
cd d:\My Prototypes\ConnectHub\ConnectHub
npm run dev

# Terminal 2: Start Backend (Python)
cd d:\My Prototypes\ConnectHub\ConnectHub\backend
.\venv\Scripts\Activate.ps1
python main.py

# Terminal 3: Start Backend (Node.js) - if needed
cd d:\My Prototypes\ConnectHub\ConnectHub\server
npm start
```

**Access the app at**: http://localhost:5173

---

## ⚠️ Troubleshooting

### **PostgreSQL Connection Refused**
```powershell
# Restart PostgreSQL service
net stop postgresql-x64-15
net start postgresql-x64-15
```

### **Port 5432 Already in Use**
```powershell
# Find process using port 5432
netstat -ano | findstr :5432
# Kill process: taskkill /PID <process_id> /F
```

### **Supabase Data Not Migrating**
- Verify Supabase credentials
- Use pgAdmin to manually export tables
- Check for foreign key constraints during import

### **Frontend Won't Connect to Database**
- Verify `.env` file has correct `VITE_DATABASE_URL`
- Check PostgreSQL is running: `sc query postgresql-x64-15`
- Test connection: `psql -U connecthub_user -d connecthub`

---

## 📈 Network Access (Office LAN)

To allow other machines in your office to access the database:

1. **Update PostgreSQL Config** (`C:\Program Files\PostgreSQL\15\data\postgresql.conf`):
   ```
   listen_addresses = '*'
   ```

2. **Update Client Auth** (`C:\Program Files\PostgreSQL\15\data\pg_hba.conf`):
   ```
   host    all    all    192.168.1.0/24    md5
   ```

3. **Restart PostgreSQL**:
   ```powershell
   net stop postgresql-x64-15
   net start postgresql-x64-15
   ```

4. **Access from another machine**:
   ```
   psql -U connecthub_user -d connecthub -h <office_machine_ip>
   ```

---

## 💾 Backup Strategy

### **Automated Daily Backup**
Create a batch file: `backup_database.bat`
```batch
@echo off
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set filename=connecthub_backup_%mydate%_%mytime%.dump

pg_dump -U postgres -d connecthub -F c > "C:\Backups\%filename%"
echo Backup completed: %filename%
```

**Schedule in Windows Task Scheduler** to run daily at 2 AM.

---

## 🎯 Next Steps

1. Install PostgreSQL on your office machine
2. Create the database and user
3. Export data from Supabase
4. Update `.env` files
5. Run `npm install` for dependencies
6. Start the development server: `npm run dev`
7. Access at http://localhost:5173

**Questions?** Check the troubleshooting section or review the SQL setup files in the project.

