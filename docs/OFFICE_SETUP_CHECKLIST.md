# 📋 LOCAL OFFICE SETUP CHECKLIST FOR ConnectHub

Complete this checklist to migrate from Supabase cloud to your local office database.

---

## ✅ PRE-SETUP REQUIREMENTS

- [ ] **Administrator Access** - You have admin rights on the office machine
- [ ] **Internet Connection** - Available for downloading PostgreSQL and dependencies
- [ ] **4GB+ RAM** - Minimum recommended for PostgreSQL + React dev server
- [ ] **10GB Disk Space** - For PostgreSQL, Node.js, and project files
- [ ] **PowerShell 5.0+** - Check: `$PSVersionTable.PSVersion`

---

## 📥 STEP 1: INSTALL POSTGRESQL (30 mins)

### Windows Installation
- [ ] Download PostgreSQL 15+ from https://www.postgresql.org/download/windows/
- [ ] Run installer with these settings:
  - [ ] Installation directory: `C:\Program Files\PostgreSQL\15`
  - [ ] Port: `5432`
  - [ ] Superuser password: Remember this! (e.g., `postgres_office_password`)
  - [ ] Locale: English
- [ ] Click "Finish" (check "Launch Stack Builder" to install pgAdmin)
- [ ] Verify installation:
  ```powershell
  psql --version
  ```
  Should show: `psql (PostgreSQL) 15.x`

### pgAdmin (GUI) - Optional but Recommended
- [ ] During PostgreSQL setup, click "Launch Stack Builder" at end
- [ ] Select "pgAdmin 4" to install database manager UI
- [ ] Or download separately: https://www.pgadmin.org/download/

---

## 🔧 STEP 2: CREATE LOCAL DATABASE (5 mins)

Run the PowerShell script to set up the database automatically:

```powershell
# Open PowerShell as Administrator
cd d:\My Prototypes\ConnectHub
.\setup-local-postgres.ps1
```

This will:
- [ ] Create database `connecthub`
- [ ] Create user `connecthub_user` with password `connecthub_office_local`
- [ ] Grant all privileges
- [ ] Test the connection

**If script fails**, manually run these commands in PowerShell:
```powershell
psql -U postgres -c "CREATE DATABASE connecthub;"
psql -U postgres -c "CREATE USER connecthub_user WITH PASSWORD 'connecthub_office_local';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE connecthub TO connecthub_user;"
```

---

## 📤 STEP 3: EXPORT DATA FROM SUPABASE (15 mins)

### Option A: Use Migration Script (Recommended)
```powershell
cd d:\My Prototypes\ConnectHub
.\migrate-supabase-to-local.ps1
```

This will:
- [ ] Export full database from Supabase cloud
- [ ] Import to local PostgreSQL
- [ ] Verify the migration
- [ ] Save backup to `C:\Backups\connecthub_supabase_backup.dump`

### Option B: Manual Export/Import
If the script doesn't work:

```powershell
# 1. Export from Supabase
$env:PGPASSWORD = "your_supabase_password"
pg_dump -h bvfhzdazqoawpiakbdtq.supabase.co -U postgres -d postgres -F c -f C:\Backups\backup.dump

# 2. Import to local PostgreSQL
$env:PGPASSWORD = "connecthub_office_local"
pg_restore -U connecthub_user -d connecthub -F c C:\Backups\backup.dump
```

---

## 🔄 STEP 4: UPDATE ENVIRONMENT CONFIGURATION (5 mins)

Edit: `d:\My Prototypes\ConnectHub\ConnectHub\.env`

**Replace these lines:**

❌ **OLD (Remove):**
```env
VITE_SUPABASE_URL=https://bvfhzdazqoawpiakbdtq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

✅ **NEW (Add):**
```env
VITE_DATABASE_URL=postgresql://connecthub_user:connecthub_office_local@localhost:5432/connecthub
VITE_DATABASE_HOST=localhost
VITE_DATABASE_PORT=5432
VITE_NODE_ENV=development
VITE_API_URL=http://localhost:3000
VITE_FRONTEND_URL=http://localhost:5173
USE_SUPABASE=false
```

- [ ] Update `.env` file
- [ ] Save the file

---

## 💾 STEP 5: INSTALL DEPENDENCIES (10 mins)

```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub
npm install
```

Wait for all packages to install. This may take 5-10 minutes.

- [ ] All npm packages installed successfully

---

## 🚀 STEP 6: START DEVELOPMENT ENVIRONMENT (varies)

### Quick Start (Automatic)
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub
.\start-dev.bat
```

This opens multiple terminal windows with:
- React Frontend (port 5173)
- Python Backend (if available)
- Node.js Backend (if available)

### Manual Start (Terminal by Terminal)

