# AimeFilms deployment: GitHub Pages + Render + Supabase

This is the current deployment guide for the split repository. The frontend lives in `frontend/`; the FastAPI service lives in `backend-python/`. You do not need to run an old patch script to apply the folder split.

## 1. Supabase PostgreSQL

In Supabase, open **Connect** and copy the PostgreSQL connection string. Use that connection string for `DATABASE_URL` on the backend; the HTTPS project URL is not a database URL.

Do not put a database password or the service-role key in React or GitHub-tracked files. The backend connects to PostgreSQL and handles all privileged data operations.

## 2. Deploy the FastAPI service on Render

Use the repository's `render.yaml` or configure a Python Web Service with:

| Setting | Value |
|---|---|
| Root Directory | `backend-python` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

Configure these private environment variables:

- `DATABASE_URL`: PostgreSQL connection string from Supabase Connect
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `TOKEN_SECRET`: random secret, at least 32 characters
- `FRONTEND_ORIGINS`: exact public website origin
- `VIDEO_STORAGE_DRIVER=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (private)
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_VIDEO_BUCKET=aimefilms-videos`
- `MAX_VIDEO_UPLOAD_MB=3900`
- `TMDB_API_KEY` (optional)

The configured admin email/password are synchronized on backend startup. Use a new password; never reuse one that appeared in an earlier public version of the project.

### Why production uses Supabase Storage

Local development uses the backend's `storage/` folder. Render services without a persistent disk use an ephemeral filesystem, so locally stored uploads could disappear after a restart or redeploy. The Render blueprint therefore selects Supabase Storage for durable production videos. Attach a persistent disk before changing production to local filesystem storage.

The browser uploads directly to Supabase Storage with resumable TUS chunks; the multi-gigabyte source does not need to pass through the Render API process. The app limit is 3.9 GB, but the Supabase plan's Global file size limit must also allow that size. The application setting cannot override a provider plan limit.

## 3. Deploy the frontend on GitHub Pages

1. Open repository **Settings → Pages** and set the source to **GitHub Actions**.
2. Open **Settings → Secrets and variables → Actions → Variables**.
3. Add `VITE_API_BASE_URL` with the deployed FastAPI public HTTPS URL (no trailing slash).
4. Set the backend's `FRONTEND_ORIGINS` to the exact frontend origin, without the `/aimefilms/` repository path.

The Pages workflow installs dependencies from `frontend/package-lock.json`, builds `frontend/`, and publishes `frontend/dist/`.

## 4. Local development and local uploads

For local development, set these values in `backend-python/.env`:

```env
VIDEO_STORAGE_DRIVER=local
VIDEO_STORAGE_DIR=storage
FRONTEND_ORIGINS=http://localhost:5173
```

Start the backend on port 8001 and the frontend on port 5173 in separate terminals. Local video and media files are written under `backend-python/storage/public/films/<movie-id>/` and served by FastAPI at `/media/`. The storage folder is ignored by Git.

## 5. Verify

- `https://YOUR-BACKEND.onrender.com/health` should return a healthy database status.
- Open the website and test public catalogue loading, registration, admin login, film edits, and a small video upload.
- Confirm that `FRONTEND_ORIGINS` and `VITE_API_BASE_URL` match the deployed URLs.
- Confirm Supabase Storage's plan/global upload limit before attempting a multi-gigabyte file.

## Operational notes

The backend uses a bounded PostgreSQL connection pool. There is no scheduler because the current app has no genuine recurring workload; abandoned local upload parts are cleaned on API startup. Actual FFmpeg/GPU transcoding is not included yet and requires a separate media worker and job queue.
