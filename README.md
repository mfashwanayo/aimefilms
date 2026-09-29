# AimeFilms

AimeFilms is a React and TypeScript streaming catalogue backed by a Python FastAPI service and SQLite database.

## Run locally

### Frontend

Prerequisites: Node.js

```bash
npm install
npm run dev
```

The frontend reads `VITE_API_BASE_URL` and defaults to `http://localhost:8001`.

### Python backend

Prerequisites: Python 3.11+

```bash
cd backend-python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

The SQLite database is created at `backend-data/aimefilms.sqlite` by default. Copy `backend-python/.env.example` to `backend-python/.env` and set the administrator and token values before deploying.

## Backend responsibilities

The Python service owns authentication, the movie catalogue, watchlists, continue-watching data, messages, view counts, logs, and administrator movie management. The first frontend request seeds the catalogue from the checked-in movie constants when the database is empty.
