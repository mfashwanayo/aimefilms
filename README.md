# AimeFilms

AimeFilms is a React and TypeScript streaming catalogue with a Python FastAPI backend and Supabase PostgreSQL database.

## Run locally

### Frontend

Prerequisites: Node.js

```bash
npm install
npm run dev
```

The frontend reads `VITE_API_BASE_URL` and defaults to `http://localhost:8001`.

### FastAPI backend

Prerequisites: Python 3.11+ and a PostgreSQL connection string from your Supabase project's **Connect** panel.

```powershell
cd backend-python
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, TOKEN_SECRET
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

On macOS/Linux, activate with `source .venv/bin/activate` and copy the template with `cp .env.example .env`.

Open `http://localhost:8001/docs` for interactive API documentation. `/health` verifies the database connection.

## Database

Supabase PostgreSQL is used for accounts, movies, views, watchlists, messages and logs. The schema is in `supabase/schema.sql`; the backend also creates missing tables at startup. Tables have Row Level Security enabled and should be accessed through the trusted FastAPI backend, not directly from browser code.

## Deploy on Render

This repository contains `render.yaml` for the FastAPI Web Service:

- Root Directory: `backend-python`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Configure these private backend environment variables in Render: `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TOKEN_SECRET`, and `FRONTEND_ORIGINS`. Configure `VITE_API_BASE_URL` on your frontend Static Site using the actual backend URL.

## Security notes

- Never commit a real `.env` file, database password, or Supabase secret/service-role key.
- The administrator password previously exposed in frontend code should be rotated. The frontend no longer verifies logins locally when the backend is unavailable.
- Existing SQLite data is not automatically imported. Back up and migrate any data you need to retain.
- For a live deployment, verify `/health`, then test registration, login, movies and admin routes.
