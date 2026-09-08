# GCC ConnectHub

Professional event networking platform — **React** frontend + **Python FastAPI** backend + **PostgreSQL**.

## Quick start

```powershell
# Configure backend
copy backend\.env.example backend\.env
# Install & run
npm install --prefix frontend
pip install -r backend/requirements.txt
npm run db:migrate
npm run db:seed
npm run dev
```

- UI (dev): [http://localhost:3556](http://localhost:3556)  
- API (dev): [http://localhost:8000/api/health](http://localhost:8000/api/health)  
- Office host: `npm run office` → [http://localhost:8080](http://localhost:8080)

## Repository layout

```
frontend/     React 18 + TypeScript + Vite
backend/      Python FastAPI + asyncpg
docs/         All documentation
scripts/      Setup, backup, and office helper scripts
```



## Documentation

See **[docs/README.md](docs/README.md)** for the full index.

Essential guides:

- [Deployment team runbook](docs/DEPLOYMENT_TEAM.md) — **start here for DevOps**
- [Vercel + Supabase + Grok](docs/VERCEL_SUPABASE.md) — **public deploy without VPN**
- [Local setup](docs/README_LOCAL_SETUP.md)
- [Development](docs/DEVELOPMENT.md)
- [Database guide](docs/LOCAL_AND_DEPLOYED_DATABASE.md)
- [On-premise deployment](docs/ON_PREMISE_DEPLOYMENT.md)
- [Architecture](docs/CONNECTHUB_ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)



## Useful scripts


| Script                              | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `scripts/start-office.bat`          | Dev or office launcher             |
| `scripts/health-check.bat`          | Verify Node, Python, Postgres, API |
| `scripts/setup-office-postgres.ps1` | Create DB and write `.env` files   |
| `scripts/backup-connecthub.ps1`     | Backup database + uploads          |
| `scripts/restore-connecthub.ps1`    | Restore from backup                |


