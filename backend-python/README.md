# AimeFilms Python backend

FastAPI and SQLite backend for the AimeFilms catalogue.

## Run locally

```bash
cd backend-python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

## Configuration

Copy `.env.example` to `.env` and set `ADMIN_PASSWORD` and `TOKEN_SECRET` before deploying. `DB_PATH` defaults to `../backend-data/aimefilms.sqlite`.

## Endpoints

The service exposes health checks, authentication, movie search and seeding, view tracking, watchlists, continue-watching lists, profile updates, messages, logs, analytics, and administrator movie/user management under `/api`.
