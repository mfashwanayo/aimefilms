# AimeFilms API

FastAPI backend for the AimeFilms React/Vite application. The API owns authentication, catalogue writes, user management, view tracking, messages and media-upload authorization.

## Local development

Requirements: Python 3.11+ and a PostgreSQL database (the project currently uses Supabase PostgreSQL).

In PowerShell, start the backend in its own terminal:

```powershell
cd backend-python
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and set `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `TOKEN_SECRET`. For local video storage keep:

```env
VIDEO_STORAGE_DRIVER=local
VIDEO_STORAGE_DIR=storage
FRONTEND_ORIGINS=http://localhost:5173
```

Start the API:

```powershell
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

Open <http://localhost:8001/docs> for API documentation. The health endpoint is <http://localhost:8001/health>.

In a second terminal start the frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>.

## Local media folders

With `VIDEO_STORAGE_DRIVER=local`, video files are streamed in 1 MiB chunks into a temporary file and atomically renamed after a successful write. The final layout is:

```text
backend-python/
└── storage/
    ├── .tmp/                  # incomplete upload files; cleaned on startup
    └── public/
        └── films/
            └── <movie-id>/
                ├── <generated-id>.mp4
                ├── subtitle/
                └── audio/
```

The original filename is not used as a disk path. The API generates file names and only serves files beneath the `/media/` mount. Deleting a film removes only files that belong to this application's managed media folder. The `storage/` directory is excluded from Git so uploaded videos are never accidentally committed.

## Production storage on Render

The Render blueprint sets `VIDEO_STORAGE_DRIVER=supabase`. The backend issues short-lived signed upload information and the browser uploads large files directly with resumable TUS chunks. This avoids sending multi-gigabyte files through the Render web process.

Configure these private Render variables:

- `DATABASE_URL`: PostgreSQL connection string from Supabase Connect
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `TOKEN_SECRET`: random secret of at least 32 characters
- `FRONTEND_ORIGINS`: exact deployed website origin(s)
- `VIDEO_STORAGE_DRIVER=supabase`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_VIDEO_BUCKET=aimefilms-videos`
- `MAX_VIDEO_UPLOAD_MB=3900`

A Render service without a persistent disk has an ephemeral filesystem. Do not set local disk storage on a production instance unless you have attached and mounted a persistent disk. The existing free Render blueprint keeps remote object storage for durable media.

## Performance and resilience

- A bounded psycopg connection pool reduces the overhead of opening a new PostgreSQL connection for every API request. Tune `DB_POOL_MIN_SIZE` and `DB_POOL_MAX_SIZE` for the database plan and expected concurrency.
- PostgreSQL indexes support the catalogue, user-list, message-inbox and activity-log query paths.
- Uploads stream in bounded chunks to disk in local mode; incomplete temporary files are removed at startup.
- Routes return structured HTTP errors. Unexpected exceptions are logged server-side and return a generic 500 response instead of leaking internal details.
- No recurring scheduler is currently needed. Temporary upload cleanup runs during API startup. Add a separate worker only for a real scheduled workload such as recurring retention policies or media transcoding.

## Media processing scope

The current API stores original video files. It does not yet run FFmpeg/GPU transcoding or a background encoding queue. The frontend should not display fake transcoding progress. A future encoding worker should be a separate process and queue consumer, not a scheduled request inside the web server.

## Security notes

Never commit real `.env` files, the Supabase service-role key, database passwords or token secrets. All admin routes require a valid administrator bearer token. Existing database tables are preserved by startup schema initialization; existing local SQLite files are not automatically migrated into PostgreSQL.
