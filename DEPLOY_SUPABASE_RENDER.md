# AimeFilms: secure admin login + Supabase PostgreSQL deployment

This patch replaces the SQLite backend with Supabase PostgreSQL and removes client-side login/register fallback behavior. It does not contain your database password or replacement administrator password.

## 1. Apply the files

Extract this bundle into the **root of your AimeFilms repository**, preserving folders. It replaces:

- `backend-python/app.py`
- `backend-python/requirements.txt`
- `backend-python/.env.example`

It adds:

- `supabase/schema.sql`
- `scripts/apply_frontend_security.py`
- this deployment guide

From the repository root, run:

```bash
python scripts/apply_frontend_security.py
```

That script removes the hardcoded browser admin credential block and makes login/registration fail closed if the API is unavailable. It also ignores `.env` files in Git.

Before committing, check:

```bash
python -m py_compile backend-python/app.py
git diff --check
npm install
npm run build
```

The repository includes the updated FastAPI backend, security fixes, schema and Render blueprint.

## 2. Connect the backend to your Supabase database

Your Supabase project is `fadsjkoaoxbtigelhcna`. The URL `https://fadsjkoaoxbtigelhcna.supabase.co` is the Supabase API URL, **not** the PostgreSQL connection string.

1. Open your project in Supabase.
2. Click **Connect** and select the PostgreSQL connection string. For a Render backend, try **Session pooler** if the direct host is not reachable on IPv4; Supabase explains the choices in its [database connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. Copy the connection string privately. Replace its password placeholder with your database password. URL-encode special characters in the password if required by the connection-string format.
4. Do **not** put the database password or a Supabase secret/service-role key in React code, GitHub files, or this chat.
5. You may optionally run `supabase/schema.sql` once in **Supabase → SQL Editor**. The backend also creates the tables at startup if they do not exist.

## 3. Configure Render backend service

In Render, create or update the Python Web Service for this GitHub repository.

- **Root Directory:** `backend-python`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`

Add these environment variables in Render (**Environment**, not in source code):

| Key | Value |
|---|---|
| `DATABASE_URL` | The full PostgreSQL connection string from Supabase Connect |
| `ADMIN_NAME` | Your chosen admin display name |
| `ADMIN_EMAIL` | Your admin email address |
| `ADMIN_PASSWORD` | A new, unique password with at least 12 characters |
| `TOKEN_SECRET` | A random secret at least 32 characters long; generate one rather than reusing a password |
| `FRONTEND_ORIGINS` | Your deployed frontend URL, such as `https://aimefilms-web.onrender.com`, with no trailing slash |

For a random token secret on a computer with Python, run `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Keep the result private. For local development, use `http://localhost:5173` as the frontend origin.

The configured admin account is synchronized to `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` when the backend starts. Use a new password; never reuse the exposed credential from the old source code.

## 4. Configure the frontend static site

In the Render **Static Site** environment settings, add:

- **Key:** `VITE_API_BASE_URL`
- **Value:** the actual deployed backend URL, for example `https://aimefilms-api.onrender.com` (no trailing slash)

Use the actual URL Render assigns to your service. Trigger a frontend redeploy after changing this variable.

## 5. Test the deployment

Open these using the actual backend hostname:

- `https://YOUR-BACKEND.onrender.com/health` should return `{"ok":true}`.
- `https://YOUR-BACKEND.onrender.com/api/movies` should return JSON after the database is connected.

Then open the frontend, test registration/login, and test an admin action. If the backend starts but browser requests fail, recheck `FRONTEND_ORIGINS` and `VITE_API_BASE_URL`.

## Important notes

- The new backend expects Supabase PostgreSQL, not the old local SQLite file. Existing SQLite data is not automatically migrated by this patch; export/import it separately if you need to keep existing users or movies.
- The `schema.sql` enables Row Level Security on the tables and defines no anonymous read policies. The frontend must access data through the FastAPI backend, not direct table queries.
- Rotate the exposed admin password immediately. Deleting it from the latest source does not erase it from old Git history. If the repository was public while the credential was present, consider cleaning the history after rotation.
- The one-time `/api/seed` endpoint remains for the existing frontend's initial catalogue seeding behavior. It only inserts when the movie table is empty; review/disable that behavior if you want all catalogue seeding to require an explicit administrator action.

## Video uploads (resumable, 3.9 GB target)

The admin form uploads video files directly from the browser to Supabase Storage using resumable TUS chunks, so the multi-GB file does not pass through Render. Storage keys use the virtual folder `films/<movie-id>/<generated-file-name>` inside the `aimefilms-videos` bucket. After a successful upload, FastAPI verifies the object and immediately writes the public URL into the movie's `video_url` or `full_movie_url` database column.

Supported formats: MP4, WebM, MOV and MKV. The application target is 3.9 GB (3,900,000,000 bytes). Supabase recommends resumable uploads for large files and uses 6 MiB chunks; see the [Supabase resumable upload guide](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

**Important current-plan limit:** this project is on Supabase Free, whose global file limit cannot exceed 50 MB. I set the bucket-level target to 3.9 GB, but the global Free-plan limit still rejects files over 50 MB. To enable real 3.9 GB uploads, upgrade the project to Pro or a compatible plan and then open **Supabase → Storage → Settings** and raise the **Global file size limit** to at least 3.9 GB. The bucket limit cannot override the global limit. See [Supabase file limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

Add the following in Render's backend service Environment settings:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://fadsjkoaoxbtigelhcna.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-side key from Supabase; never expose or commit it |
| `SUPABASE_PUBLISHABLE_KEY` | The project's public/publishable API key |
| `SUPABASE_VIDEO_BUCKET` | `aimefilms-videos` |
| `MAX_VIDEO_UPLOAD_MB` | `3900` |

After those values are set and the backend is deployed, sign in as admin, open **Film Inventory → Upload New Film**, choose a trailer or full movie file, and click **Commit to Database**. The UI displays progress and retries chunks after transient network errors. Videos are publicly readable for playback, so only upload content you have rights to distribute.
