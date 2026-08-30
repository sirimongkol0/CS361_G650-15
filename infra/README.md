# Infrastructure Guide

## Overview

This document provides instructions for running and verifying the Partner Activity application infrastructure.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development without Docker)
- Python 3.11+ (for local development without Docker)
- PostgreSQL 15 (for local development without Docker)

## Running with Docker (Recommended)

### Start All Services

```bash
# From the project root directory
docker compose up --build
```

This will start:
- **FastAPI backend** on http://localhost:8000 — connects to the external AWS RDS PostgreSQL via the `DATABASE_URL` baked into `docker-compose.yml`
- **Next.js frontend** on http://localhost:3000 — SSR fetches go to the backend service name (`http://partner_activity_backend:8000`) inside the Docker network; **browser-facing links** (document downloads, the `/docs` Swagger link) use `NEXT_PUBLIC_API_BROWSER_URL` (`http://localhost:8000/api/v1`) because the user's browser cannot resolve Docker service names

> **Note:** there is no database container in this compose file. The database is
> the external AWS RDS instance (`cs361-partner-db...ap-southeast-1.rds.amazonaws.com`).

### Verify Services Are Running

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (use with caution)
docker compose down -v
```

## Running Without Docker

### Backend Setup (SQLite — No DB Needed)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the backend — uses SQLite by default
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Backend Setup (PostgreSQL / RDS)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set DATABASE_URL to your RDS or local PostgreSQL
export DATABASE_URL="postgresql://user:password@your-rds-endpoint:5432/dbname"

# Run the backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
# NEXT_PUBLIC_API_URL       → server-side (SSR) fetches
# NEXT_PUBLIC_API_BROWSER_URL → links the browser opens (downloads, /docs)
export NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"
export NEXT_PUBLIC_API_BROWSER_URL="http://localhost:8000/api/v1"

# Run development server
npm run dev
```

## Verification Commands

### Health Check

```bash
curl http://localhost:8000/api/v1/health
# Expected: {"status":"healthy"}
```

### List Partners

```bash
curl http://localhost:8000/api/v1/partners/
# Expected: [] (empty array if no data) or array of partner objects
```

### Get Specific Partner (Draft should return 404)

```bash
# This should return 404 for draft partners
curl http://localhost:8000/api/v1/partners/999
# Expected: 404 with error message
```

### List Activities (Ordered by Date Ascending)

```bash
curl http://localhost:8000/api/v1/activities/
# Expected: Array of activities ordered by date ascending
```

### Frontend Pages

- Home: http://localhost:3000
- Partners: http://localhost:3000/partners
- Activities: http://localhost:3000/activities

## Troubleshooting

### Database Connection Issues

If the backend cannot connect to the database:

1. Verify the RDS endpoint is reachable from your machine / container host
   (the RDS security group must allow port 5432 from your IP):

   ```bash
   docker compose exec backend env | grep DATABASE_URL
   ```

2. Check backend logs for connection errors:

   ```bash
   docker compose logs backend
   ```

### Port Already in Use

If ports 8000 or 3000 are already in use, modify the `docker-compose.yml` port mappings:

```yaml
ports:
  - "8001:8000"  # Change host port
```

### Browser shows `DNS_PROBE_POSSIBLE` for `partner_activity_backend`

A Docker service name leaked into the browser. Server-side (SSR) fetches may use
the service name, but anything the **browser opens directly** must point at
`http://localhost:8000`. The fix lives in the repo already: `docker-compose.yml`
sets both `NEXT_PUBLIC_API_URL` (SSR) and `NEXT_PUBLIC_API_BROWSER_URL`
(browser links), and `lib/api.ts` builds download/Swagger links from the
browser URL. If you see this again, check those two variables.

### Frontend Build Errors

Ensure all dependencies are installed and the API URL is correctly configured:

```bash
cd frontend
npm install
npm run build
```
