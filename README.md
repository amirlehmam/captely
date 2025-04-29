# Captely

Captely is a B2B contact enrichment platform that enables you to scrape leads from LinkedIn Sales Navigator, bulk-import via CSV/XLSX, enrich contact data (emails, phone numbers) using multiple providers in a cascading setup, manage credits, and integrate seamlessly with your CRM.

This repository contains:

- **Backend services** (FastAPI, Celery, PostgreSQL, Redis)
- **Chrome Extension** for LinkedIn Sales Navigator
- **Frontend Web App** (Next.js 13)

---

## 🏗️ Architecture Overview

```
User Device (Browser)
   ├─ Web App (Next.js)              ← Pages: /login, /signup, /dashboard, /import
   └─ Chrome Extension (SalesNav)
        ↓
Auth Service (FastAPI + Gunicorn/Uvicorn)
   ├─ /auth      (signup, login → JWT)
   ├─ /keys      (CRUD API keys)
   ├─ /salesnav  (scraped leads)
   ├─ /upload    (small file uploads)
   ├─ /jobs      (task status)
   └─ /leads     (enriched results)
        ↓ enqueues
Import Service (FastAPI)
   └─ /upload    (CSV/XLSX bulk import)
        ↓ enqueues
Redis (Broker)
        ↓
Enrichment Worker (Celery)
        ↓ ORM writes
PostgreSQL (Data Storage)
        ↕ HTTP
Credit Service (FastAPI)
   └─ /balance, /charge
```  
Shared libraries in `common/` include:

- **config.py**: environment variables & settings
- **db.py**: SQLAlchemy session & engine
- **celery_app.py**: Celery instance & task definitions

---

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose (v3.8+)
- Node.js (v16+) & npm or Yarn
- (Optional) Python 3.12+ if running services locally without Docker

### Clone the Repository

```bash
git clone https://github.com/<your-org>/captely.git
cd captely
```

### Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable                  | Description                                              |
|---------------------------|----------------------------------------------------------|
| POSTGRES_DB               | Name of the Postgres database                            |
| POSTGRES_USER             | Postgres username                                        |
| POSTGRES_PASSWORD         | Postgres password                                        |
| REDIS_URL                 | Redis connection URL (`redis://redis:6379/0`)            |
| JWT_SECRET_KEY            | Secret key for JWT signing                               |
| ENRICHMENT_PROVIDERS      | Comma-separated list of providers (in cascade order)     |
| PROVIDER_<NAME>_API_KEY   | API key for each provider (e.g. PROVIDER_CLEARBIT_API_KEY)|
| ...                       | Additional provider-specific credentials                 |

### Launch with Docker Compose

```bash
docker-compose up --build
```

This brings up:

1. **PostgreSQL** (`captely-db:5432`)
2. **Redis** (`captely-redis:6379`)
3. **Auth Service** (`localhost:8000`)
4. **Credit Service** (`localhost:8001`)
5. **Import Service** (`localhost:8002`)
6. **Enrichment Worker** (Celery)

### Running Frontend

```bash
cd captely-frontend-web
npm install   # or yarn install
npm run dev   # starts Next.js on http://localhost:3000
```

---

## 🗂️ Directory Structure

### Backend

```
captely-backend/
├─ common/              Shared config, DB & Celery setup
├─ extension-sns/       Chrome extension files
└─ services/
   ├─ auth-service/     FastAPI app for authentication & leads ingestion
   ├─ credit-service/   FastAPI app for credit management
   ├─ import-service/   FastAPI app for bulk-importing leads
   └─ enrichment-worker/ Celery worker for enrichment tasks
```

### Frontend

```
captely-frontend-web/
├─ public/              Static assets (SVGs, icons)
└─ src/app/             Next.js App Router
   ├─ login/            Login page
   ├─ signup/           Signup page
   ├─ dashboard/        API-key management
   ├─ import/           Bulk import UI
   ├─ context/          React auth context
   └─ utils/            Axios clients (authApi, importApi)
```

---

## 📖 Usage Workflow

1. **Sign Up / Log In**
   - Use `/signup` or `/login` on the web UI to create/get a JWT.
2. **Generate API Keys**
   - Navigate to dashboard → `Generate New Key`.
3. **Import Leads**
   - **Chrome Extension**: install from `extension-sns/`, configure your API-key, click the popup to push leads directly from LinkedIn Sales Navigator.
   - **Bulk CSV**: on the web UI, upload your CSV/XLSX file; the import-service will enqueue tasks.
4. **Enrichment & Credits**
   - Each lead triggers a Celery task in enrichment-worker.
   - Worker calls providers in the order you specified in `ENRICHMENT_PROVIDERS`.
   - On success, writes enriched data back to Postgres and deducts from your balance in credit-service.
5. **View Results**
   - Poll `/jobs` for status and `/leads` for enriched output via the UI.

---

## 🛠️ Development & Maintenance

- **Migrations**: Use Alembic in `auth-service/`:
  ```
  cd services/auth-service
  alembic revision --autogenerate -m "describe change"
  alembic upgrade head
  ```

- **Adding a Provider**:
  1. Add provider credentials to `.env`.
  2. Update `common/config.py` to include its settings.
  3. Extend the Celery task logic in `common/celery_app.py` to call the new API.

- **Scaling**:
  - Increase Celery concurrency via environment variables.
  - Run multiple worker replicas in Docker Compose or Kubernetes.
  - Move Redis & Postgres to managed cloud services for HA.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

> Captely © 2025
