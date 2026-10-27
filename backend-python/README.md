# AimeFilms FastAPI backend

This backend serves the AimeFilms React/Vite website. It supports SQLite for local development and Supabase PostgreSQL when `DATABASE_URL` is set.

## Run locally (Windows PowerShell)

```powershell
cd backend-python
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `TOKEN_SECRET`. For local testing, leave `DATABASE_URL` empty to use SQLite. Start the API:

```powershell
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

Open http://localhost:8001/docs.

## Use Supabase PostgreSQL on Render

1. In your Supabase project, open **Connect** and copy the PostgreSQL connection string (use the session pooler if needed).
2. In Render, configure these private backend environment variables: `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TOKEN_SECRET`, and `FRONTEND_ORIGINS`.
3. Use root directory `backend-python`, build command `pip install -r requirements.txt`, and start command `uvicorn app:app --host 0.0.0.0 --port $PORT`.
4. Set `FRONTEND_ORIGINS` to the exact public website origin. Never use a public frontend env var for database passwords or token secrets.

For production with `DATABASE_URL`, startup intentionally fails unless the administrator credentials and stable token secret are configured. Replace any credentials that may have been exposed in older versions.

## Feedback inbox

The public contact form posts to `POST /api/feedback`. Messages are stored in the shared `messages` table and are returned by the admin-only `GET /api/admin/messages` route. Admin authentication remains required to read the inbox.

## Notes

- The backend creates its tables at startup if they do not yet exist.
- Existing Supabase tables are preserved; this backend does not delete data.
- Existing SQLite data is not automatically migrated to PostgreSQL.
