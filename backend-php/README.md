# PHP Backend (AimeFilms)

## Run locally (built-in PHP server)
From this repo root:

```bash
cd backend-php
php -S localhost:8080
```

Your API will be reachable at:
- http://localhost:8080/api/health


## Environment variables
Set:
- `JWT_SECRET` (optional)
- `ADMIN_PASSWORD` (optional; default: `dev-admin-change-me`)
- `DB_PATH` (optional; default: `backend-data/aimefilms.sqlite`)

## Notes
This is an initial REST backend skeleton to replace the current `localStorage`-based `services/api.ts`.
It includes:
- `/api/auth/login`
- `/api/auth/register`
- `/api/movies`
- `/api/movies/search`
- `/api/views/track`

Extend with admin endpoints (users, analytics logs, CRUD movies, inbox) as needed.

