# Captely

Captely is a B2B contact enrichment platform that enables you to scrape leads from LinkedIn Sales Navigator, bulk-import via CSV/XLSX, enrich contact data (emails, phone numbers) using multiple providers in a cascading setup, manage credits, and integrate seamlessly with your CRM.

**Current Project Structure:**

```
Backend services (FastAPI, Celery, PostgreSQL, Redis)
Chrome Extension for LinkedIn Sales Navigator
Frontend Web App (Next.js 13)
```

---

## Table of Contents

1. [Current Architecture & Getting Started](#current-architecture--getting-started)  
2. [Architecture Overview](#architecture-overview)  
3. [Microservices MVP & Responsibilities](#microservices-mvp--responsibilities)  
4. [Database: Selection & Initial Schema](#database-selection--initial-schema)  
5. [Asynchronous Processing with Celery & Redis](#asynchronous-processing-with-celery--redis)  
6. [Proposed AWS Infrastructure](#proposed-aws-infrastructure)  
7. [CI/CD Pipeline with GitHub Actions](#cicd-pipeline-with-github-actions)  
8. [Security, Data Protection & Audit](#security-data-protection--audit)  
9. [Code Organization by Service](#code-organization-by-service)  
10. [Essential API Endpoints](#essential-api-endpoints)  
11. [Sales Navigator Chrome Scraper Integration](#sales-navigator-chrome-scraper-integration)  
12. [Contribution & License](#contribution--license)

---

## Current Architecture & Getting Started

Captely currently comprises:

- **Backend services** (FastAPI, Celery, PostgreSQL, Redis)  
- **Chrome Extension** for LinkedIn Sales Navigator  
- **Frontend Web App** (Next.js 13)

### Getting Started

#### Prerequisites
- Docker & Docker Compose (v3.8+)  
- Node.js (v16+) & npm or Yarn  
- (Optional) Python 3.12+ for local dev

#### Clone & Setup
```bash
git clone https://github.com/<your-org>/captely.git
cd captely
cp .env.example .env
```

#### Launch Backend
```bash
docker-compose up --build
```
Services:
- PostgreSQL (`captely-db:5432`)
- Redis (`captely-redis:6379`)
- Auth Service (`localhost:8000`)
- Credit Service (`localhost:8001`)
- Import Service (`localhost:8002`)
- Enrichment Worker (Celery)

#### Running Frontend
```bash
cd frontend-web
npm install
npm run dev  # http://localhost:3000
```

---

## Architecture Overview

Captely follows a **microservices** pattern to maximize modularity, resilience, and scalability. Each component focuses on a single domain, communicates via REST or message queues, and can be deployed and scaled independently.

```
+----------------+       +---------------+       +----------------+
|                | HTTP  |               | Celery|                |
|  Next.js SPA   |──────▶| Auth Service  |──────▶| Enrichment     |
| (User Frontend)|       | (FastAPI/Django)|     | Worker (Celery)|
+----------------+       +---------------+       +-------┬--------+
        │                                         Redis │
        │ HTTP                                               │
        ▼                                                   ▼
+---------------+       HTTP        +---------------+   +-------------+
| Import Service|───────────────▶   | Postgres      |   | Credit      |
| (FastAPI)     |                   | (Amazon RDS)  |   | Service     |
+---------------+                   +---------------+   +-------------+
        │
        └─────────────▶ Amazon S3
                (File storage)
```

Shared components in `common/`:
- `config.py` — environment & provider settings  
- `db.py` — SQLAlchemy engine & sessions  
- `celery_app.py` — Celery instance and task configuration  

---

## Microservices MVP & Responsibilities

| Service                 | Framework       | Key Responsibilities                                      |
|-------------------------|-----------------|-----------------------------------------------------------|
| **Auth Service**        | Django + DRF    | User registration/authentication, JWT issuance, API keys  |
| **Import Service**      | FastAPI         | CSV/XLSX uploads, job creation, S3 integration            |
| **Enrichment Worker**   | Celery (Python) | Asynchronous lead enrichment with cascading providers     |
| **Credit Service**      | FastAPI         | Credit balance management, transaction logging            |

---

## Database: Selection & Initial Schema

- **Choice**: PostgreSQL (Amazon RDS) for ACID compliance and relational integrity.  
- **Initial Schema**:

  - **users**  
    - `id` (PK), `email` (unique), `password_hash`, `google_oauth_id`, `role`, `credits`, `created_at`  
  - **import_jobs**  
    - `id` (PK), `user_id` (FK), `filename`, `status` (`pending`/`processing`/`done`), `total_count`, `completed_count`, `started_at`, `finished_at`  
  - **contacts**  
    - `id` (PK), `job_id` (FK), `original_email`, `original_phone`, `enriched_email`, `enriched_phone`, `first_name`, `last_name`, `company`, `title`, `source_provider`, `status`, `updated_at`  
  - **credit_transactions**  
    - `id` (PK), `user_id` (FK), `change` (±int), `reason`, `balance_after`, `timestamp`  

---

## Asynchronous Processing with Celery & Redis

1. **Producer**: Import Service enqueues individual `enrich_contact(contact_id)` tasks to Redis.  
2. **Broker**: Redis (AWS ElastiCache) handles message routing with low latency.  
3. **Consumers**: Celery workers fetch tasks, call enrichment APIs in cascade (e.g., Clearbit → Hunter.io → FullContact), update DB, and notify Credit Service.  
4. **Workflow Coordination**: Optional Celery Groups/Chords to trigger post-import actions (e.g., generate consolidated result files).  
5. **Monitoring**: Flower UI, CloudWatch metrics, and error alerts for task failures.  

---

## Proposed AWS Infrastructure

| Component                 | AWS Service                              |
|---------------------------|------------------------------------------|
| Container Orchestration   | ECS with Fargate (auto-scaling tasks)    |
| Load Balancing & API GW   | Application Load Balancer / API Gateway  |
| Relational Database       | RDS for PostgreSQL (Multi-AZ, encrypted) |
| Object Storage            | S3 buckets (uploads & results via presigned URLs) |
| Cache & Broker            | ElastiCache Redis                        |
| Static Frontend Delivery  | S3 + CloudFront CDN                      |
| DNS & Routing             | Route 53                                |
| Docker Registry           | ECR                                      |
| Email Notifications       | SES                                      |
| Logging & Monitoring      | CloudWatch Logs & CloudWatch Alarms      |
| Secret Management         | Secrets Manager / Parameter Store        |

---

## CI/CD Pipeline with GitHub Actions

1. **CI**  
   - Run unit/integration tests (Pytest, Jest).  
   - Lint and security scans.  
   - Build Docker images.  

2. **CD**  
   - Authenticate to ECR via GitHub OIDC → IAM.  
   - Push tagged images to ECR.  
   - Update ECS services (`aws ecs update-service`) for rolling deployments.  
   - Run database migrations (Auth Service) before cutover.  
   - Smoke tests & health checks post-deployment.  

3. **Environments**  
   - Separate workflows for `staging` and `production`.  
   - Path-based triggers: only rebuild services whose code changed.  

---

## Security, Data Protection & Audit

- **Encryption**: TLS everywhere, RDS/S3 at-rest encryption, optional field-level KMS encryption.  
- **Secrets**: Stored in AWS Secrets Manager, with least-privilege IAM roles for tasks.  
- **Authentication**: JWT with short expiry & refresh tokens; OAuth2 Google SSO via `django-allauth`.  
- **Authorization**: Role-based access control, middleware enforcement in all services.  
- **Network Isolation**: VPC-private subnets for DB & Redis; ALB only public endpoint.  
- **Audit Logging**: Credit and import actions logged in DB and CloudTrail; application logs to CloudWatch.  
- **Compliance**: GDPR data deletion/anonymization workflows, privacy policy, secure data retention policies.  

---

## Code Organization by Service

```
/common/                # Shared configs (env, DB, Celery)
/extension-sns/         # Chrome extension for Sales Navigator
/services/
├─ auth-service/       # Django + DRF project structure
├─ import-service/     # FastAPI app structure
├─ enrichment-worker/  # Celery tasks & provider clients
└─ credit-service/     # FastAPI service for credits
/frontend-web/          # Next.js 13 (App Router) project
```

Each service has its own `Dockerfile`, `requirements.txt`, and isolated test suite.

---

## Essential API Endpoints

### Auth Service (`/api/auth`)
- `POST /register` — Create user account.  
- `POST /login` — Authenticate & return JWT.  
- `GET /me` — Fetch current user profile.  
- `POST /refresh` — (optional) Refresh JWT tokens.

### Import Service (`/api/imports`)
- `POST /` — Upload CSV/XLSX as multipart/form-data.  
- `GET /` — List import jobs.  
- `GET /:job_id` — Status & progress.  
- `GET /:job_id/results` — JSON results or presigned S3 URL.

### Credit Service (`/api/credits`)
- `GET /` — Current credit balance & threshold alerts.  
- `GET /history` — Transaction history.  
- `POST /` — (Admin) Add/remove credits.

*(See full API reference in `/docs` or service code Swagger UIs.)*

---

## Sales Navigator Chrome Scraper Integration

We integrate and extend the open‑source scraper [qtecsolution/Linkedin-Sales-Navigator-Scraper](https://github.com/qtecsolution/Linkedin-Sales-Navigator-Scraper):

1. **UI Injection**: Add a non-intrusive "Scrape" button via Content Script.  
2. **Profile Extraction**: Collect name, title, company, URL, location, and industry for visible results.  
3. **Human-like Behavior**: Randomized scrolling, delays, and batch size limits (≤150 profiles/session).  
4. **Secure Transmission**: Batch POST to Auth Service with Bearer token authentication.  
5. **Immediate Enrichment**: Trigger Celery tasks upon receipt to fetch email/phone data.  
6. **Real-Time Feedback**: Popup shows extraction count, enrichment status, and alerts on anomalies.

---

## Getting Started

### Prerequisites

- Docker & Docker Compose  
- Node.js ≥16 & npm/Yarn  
- (Optional) Python 3.12+ for local development

### Clone & Setup

```bash
git clone https://github.com/<your-org>/captely.git
cd captely
cp .env.example .env  # configure your environment variables
```

### Launch Backend Stack

```bash
docker-compose up --build
```

This starts:  
- Postgres (5432)  
- Redis (6379)  
- Auth Service (8000)  
- Credit Service (8001)  
- Import Service (8002)  
- Celery Worker

### Run Frontend

```bash
cd frontend-web
npm install
npm run dev  # http://localhost:3000
```

---

## Contribution & License

Contributions are welcome via pull requests. Please follow the [code of conduct](CODE_OF_CONDUCT.md) and commit conventions.

Licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

🚀 **Production-Ready MVP** - A comprehensive SaaS platform for B2B contact enrichment with intelligent cascade processing, real-time verification, and advanced analytics.

## 🆕 Latest Updates (v2.0)

**Major features added:**
- 💰 **Subscription & Billing System** - 4 tiers with package-based limits
- 🏢 **Internal CRM** - Full contact management, activities, and campaigns
- 🔌 **6 Real CRM Integrations** - HubSpot, Salesforce, Lemlist, Smartlead, Outreach, Zapier
- 💳 **Payment Processing** - Stripe integration with credit packages
- 📊 **Enhanced Analytics** - Provider usage tracking and cost optimization

See [NEW_FEATURES_README.md](backend/NEW_FEATURES_README.md) for implementation details.

---

> Captely © 2025