**Terminal 1: Frontend**
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub
npm run dev
# Frontend will be at: http://localhost:5173
```

**Terminal 2: Python Backend** (if available)
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

**Terminal 3: Node.js Backend** (if available)
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub\server
npm install
npm start
```

---

## ✅ STEP 7: VERIFY EVERYTHING IS WORKING

- [ ] Frontend loads at http://localhost:5173
- [ ] Can log in with admin credentials:
  - Username: `Admin`
  - Password: `<DEMO_PASSWORD>`
- [ ] Data from Supabase appears in the app
- [ ] Can create/edit records without errors

---

## 📊 VERIFY DATABASE CONNECTION

### Check PostgreSQL is Running
```powershell
psql -U connecthub_user -d connecthub -h localhost -c "SELECT NOW();"
```
Should return current timestamp.

### Check Tables Exist
```powershell
psql -U connecthub_user -d connecthub -h localhost -c "\dt"
```
Should list all tables from Supabase export.

### Use pgAdmin GUI
1. Open pgAdmin 4
2. Add new server:
   - Host: `localhost`
   - Port: `5432`
   - Username: `connecthub_user`
   - Password: `connecthub_office_local`
3. Browse tables in `connecthub` database

---

## 🔌 NETWORK ACCESS (For Office LAN)

To allow other machines in your office to access the database:

### 1. Enable PostgreSQL Network Listening
Edit: `C:\Program Files\PostgreSQL\15\data\postgresql.conf`

Find and uncomment:
```
listen_addresses = '*'
```

### 2. Update Client Authentication
Edit: `C:\Program Files\PostgreSQL\15\data\pg_hba.conf`

Add this line (replace IP range with your office subnet):
```
host    all    all    192.168.1.0/24    md5
```

### 3. Restart PostgreSQL
```powershell
net stop postgresql-x64-15
net start postgresql-x64-15
```

### 4. Other Machines Connect
```powershell
# From another machine in office network
# Replace 192.168.1.100 with your server's IP
psql -U connecthub_user -d connecthub -h 192.168.1.100
```

---

## 💾 BACKUP & RECOVERY

### Automated Daily Backup

Create: `C:\Scripts\backup-connecthub.ps1`

```powershell
$backupDir = "C:\Backups"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = "$backupDir\connecthub_$timestamp.dump"

$env:PGPASSWORD = "connecthub_office_local"
pg_dump -U connecthub_user -d connecthub -h localhost -F c -f $backupFile
Remove-Item Env:\PGPASSWORD

Write-Host "Backup completed: $backupFile"
```

**Schedule in Windows Task Scheduler:**
1. Open Task Scheduler
2. Create Basic Task
3. Name: "ConnectHub Daily Backup"
4. Trigger: Daily, 2:00 AM
5. Action: Start program `powershell.exe -File C:\Scripts\backup-connecthub.ps1`

### Restore from Backup
```powershell
$env:PGPASSWORD = "connecthub_office_local"
pg_restore -U connecthub_user -d connecthub -F c "C:\Backups\connecthub_2024-01-15_02-00-00.dump"
```

---

## ⚠️ TROUBLESHOOTING

### PostgreSQL Won't Start
```powershell
# Restart the service
net stop postgresql-x64-15
net start postgresql-x64-15

# Check if it's running
Get-Service postgresql-x64-15 | Select-Object Status, Name
```

### Port 5432 Already in Use
```powershell
netstat -ano | findstr :5432
# Note the PID, then:
taskkill /PID <pid> /F
```

### Frontend Can't Connect to Database
- Verify `.env` has correct `VITE_DATABASE_URL`
- Check PostgreSQL is running
- Test: `psql -U connecthub_user -d connecthub`

### Migration Failed or Incomplete
- Check backup file exists: `dir C:\Backups\`
- Try manual import: `pg_restore -U connecthub_user -d connecthub -F c C:\Backups\backup.dump`
- Check for error messages in terminal

### npm install Fails
```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -r node_modules
rm package-lock.json

# Reinstall
npm install
```

---

## 📞 NEXT STEPS AFTER SETUP

1. ✅ Test the application thoroughly
2. ✅ Set up automated backups
3. ✅ Configure network access if needed
4. ✅ Create admin accounts for team members
5. ✅ Set up monitoring/alerts for database health
6. ✅ Document your setup for your team
7. ✅ Test disaster recovery (restore from backup)

---

## 📚 REFERENCE

| Component | Details |
|-----------|---------|
| **Database** | PostgreSQL 15 at localhost:5432 |
| **Database Name** | connecthub |
| **DB User** | connecthub_user |
| **DB Password** | connecthub_office_local |
| **Frontend URL** | http://localhost:5173 |
| **API URL** | http://localhost:3000 |
| **Admin User** | Admin |
| **Admin Password** | <DEMO_PASSWORD> |
| **Backup Location** | C:\Backups\ |

---

**Status**: Ready to begin setup. Follow the steps in order!

