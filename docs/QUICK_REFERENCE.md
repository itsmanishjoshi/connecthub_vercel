# 🎯 CONNECTHUB - QUICK REFERENCE CARD

## 🚀 START HERE

### Every Time You Want to Use ConnectHub:
```powershell
cd d:\My Prototypes\ConnectHub\ConnectHub
npm run dev
```

Then open: **http://localhost:8080**

---

## 🔐 LOGIN CREDENTIALS
```
Username: <DEMO_USERNAME>
Password: <DEMO_PASSWORD>
```

---

## ✅ WHAT'S WORKING RIGHT NOW

| Feature | Status |
|---------|--------|
| Login | ✅ Working |
| Create Events | ✅ Working |
| Add Attendees | ✅ Working |
| Add Notes | ✅ Working |
| View Dashboard | ✅ Working |
| Dark/Light Theme | ✅ Working |
| Data Persistence | ✅ Local Storage |

---

## 📁 IMPORTANT DIRECTORIES

```
Project Root:
d:\My Prototypes\ConnectHub\

App Source Code:
d:\My Prototypes\ConnectHub\ConnectHub\src\

Configuration:
d:\My Prototypes\ConnectHub\ConnectHub\.env

Setup Scripts:
d:\My Prototypes\ConnectHub\setup-postgres-windows.ps1
d:\My Prototypes\ConnectHub\init-schema.sql
```

---

## 🔧 OPTIONAL: ADD POSTGRESQL DATABASE

If you want to add a local PostgreSQL database:

### Step 1: Install PostgreSQL
Download from: https://www.postgresql.org/download/windows/

### Step 2: Run Setup (as Administrator)
```powershell
cd d:\My Prototypes\ConnectHub
.\setup-postgres-windows.ps1
```

### Step 3: Initialize Database
```powershell
psql -U connecthub_user -d connecthub_local -f init-schema.sql
```

### Step 4: Restart App
App will automatically use PostgreSQL!

---

## 📚 DOCUMENTATION FILES

| Document | Purpose |
|----------|---------|
| [SETUP_COMPLETE_SUMMARY.md](./SETUP_COMPLETE_SUMMARY.md) | Overview of setup |
| [LOCAL_SETUP_COMPLETE.md](./LOCAL_SETUP_COMPLETE.md) | Detailed setup steps |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Production deployment |
| [QUICK_DEPLOYMENT_CHECKLIST.md](./QUICK_DEPLOYMENT_CHECKLIST.md) | Deployment checklist |

---

## 🔗 QUICK LINKS

| Link | Purpose |
|------|---------|
| http://localhost:8080 | Application |
| [PostgreSQL Download](https://www.postgresql.org/download/windows/) | Database installation |
| [pgAdmin](https://www.pgadmin.org/download/) | Database GUI (optional) |
| [Render.com](https://render.com) | Cloud deployment |
| [Railway](https://railway.app) | Cloud deployment |

---

## 🆘 TROUBLESHOOTING

### App Won't Start
```powershell
npm install
npm run dev
```

### "Failed to fetch" Message
✅ This is normal - app uses local storage fallback
✅ All data is saved locally

### Lost Data
Data is saved in browser localStorage. Clear cache carefully!

### Want PostgreSQL Database
See "Optional: Add PostgreSQL Database" section above

---

## 💾 BACKUP & RESTORE

### Backup Data (from browser)
1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Right-click → Export as JSON

### Backup Database (PostgreSQL)
```powershell
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
pg_dump -U connecthub_user -d connecthub_local > backup_$timestamp.sql
```

---

## 📊 SYSTEM INFO

| Component | Details |
|-----------|---------|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| Runtime | Node.js |
| Database | Local Storage / PostgreSQL |
| OS | Windows/Mac/Linux |

---

## 🎯 COMMON TASKS

### Create an Event
1. Click "Create Event" button
2. Fill in: Name, Date, Location
3. Click "Create Event"
4. ✅ Done!

### Add Attendees
1. Click on an event
2. Click "Add Attendee"
3. Fill in details
4. Click "Save"
5. ✅ Done!

### Add Notes
1. Click on an attendee
2. Click "Add Note"
3. Type note
4. Click "Save"
5. ✅ Done!

### Export Events (Coming Soon)
- Will be available in Settings menu
- Export as CSV with all attendees and notes

---

## 🚀 DEPLOYMENT

### Quick Cloud Deployment (1 hour)
1. Go to [Render.com](https://render.com)
2. Create account
3. Connect GitHub
4. Deploy in 4 clicks
5. Cost: ~$20/month

### Local Office Server (30 minutes)
1. Install Docker Desktop
2. Run: `docker-compose up -d`
3. Access from office machines
4. Cost: Free (use your server)

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for details

---

## ✅ CHECKLIST

Getting started:
- [ ] Read this card
- [ ] Run `npm run dev`
- [ ] Open http://localhost:8080
- [ ] Login with credentials above
- [ ] Create a test event
- [ ] Add a test attendee
- [ ] Add a test note
- [ ] ✅ You're done!

Optional:
- [ ] Install PostgreSQL (if needed)
- [ ] Setup database
- [ ] Deploy to production

---

## 🎉 YOU'RE ALL SET!

Everything is ready to use. No additional setup needed unless you want:
1. PostgreSQL database (optional)
2. Deploy to cloud/server (when ready)

**Start using ConnectHub now!**

```powershell
npm run dev
```

Access at: http://localhost:8080

---

**Questions? Check the documentation files listed above or review the comments in the code.**

**Happy tracking!** 🚀
