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

### Upload a video

Use `POST /api/admin/videos/upload` in Swagger UI. Click **Authorize** and enter the admin bearer token, choose the video file, optionally set `movie_id` to update an existing movie, and set `field` to `fullMovieUrl` or `videoUrl`. Supported files: MP4, WebM, MOV and MKV. The current Supabase Free project is configured for a 50 MB per-file maximum. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_VIDEO_BUCKET` and `MAX_VIDEO_UPLOAD_MB` in the backend environment. Keep the service-role key private.

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


## Upload videos from the admin dashboard

The admin movie form can upload a trailer and/or a full movie directly to Supabase Storage using resumable TUS chunks. Files are placed under the Storage path `films/<movie-id>/<generated-file-name>`, and when an upload completes, the corresponding `videoUrl` or `fullMovieUrl` field is saved in PostgreSQL immediately.

Supported formats: MP4, WebM, MOV and MKV. Application limit: 3.9 GB (3,900,000,000 bytes). Large files upload directly from the browser to Storage; they do not pass through Render.

Required additional backend environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — private, server-side only
- `SUPABASE_PUBLISHABLE_KEY` — public/publishable API key
- `SUPABASE_VIDEO_BUCKET=aimefilms-videos`
- `MAX_VIDEO_UPLOAD_MB=3900`

**Plan limit:** the current Supabase Free project is limited to 50 MB per file. To actually accept videos up to 3.9 GB, upgrade the Supabase project to Pro (or another plan that supports the size), then set Storage's Global file size limit to at least 3.9 GB. The bucket-level limit and backend variable alone cannot override the global plan limit.

 
## Admin dashboard and database operations

Admin actions are saved through the FastAPI/PostgreSQL database, not merely in this browser's local storage.

- **Film Inventory:** edit title, brand, section, poster, description, synopsis, year, duration, rating, genres, cast, trending/new flags, trailer URL, or full-movie URL. Changes are saved through the authenticated backend.
- **Show/hide:** hiding a film removes it from the public catalogue but keeps it in admin inventory so it can be shown again.
- **Delete:** removes the movie and its view/watchlist records; video objects owned by the configured Supabase Storage bucket are removed through the Storage API.
- **User Registry:** lists registered database accounts and metadata. Blocked users cannot sign in or use authenticated API routes. Administrator accounts are protected from being blocked here. Passwords are never displayed.
- **Registration:** signup records are saved in the backend database with a salted PBKDF2 password hash, then appear in Admin → User Registry.
- **Export Data:** downloads database-backed movies, user summaries, logs, messages, and analytics.

### Live website configuration

For GitHub Pages, add a repository Actions variable named `VITE_API_BASE_URL` at **Settings → Secrets and variables → Actions → Variables**. Its value must be the public base URL of the deployed FastAPI service, without a trailing slash. Set `FRONTEND_ORIGINS` to the exact GitHub Pages origin and configure the Supabase `DATABASE_URL` plus private Storage variables on the API service. Never expose the Supabase service-role key in frontend variables.

The Pages workflow stops clearly if `VITE_API_BASE_URL` is missing, so a live build cannot silently ship with the local development URL.
